const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  items: [
    {
      product: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
      quantity: Number,
      variantIndex: Number,
      price: Number,
      discount: Number,
      paidPrice: Number,
      discountShare: Number,
      
      // Snapshot data at the time of order placement
      productSnapshot: {
        name: String,
        description: String,
        brand: String,
        model: String,
        images: [{
          public_id: String,
          url: String,
          isMain: { type: Boolean, default: false }
        }],
        categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
        categoryName: String,
        variant: {
          regularPrice: Number,
          salePrice: Number,
          originalQuantity: Number // quantity available at time of order
        }
      },
      
      // Pricing snapshot at time of order
      pricingSnapshot: {
        regularPrice: Number,
        salePrice: Number,
        productOffer: Number,
        categoryOffer: {
          name: String,
          discount: Number,
          discountAmount: Number
        },
        bestOffer: Number,
        finalPrice: Number
      },

      status: {
        type: String,
        enum: [
          'Placed',
          'Pending',
          'Shipped',
          'Out for Delivery',
          'Delivered',
          'Cancelled',
        ],
        default: 'Placed',
      },
      cancelledAt: { type: Date },
      cancelReason: { type: String },
    },
  ],
  address: {
    fullName: String,
    phone: String,
    addressLine: String,
    city: String,
    pincode: String,
    state: String,
  },
  addressId: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  totalAmount: Number,

  totalBeforeDiscount: Number,

  couponMinAmount: Number,
  coupon: {
    code: { type: String },
    discountAmount: { type: Number, default: 0 },
    maxDiscount: { type: Number, default: 0 },
  },
  
  // Coupon snapshot at time of order
  couponSnapshot: {
    name: String,
    couponcode: String,
    discount: Number,
    minPurchase: Number,
    discountAmount: Number,
    appliedAt: { type: Date, default: Date.now }
  },
  shippingFee: Number,
  isPaid: { type: Boolean, default: false },
  paymentMethod: { type: String, enum: ['COD', 'ONLINE', 'Wallet'] },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Failed'],
    default: 'Pending',
  },
  regularPrice: Number,
  razorpayOrderId: { type: String },
  razorpayPaymentId: { type: String },
  status: {
    type: String,
    enum: [
      'Placed',
      'Pending',
      'Shipped',
      'Out for Delivery',
      'Delivered',
      'Cancelled',
    ],
    default: 'Placed',
  },
  createdAt: { type: Date, default: Date.now },
});



orderSchema.index(
  { user: 1, status: 1, isPaid: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'Pending', isPaid: false }
  }
);

module.exports = mongoose.model('Order', orderSchema);
