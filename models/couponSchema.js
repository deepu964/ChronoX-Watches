const mongoose = require('mongoose');

function generateCouponCode() {
  const length = 8;
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let couponCode = '';
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    couponCode += characters.charAt(randomIndex);
  }
  return couponCode;
}

const couponSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    couponcode: {
      type: String,
      uppercase: true,
      unique: true,
      default: generateCouponCode,
      required: true,
    },
    discount: {
      type: Number,
      required: true,
      min: 0,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    minPurchase: {
      type: Number,
      required: true,
      min: 0,
    },
    user: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);
module.exports = mongoose.model('Coupon', couponSchema);
