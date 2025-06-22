const couponSchema = require('../../models/couponSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');

const applyCoupon = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { code, grandTotal } = req.body;

    const coupon = await couponSchema.findOne({
      couponcode: code.trim().toUpperCase(),
      isActive: true
    });
    

    if (!coupon) {
      return res.json({ success: false, message: "Invalid coupon" });
    }

    if (new Date(coupon.expiryDate) < new Date()) {
      return res.json({ success: false, message: "Coupon expired" });
    }

    if (coupon.user.includes(userId)) {
      return res.json({ success: false, message: "You already used this coupon" });
    }

    if (grandTotal < coupon.minPurchase) {
      return res.json({
        success: false,
        message: `Minimum purchase of ₹${coupon.minPurchase} required`
      });
    }

    const discountAmount = Math.round((grandTotal * coupon.discount) / 100);
    const minPurchase = coupon.minPurchase;
    
    // coupon.user.push(userId);
    // await coupon.save();

    req.session.coupon = {
      couponcode: coupon.couponcode,
      discountAmount,
      minPurchase
    };

    return res.json({ success: true, discountAmount });
  } catch (err) {
    console.log("Error applying coupon:", err);
    next(err);
  }
};

const removeCoupon = async (req, res, next) => {
  try {
    const userId = req.session.user?._id;
    if (!userId) {
      return res.json({ success: false, message: "User not logged in" });
    }

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.json({ success: false, message: "User not found" });
    }

    const coupon = req.session.coupon;

    if (!coupon) {
      return res.json({ success: false, message: "No coupon to remove" });
    }

    const existCoupon = await couponSchema.findOne({
      couponcode: coupon.couponcode,
      isActive: true
    });


    if (!existCoupon) {
      return res.json({ success: false, message: "Coupon not found or inactive" });
    }

    await couponSchema.findOneAndUpdate(
      { couponcode: coupon.couponcode, isActive: true },
      { $pull: { user: userId } }
    );


    delete req.session.coupon;

    return res.json({ success: true, message: "Coupon removed successfully" });

  } catch (error) {
    console.log("remove coupon error", error);
    next(error);
  }
};






module.exports = {
  applyCoupon,
  removeCoupon
}
