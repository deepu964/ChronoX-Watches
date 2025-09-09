const categorySchema = require('../../models/categorySchema');
const productSchema = require('../../models/productSchema');
const wishlistSchema = require('../../models/wishlistSchema');
const categoryOffer = require('../../models/categoryOfferSchema');
const mongoose = require('mongoose');
const logger = require('../../utils/logger');

const getLoadHomePage = async (req, res, next) => {
  try {
    const category = await categorySchema.find({ isListed: true });
    const products = await productSchema.find({ isActive: false });
    const newProducts = await productSchema
      .find({ isActive: false })
      .sort({ createdAt: -1 })
      .limit(8);
    const user = req.session.user;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    res.render('user/home', {
      user,
      products,
      cloudName,
      category,
      newProducts,
    });
  } catch (error) {
    logger.error('Home page error:', error);
    next(error);
  }
};

const PageNotFound = (req, res, next) => {
  try {
    res.status(404).render('user/404');
  } catch (error) {
    next(error);
    logger.error('404 page error:', error);
  }
};

const getShopPage = async (req, res, next) => {
  try {
    const { search = '', categoryId: categoryFilter = [], sortBy } = req.query;

    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    const categories = await categorySchema.find({ isListed: true });

    let filter = { isActive: false };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { model: { $regex: search, $options: 'i' } },
      ];
    }

    let categoryIds = categoryFilter;
    if (!Array.isArray(categoryIds)) {
      categoryIds = categoryIds ? [categoryIds] : [];
    }
    if (categoryIds.length > 0) {
      categoryIds = categoryIds.map((id) => new mongoose.Types.ObjectId(id));
      filter.categoryId = { $in: categoryIds };
    }
    const totalProduct = await productSchema.countDocuments(filter);
    const totalPage = Math.ceil(totalProduct / limit);

    let products;

    if (sortBy === 'price-asc' || sortBy === 'price-desc') {
      const sortDirection = sortBy === 'price-asc' ? 1 : -1;

      products = await productSchema.aggregate([
        { $match: filter },
        {
          $addFields: {
            finalPrice: {
              $min: {
                $map: {
                  input: '$variants',
                  as: 'variant',
                  in: {
                    $ifNull: ['$$variant.salePrice', '$$variant.regularPrice'],
                  },
                },
              },
            },
          },
        },
        { $sort: { finalPrice: sortDirection } },
        { $skip: skip },
        { $limit: limit },
      ]);

      const validProducts = [];
      for (let i = 0; i < products.length; i++) {
        const category = await categorySchema
          .findOne({
            _id: products[i].categoryId,
            isListed: true,
          })
          .lean();

        if (category) {
          products[i].categoryId = category;
          validProducts.push(products[i]);
        }
      }

      products = validProducts;
    } else {
      let sortOption = { createdAt: -1 };

      if (sortBy === 'name-asc') {
        sortOption = { categoryId: 1, name: 1 };
      } else if (sortBy === 'name-desc') {
        sortOption = { categoryId: 1, name: -1 };
      }

      const rawProducts = await productSchema
        .find(filter)
        .populate({
          path: 'categoryId',
          model: 'Category',
          match: { isListed: true },
        })
        .sort(sortOption)
        .skip(skip)
        .limit(limit)
        .lean();
      products = rawProducts.filter((p) => p.categoryId);
    }

    let userWishlist = [];
    if (req.session.user) {
      const wishlist = await wishlistSchema.findOne({
        user: req.session.user._id,
      });
      if (wishlist && wishlist.products.length > 0) {
        userWishlist = wishlist.products.map((p) => p.toString());
      }
    }

    const categoryOffers = await categoryOffer.find({
      isDeleted: false,
      status: "Active"
    }).populate("category");

    // Calculate offers for each product
    for (let product of products) {
      const basePrice = Math.min(
        ...product.variants.map(
          (v) => v.salePrice || v.regularPrice
        )
      );

      // Calculate product-level discount percentage
      let productDiscountPer = 0;
      for (let vari of product.variants) {
        const diff = vari.regularPrice - (vari.salePrice || vari.regularPrice);
        const per = (diff / vari.regularPrice) * 100;
        if (per > productDiscountPer) productDiscountPer = per;
      }

      // Calculate category-level discount percentage
      let categoryDiscountPer = 0;
      const catOffer = categoryOffers.find(
        (c) => c.category._id.toString() === product.categoryId._id.toString()
      );
      if (catOffer) {
        categoryDiscountPer = catOffer.discount;
      }

      // Determine which offer is greater and apply it
      const finalDiscountPer = Math.max(productDiscountPer, categoryDiscountPer);
      
      // Store offer information on the product
      product.productDiscountPer = productDiscountPer;
      product.categoryDiscountPer = categoryDiscountPer;
      product.finalDiscountPer = finalDiscountPer;
      product.appliedOfferType = productDiscountPer >= categoryDiscountPer ? 'Product Offer' : 'Category Offer';
      product.originalPrice = basePrice;
      product.finalPrice = basePrice - (basePrice * finalDiscountPer) / 100;
    }




    res.render('user/shops', {
      user: req.session.user,
      products,
      cloudName,
      query: req.query,
      categories,
      categoryFilter: categoryIds,
      currentPage: page,
      totalPage,
      userWishlist,
    });
  } catch (error) {
    logger.error('Shop page error:', error);
    next(error);
  }
};

const getProductDetails = async (req, res, next) => {
  try {
    const id = req.params.id;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const userId = req.session.user?._id;

    // Main product
    const product = await productSchema.findById(id).populate("categoryId");

    // Related products
    const products = await productSchema
      .find({ isActive: false, isDeleted: false })
      .limit(4);

    // Wishlist
    let userWishlist = [];
    if (userId) {
      const wishlistSchema = require("../../models/wishlistSchema");
      const wishlist = await wishlistSchema.findOne({ user: userId });
      if (wishlist && wishlist.products) {
        userWishlist = wishlist.products.map((p) => p.toString());
      }
    }

    // Active category offers
    const categoryOffers = await categoryOffer
      .find({ isDeleted: false, status: "Active" })
      .populate("category");

    /** 🔹 Calculate best discount for MAIN product */
    const basePrice = Math.min(
      ...product.variants.map((v) => v.salePrice || v.regularPrice)
    );

    // Product-level discount %
    let productDiscountPer = 0;
    for (let vari of product.variants) {
      const diff = vari.regularPrice - (vari.salePrice || vari.regularPrice);
      const per = (diff / vari.regularPrice) * 100;
      if (per > productDiscountPer) productDiscountPer = per;
    }

    // Category-level discount %
    let categoryDiscountPer = 0;
    const catOffer = categoryOffers.find(
      (c) => c.category._id.toString() === product.categoryId._id.toString()
    );
    if (catOffer) {
      categoryDiscountPer = catOffer.discount;
    }

    // Final applied discount - choose the highest
    const finalDiscountPer = Math.max(productDiscountPer, categoryDiscountPer);
    const finalPrice = basePrice - (basePrice * finalDiscountPer) / 100;

    // Determine which offer type is applied
    let appliedOfferType = 'No Offer';
    if (finalDiscountPer > 0) {
      if (productDiscountPer >= categoryDiscountPer) {
        appliedOfferType = 'Product Offer';
      } else {
        appliedOfferType = 'Category Offer';
      }
    }

    // Attach comprehensive offer data to product
    product.originalPrice = basePrice;
    product.finalPrice = finalPrice;
    product.appliedDiscount = finalDiscountPer;
    product.productDiscountPer = productDiscountPer;
    product.categoryDiscountPer = categoryDiscountPer;
    product.appliedOfferType = appliedOfferType;
    product.savingsAmount = basePrice - finalPrice;

    /** 🔹 Do the same for "related products" list */
    for (let p of products) {
      const basePriceP = Math.min(
        ...p.variants.map((v) => v.salePrice || v.regularPrice)
      );

      let productDiscountPerP = 0;
      for (let vari of p.variants) {
        const diff = vari.regularPrice - (vari.salePrice || vari.regularPrice);
        const per = (diff / vari.regularPrice) * 100;
        if (per > productDiscountPerP) productDiscountPerP = per;
      }

      let categoryDiscountPerP = 0;
      const catOfferP = categoryOffers.find(
        (c) => c.category._id.toString() === p.categoryId._id.toString()
      );
      if (catOfferP) {
        categoryDiscountPerP = catOfferP.discount;
      }

      const finalDiscountPerP = Math.max(
        productDiscountPerP,
        categoryDiscountPerP
      );
      p.finalPrice = basePriceP - (basePriceP * finalDiscountPerP) / 100;
      p.appliedDiscount = finalDiscountPerP;
    }

    // Render with proper data
    res.render("user/details", {
      user: req.session.user,
      product,
      cloudName,
      products,
      userWishlist,
      isInWishlist: userWishlist.includes(id),
    });
  } catch (error) {
    logger.error("Product details error:", error);
    next(error);
  }
};


module.exports = {
  getLoadHomePage,
  PageNotFound,
  getShopPage,
  getProductDetails,
};
