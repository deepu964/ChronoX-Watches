const mongoose = require('mongoose');

const returnSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    price: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      required: true
    }
  }],
  totalRefundAmount: {
    type: Number,
    required: true,
    min: 0
  },
  reason: {
    type: String,
    required: true,
    enum: [
      'Defective Product',
      'Wrong Item Received',
      'Size/Color Issue',
      'Product Not as Described',
      'Damaged During Shipping',
      'Changed Mind',
      'Other'
    ]
  },
  description: {
    type: String,
    maxlength: 500
  },
  status: {
    type: String,
    enum: ['Requested', 'Under Review', 'Approved', 'Rejected', 'Refunded'],
    default: 'Requested'
  },
  refundMethod: {
    type: String,
    enum: ['Cash', 'Original Payment Method'],
    default: 'Cash'
  },
  adminNotes: {
    type: String,
    maxlength: 500
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'admin'
  }
}, {
  timestamps: true
});


returnSchema.index({ user: 1, status: 1 });
returnSchema.index({ order: 1 });
returnSchema.index({ status: 1, requestedAt: -1 });

module.exports = mongoose.model('Return', returnSchema);
