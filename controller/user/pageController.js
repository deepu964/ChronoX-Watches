const categorySchema = require('../../models/categorySchema');
const productSchema = require('../../models/productSchema');
const wishlistSchema = require('../../models/wishlistSchema');
const mongoose = require('mongoose');

const getLoadHomePage = async (req, res) => {
    try {
        const category = await categorySchema.find({ isListed: true });
        const products = await productSchema.find({ isActive: false })
        const user = req.session.user
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        res.render('user/home', {
            user, products, cloudName,
            category
        });
    } catch (error) {
        console.error("Home page error:", error);
        return res.render('user/page-404')
    }
};

const PageNotFound = (req, res) => {
    try {
        res.status(404).render('user/404');
    } catch (error) {
        next(error);
        console.error("404 page error:", error);
    }
};

const getShopPage = async (req, res) => {
    try {
        const {
            search = "",
            categoryId: categoryFilter = [],
            sortBy
        } = req.query;

        const page = parseInt(req.query.page) || 1;
        const limit = 7;
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
            categoryIds = categoryIds.map(id => new mongoose.Types.ObjectId(id));
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
                                    input: "$variants",
                                    as: "variant",
                                    in: { $ifNull: ["$$variant.salePrice", "$$variant.regularPrice"] }
                                }
                            }
                        }
                    }
                },
                { $sort: { finalPrice: sortDirection } },
                { $skip: skip },
                { $limit: limit }
            ]);

            const validProducts = [];
            for (let i = 0; i < products.length; i++) {
                const category = await categorySchema.findOne({
                    _id: products[i].categoryId,
                    isListed: true
                }).lean();

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

            const rawProducts = await productSchema.find(filter)
                .populate({
                    path: "categoryId",
                    model: 'Category',
                    match: { isListed: true }
                })
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean();
            products = rawProducts.filter(p => p.categoryId);
        }

        let userWishlist = [];
        if (req.session.user) {
            const wishlist = await wishlistSchema.findOne({ user: req.session.user._id });
            if (wishlist && wishlist.products.length > 0) {
                userWishlist = wishlist.products.map(p => p.toString());
            }
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
            userWishlist
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.status(500).send("Server error");
    }
};

const getProductDetails = async (req, res) => {
    try {
        const id = req.params.id;
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const userId = req.session.user?._id;

        const product = await productSchema.findById(id);
        const products = await productSchema.find({ isActive: false, isDeleted: false }).limit(4);

        
        let userWishlist = [];
        if (userId) {
            const wishlistSchema = require('../../models/wishlistSchema');
            const wishlist = await wishlistSchema.findOne({ user: userId });
            if (wishlist && wishlist.products) {
                userWishlist = wishlist.products.map(p => p.toString());
            }
        }

        res.render('user/details', {
            user: req.session.user,
            product,
            cloudName,
            products,
            userWishlist,
            isInWishlist: userWishlist.includes(id)
        });
    } catch (error) {
        console.log("Product details error:", error);
        res.status(500).send("Server error");
    }
}

module.exports = {
    getLoadHomePage,
    PageNotFound,
    getShopPage,
    getProductDetails
};
