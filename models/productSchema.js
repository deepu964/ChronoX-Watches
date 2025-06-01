const mongoose = require('mongoose');
const { stringify } = require('uuid');

const variantSchema = new mongoose.Schema({
  regularPrice: { type: Number,},
  salePrice: { type: Number },
  quantity: { type: Number },
}, { _id: false });

const reviewSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  rating: Number,
  comment: String,
  createdAt: { type: Date, default: Date.now }
});


const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  description: {
    type: String
  },
  additionalInfo: {
    type: String
  },

  categoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
  },
  brand: String,
  offer: Number,
  model: {
    type: String
  },

  images: [{
    public_id: { type: String, required: true },
    isMain: { type: Boolean, default: false }
  }],

  
  discountPercentage: Number,

  reviews: [reviewSchema],


  isDeleted: {
    type: Boolean,
    default: false
  },

  isActive: {
    type: Boolean,
    default: true
  },
  variants: [variantSchema],

}, { timestamps: true });

productSchema.pre('save', function (next) {
  if (!this.images || this.images.length === 0) {
    next(new Error('At least one image is required'));
  }
  next();
});


module.exports = mongoose.model('product', productSchema);

