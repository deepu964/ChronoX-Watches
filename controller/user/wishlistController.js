const User = require('../../models/userSchema');
const wishlistSchema = require('../../models/wishlistSchema');

const getWishList = async (req, res, next) => {
    try {
        const userId = req.session.user?._id;
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        if (!userId) {
            return res.redirect('/login');
        }

        const wishlist = await wishlistSchema.findOne({ user: userId })
            .populate({
                path: 'products',
                match: { isActive: false, isDeleted: false }
            });

        let wishlistProducts = [];
        if (wishlist && wishlist.products) {
            wishlistProducts = wishlist.products.filter(product => product !== null);
        }

        res.render('user/wishList', {
            user: req.session.user,
            wishlistProducts,
            cloudName,
            wishlistCount: wishlistProducts.length
        });

    } catch (error) {
        console.error("Wishlist page error:", error);
        next(error);
    }
};

const addWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        let wishlist = await wishlistSchema.findOne({ user: userId });

        if (!wishlist) {
            wishlist = new wishlistSchema({
                user: userId,
                products: [productId]
            });
            await wishlist.save();

            await User.findByIdAndUpdate(userId, { wishlist: wishlist._id });
            return res.status(200).json({ success: true, message: "Product added to wishlist" });
        }

        if (wishlist.products.includes(productId)) {
            return res.status(400).json({ success: false, message: "Already in wishlist" });
        }

        wishlist.products.push(productId);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });

    } catch (error) {
        console.error("Add to wishlist error:", error);
        next(error);
    }
};

const removeFromWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        const wishlist = await wishlistSchema.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        const productIndex = wishlist.products.indexOf(productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not in wishlist" });
        }

        wishlist.products.splice(productIndex, 1);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product removed from wishlist" });

    } catch (error) {
        console.error("Remove from wishlist error:", error);
        next(error);
    }
};

const clearWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const wishlist = await wishlistSchema.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        wishlist.products = [];
        await wishlist.save();

        res.status(200).json({ success: true, message: "Wishlist cleared successfully" });

    } catch (error) {
        console.error("Clear wishlist error:", error);
        next(error);
    }
};

module.exports = {
    getWishList,
    addWishlist,
    removeFromWishlist,
    clearWishlist
};
