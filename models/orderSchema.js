const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [{
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
    quantity: Number,
    variantIndex: Number,
    price: Number,
    discount: Number,
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
  paymentMethod: { type: String, enum: ['COD', 'ONLINE'] },
  razorpayOrderId: { type: String },
  paymentId: { type: String },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed'],
    default: 'Pending'
  },
  isPaid: { type: Boolean, default: false },
  status: {
    type: String,
    enum: ['Placed', 'Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Failed'],
    default: 'Placed'
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);

