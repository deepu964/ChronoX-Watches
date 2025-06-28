const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
    quantity: Number,
    variantIndex: Number,
    price: Number,
    discount: Number,
    paidPrice: Number,
    
    // ✅ 👇 NEW FIELD: discount share per item
    discountShare: Number, // 👈 required for coupon refund calculation

    status: {
      type: String,
      enum: ['Placed', 'Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
      default: 'Placed'
    },
    cancelledAt: { type: Date },
    cancelReason: { type: String }
  }],
  address: {
    fullName: String,
    phone: String,
    addressLine: String,
    city: String,
    pincode: String,
    state: String,
  },
  totalAmount: Number,

  // ✅ 👇 NEW FIELD: total before applying coupon (original cart total)
  totalBeforeDiscount: Number, // 👈 used to split coupon across items

  // ✅ 👇 These were already correct, just rename & adjust
  couponMinAmount: Number, // 👈 required to check if coupon still valid after cancellation
  coupon: {
    type: String,       // 👈 example: "WELCOME10"
    code: String,       // optional extra (can remove this if using above field)
    
    // ✅ 👇 Renamed properly
    discountAmount: Number // 👈 total discount applied
  },

  shippingFee: Number,
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['COD', 'ONLINE'] },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending'
  },
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  status: {
    type: String,
    enum: ['Placed', 'Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'],
    default: 'Placed'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
