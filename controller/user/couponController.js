const couponSchema = require('../../models/couponSchema');
const Cart = require('../../models/cartSchema');

const applyCoupon = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { code, grandTotal } = req.body;

    console.log("Code:", code, "Grand Total:", grandTotal);

    const coupon = await Coupon.findOne({
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

    req.session.coupon = {
      couponcode: coupon.couponcode,
      discountAmount
    };

    console.log("Session Coupon Set:", req.session.coupon);

    return res.json({ success: true, discountAmount });
  } catch (err) {
    console.log("Error applying coupon:", err);
    next(err);
  }
};


module.exports={
    applyCoupon,
}
