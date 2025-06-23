const mongoose = require('mongoose');

const categoryOfferSchema = new mongoose.Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: true
  },
  offerName: {
    type: String,
    required: true,
    trim: true
  },
  discount: {
    type: Number,
    required: true,
    min: 1,
    max: 99
  },
  startDate: {
    type: Date,
    required: true
  },
  endDate: {
    type: Date,
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active'
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
 
}, {
  timestamps: true
});


categoryOfferSchema.index({ category: 1, status: 1 });
categoryOfferSchema.index({ startDate: 1, endDate: 1 });


categoryOfferSchema.virtual('isCurrentlyActive').get(function() {
  const now = new Date();
  return this.status === 'Active' && 
         this.startDate <= now && 
         this.endDate >= now && 
         !this.isDeleted;
});

module.exports = mongoose.model('CategoryOffer', categoryOfferSchema);
