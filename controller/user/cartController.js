const productSchema = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const wishlistSchema = require('../../models/wishlistSchema');
const categoryOffer = require('../../models/categoryOfferSchema');
const logger = require('../../utils/logger');

const getCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId })
      .populate('items.product')
      .lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render('user/cart', {
        user: req.session.user,
        items: [],
        totalMRP: 0,
        discount: 0,
        grandTotal: 0,
        total: 0,
      });
    }

    const categoryOff = await categoryOffer
      .find({
        isDeleted: false,
        status: 'Active',
      })
      .lean();

    let totalMRP = 0;
    let discount = 0;
    let grandTotal = 0;

    for (let item of cart.items) {
      const product = item.product;
      const quantity = item.quantity;
      const variant = product.variants[0];

      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice;

      const productOffer = regularPrice - salePrice;

      const catOffer = categoryOff.find(
        (cat) => cat.category._id.toString() === product.categoryId.toString()
      );
      let catDiscount = 0;
      if (catOffer && catOffer.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }

      const bestOffer = Math.max(productOffer, catDiscount);

      const discountedPrice = regularPrice - bestOffer;

      totalMRP += regularPrice * quantity;
      discount += bestOffer * quantity;

      grandTotal += discountedPrice * quantity;
    }

    res.render('user/cart', {
      user: req.session.user,
      items: cart.items,
      total: totalMRP - discount,
      totalMRP,
      discount,
      grandTotal: grandTotal,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      categoryOffers: categoryOff, // Pass category offers to template
    });
  } catch (error) {
    logger.error('cart get error:', error);
    next(error);
  }
};

const addToCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { productId, variantId, quantity = 1 } = req.body;
    const requestedQty = parseInt(quantity) || 1;

   
    const product = await productSchema
      .findById(productId)
      .populate("categoryId");

    if (
      !product ||
      product.isActive || 
      !product.categoryId?.isListed ||
      product.isDeleted
    ) {
      return res.status(404).json({
        success: false,
        message: "Product is unavailable or blocked.",
      });
    }

   
    const selectedVariant = variantId
      ? product.variants.id(variantId)
      : product.variants[0]; 

    if (!selectedVariant) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid or missing variant." });
    }

    const maxQuantityAllowed = 5;
    const stockQty = selectedVariant.quantity || 0;
    const itemPrice = selectedVariant.salePrice;

    if (requestedQty < 1) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid quantity." });
    }

    if (requestedQty > stockQty) {
      return res.status(400).json({
        success: false,
        message: `Only ${stockQty} items available in stock.`,
      });
    }

    if (requestedQty > maxQuantityAllowed) {
      return res.status(400).json({
        success: false,
        message: `Maximum ${maxQuantityAllowed} items allowed per product.`,
      });
    }

    let cart = await Cart.findOne({ user: userId });

    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    
    const existingItem = cart.items.find(
      (item) =>
        item.product.toString() === productId &&
        (item.variantId ? item.variantId.toString() === selectedVariant._id.toString() : true)
    );

    if (existingItem) {
      const newQuantity = existingItem.quantity + requestedQty;

      if (newQuantity > stockQty) {
        return res.status(400).json({
          success: false,
          message: `Cannot add ${requestedQty} more. Only ${
            stockQty - existingItem.quantity
          } items available in stock.`,
        });
      }

      if (newQuantity > maxQuantityAllowed) {
        const availableToAdd = maxQuantityAllowed - existingItem.quantity;
        if (availableToAdd <= 0) {
          return res.status(400).json({
            success: false,
            message: `Maximum ${maxQuantityAllowed} items allowed per product. You already have ${existingItem.quantity} in cart.`,
          });
        } else {
          return res.status(400).json({
            success: false,
            message: `Cannot add ${requestedQty} more. You can only add ${availableToAdd} more items (Maximum ${maxQuantityAllowed} per product).`,
          });
        }
      }

      existingItem.quantity = newQuantity;
    } else {
      if (stockQty <= 0) {
        return res
          .status(400)
          .json({ success: false, message: "Product out of stock." });
      }

      cart.items.push({
        product: productId,
        variantId: selectedVariant._id,
        quantity: requestedQty,
        price: itemPrice,
      });
    }

  
    await wishlistSchema.updateOne(
      { user: userId },
      { $pull: { products: productId } }
    );

    await cart.save();

    const message =
      requestedQty === 1
        ? "Product added to cart successfully"
        : `${requestedQty} items added to cart successfully`;

    return res.status(200).json({ success: true, message });
  } catch (error) {
    logger.error("cart add error:", error);
    next(error);
  }
};

const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { productId, action } = req.body;

    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });
    
    const item = cart.items.find(
      (item) => item.product._id.toString() === productId
    );
    if (!item)
      return res
        .status(404)
        .json({ success: false, message: 'Product not found in cart' });

    const product = await productSchema
      .findById(productId)
      .populate('categoryId');
    if (
      !product ||
      product.isActive ||
      !product.categoryId.isListed ||
      product.isDeleted
    ) {
      return res
        .status(400)
        .json({ success: false, message: 'Product is unavailable or blocked' });
    }

    const totalStock = product.variants.reduce(
      (sum, v) => sum + (v.quantity || 0),
      0
    );
    const MAX_QTY = 5;

   
    if (action === 'increase') {
      if (item.quantity >= MAX_QTY) {
        return res
          .status(400)
          .json({ success: false, message: `Max ${MAX_QTY} quantity allowed` });
      }
      if (item.quantity >= totalStock) {
        return res
          .status(400)
          .json({ success: false, message: 'Insufficient stock' });
      }
      item.quantity += 1;
    } else if (action === 'decrease') {
      if (item.quantity <= 1) {
        return res
          .status(400)
          .json({ success: false, message: 'Minimum 1 quantity required' });
      }
      item.quantity -= 1;
    }

    await cart.save();

 
    const categoryOff = await categoryOffer
      .find({
        isDeleted: false,
        status: 'Active',
      })
      .lean();

    let totalMRP = 0;
    let totalDiscount = 0;
    let grandTotal = 0;

   
    for (let cartItem of cart.items) {
      const itemProduct = cartItem.product;
      const quantity = cartItem.quantity;
      const variant = itemProduct.variants[0];

      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice;

    
      const productOffer = regularPrice - salePrice;

    
      const catOffer = categoryOff.find(
        (cat) => cat.category._id.toString() === itemProduct.categoryId.toString()
      );
      let catDiscount = 0;
      if (catOffer && catOffer.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }

    
      const bestOffer = Math.max(productOffer, catDiscount);
      const discountedPrice = regularPrice - bestOffer;

   
      totalMRP += regularPrice * quantity;
      totalDiscount += bestOffer * quantity;
      grandTotal += discountedPrice * quantity;
    }

    return res.json({
      success: true,
      message: action === 'increase' ? 'Quantity increased' : 'Quantity decreased',
      quantity: item.quantity,
      cartTotal: totalMRP,
      discountOff: totalDiscount,
      grandTotal: grandTotal,
    });

  } catch (err) {
    logger.error('cart updated error:', err);
    next(err);
  }
};

const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(
      (item) => item.product.toString() !== productId
    );
    await cart.save();

    res.json({ success: true, message: 'Product removed from cart' });
  } catch (err) {
    logger.error(' cart remove error');
    next(err);
  }
};

const emptyCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart)
      return res
        .status(404)
        .json({ success: false, message: 'Cart not found' });

    cart.items = [];
    await cart.save();

    res.json({ success: true, message: 'Cart emptied' });
  } catch (err) {
    logger.error(' cart empty page error');
    next(err);
  }
};

module.exports = {
  getCart,
  addToCart,
  updateCartItem,
  removeFromCart,
  emptyCart,
};
