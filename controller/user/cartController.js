const productSchema = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const wishlistSchema = require('../../models/wishlistSchema');

const getCart = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const cart = await Cart.findOne({ user: userId }).populate('items.product').lean()

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.render('user/cart', {
                user: req.session.user,
                items: [],
                totalMRP: 0,
                discount: 0,
                shippingFee: 0,
                grandTotal: 0,
                total: 0
            });
        }

        let total = 0;
        let totalMRP = 0;
        let shippingFee = 50;

        cart.items.forEach(item => {
            if (item.product.variants && item.product.variants.length > 0) {
                const variant = item.product.variants[0];
                const salePrice = variant.salePrice || variant.regularPrice;
                const regularPrice = variant.regularPrice;

                total += salePrice * item.quantity;
                totalMRP += regularPrice * item.quantity;
            }
        });

        const discount = totalMRP - total;
        const grandTotal = total + shippingFee;

        res.render('user/cart', {
            user: req.session.user,
            items: cart.items,
            total,
            totalMRP,
            discount,
            shippingFee,
            grandTotal,
            cloudName: process.env.CLOUDINARY_CLOUD_NAME
        });

    } catch (error) {
        console.log(' cart get error')
        next(error);
    }
};

const addToCart = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const productId = req.body.productId;

        const product = await productSchema.findById(productId).populate('categoryId');

        if (
            !product ||
            product.isActive ||
            !product.categoryId?.isListed ||
            product.isDeleted
        ) {
            return res.status(404).json({ success: false, message: 'Product is unavailable or blocked.' });
        }

        const maxQuantityAllowed = 5;

        let cart = await Cart.findOne({ user: userId });
        if (!cart) {
            cart = new Cart({ user: userId, items: [] });
        }

        const existingItem = cart.items.find(item => item.product.toString() === productId);

        const stockQty = product.variants[0]?.quantity || 0;
        const itemPrice = product.variants[0]?.salePrice || product.variants[0]?.regularPrice

        if (existingItem) {
            if (existingItem.quantity >= stockQty) {
                return res.status(400).json({ success: false, message: 'Cannot add more, stock limit reached.' });
            }
            if (existingItem.quantity >= maxQuantityAllowed) {
                return res.status(400).json({ success: false, message: `Cannot add more than ${maxQuantityAllowed} items.` });
            }
            existingItem.quantity += 1;
        } else {
            if (stockQty <= 0) {
                return res.status(400).json({ success: false, message: 'Product out of stock.' });
            }
            cart.items.push({ product: productId, quantity:1, price: itemPrice });
        }

        await wishlistSchema.updateOne(
            { user: userId },
            { $pull: { products: productId } }
        );

        await cart.save();

        return res.status(200).json({ success: true, message: 'Product added to cart successfully' });

    } catch (error) {
        console.log(' cart add error')
        next(error);
    }
};

const updateCartItem = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId, action } = req.body;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const item = cart.items.find(item => item.product.toString() === productId);
        if (!item) return res.status(404).json({ success: false, message: 'Product not found in cart' });

        const product = await productSchema.findById(productId).populate('categoryId');
        if (!product || product.isActive || !product.categoryId.isListed || product.isDeleted) {
            return res.status(400).json({ success: false, message: 'Product is unavailable or blocked' });
        }

        const totalStock = product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
        const MAX_QTY = 5;

        if (action === 'increase') {
            if (item.quantity >= MAX_QTY) {
                return res.status(400).json({ success: false, message: `Max ${MAX_QTY} quantity allowed` });
            }
            if (item.quantity >= totalStock) {
                return res.status(400).json({ success: false, message: 'Insufficient stock' });
            }
            item.quantity += 1;
            await cart.save();
            return res.json({ success: true, message: 'Quantity increased', quantity: item.quantity });
        }

        if (action === 'decrease') {
            if (item.quantity <= 1) {
                return res.status(400).json({ success: false, message: 'Minimum 1 quantity required' });
            } else {
                item.quantity -= 1;
                await cart.save();
                return res.json({ success: true, message: 'Quantity decreased', quantity: item.quantity });
            }
        }

        return res.status(400).json({ success: false, message: 'Invalid action' });
    } catch (err) {
        console.log(' cart updated error')
        next(err);
    }
};

const removeFromCart = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const productId = req.params.productId;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        cart.items = cart.items.filter(item => item.product.toString() !== productId);
        await cart.save();

        res.json({ success: true, message: 'Product removed from cart' });
    } catch (err) {
        console.log(' cart remove error')
        next(err);
    }
};

const emptyCart = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const cart = await Cart.findOne({ user: userId });
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        cart.items = [];
        await cart.save();

        res.json({ success: true, message: 'Cart emptied' });
    } catch (err) {
        console.log(' cart empty page error')
        next(err);
    }
};

module.exports = {
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    emptyCart
};
