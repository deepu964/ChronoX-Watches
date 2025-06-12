const mongoose = require('mongoose');

const returnItemSchema = new mongoose.Schema({
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
            'Quality Issues',
            'Other'
        ]
    },
    condition: {
        type: String,
        required: true,
        enum: ['Unopened', 'Opened but Unused', 'Used', 'Damaged']
    },
    images: [{
        public_id: String,
        url: String
    }]
}, { _id: true });

const returnRequestSchema = new mongoose.Schema({
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
    items: [returnItemSchema],
    totalRefundAmount: {
        type: Number,
        required: true,
        min: 0
    },
    status: {
        type: String,
        enum: [
            'Pending',           // Initial status when request is created
            'Under Review',      // Admin is reviewing the request
            'Approved',          // Request approved, waiting for product return
            'Rejected',          // Request rejected by admin
            'Product Received',  // Product received by admin
            'Refund Processed',  // Money refunded to wallet
            'Completed',         // Return process completed
            'Cancelled'          // Cancelled by user
        ],
        default: 'Pending'
    },
    requestReason: {
        type: String,
        required: true,
        maxlength: 500
    },
    adminNotes: {
        type: String,
        maxlength: 1000
    },
    refundMethod: {
        type: String,
        enum: ['Wallet', 'Original Payment Method'],
        default: 'Wallet'
    },
    isRefunded: {
        type: Boolean,
        default: false
    },
    refundedAt: {
        type: Date
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'admin'
    },
    reviewedAt: {
        type: Date
    },
    returnDeadline: {
        type: Date,
        default: function() {
            // 7 days from creation for return
            return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        }
    },
    pickupAddress: {
        fullName: String,
        phone: String,
        addressLine: String,
        city: String,
        pincode: String,
        state: String
    },
    trackingInfo: {
        trackingNumber: String,
        courierService: String,
        estimatedDelivery: Date
    }
}, { 
    timestamps: true 
});

// Index for efficient queries
returnRequestSchema.index({ user: 1, createdAt: -1 });
returnRequestSchema.index({ order: 1 });
returnRequestSchema.index({ status: 1 });

// Virtual for checking if return is eligible
returnRequestSchema.virtual('isEligible').get(function() {
    const now = new Date();
    const orderDate = this.order.createdAt || this.createdAt;
    const daysSinceOrder = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));
    return daysSinceOrder <= 7; // 7 days return policy
});

// Method to calculate refund amount
returnRequestSchema.methods.calculateRefundAmount = function() {
    return this.items.reduce((total, item) => {
        return total + (item.price * item.quantity);
    }, 0);
};

// Method to update status with timestamp
returnRequestSchema.methods.updateStatus = function(newStatus, adminId = null, notes = null) {
    this.status = newStatus;
    if (adminId) {
        this.reviewedBy = adminId;
        this.reviewedAt = new Date();
    }
    if (notes) {
        this.adminNotes = notes;
    }
    return this.save();
};

// Pre-save middleware to calculate total refund amount
returnRequestSchema.pre('save', function(next) {
    if (this.isModified('items')) {
        this.totalRefundAmount = this.calculateRefundAmount();
    }
    next();
});

module.exports = mongoose.model('ReturnRequest', returnRequestSchema);
