const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['credit', 'debit'],
        required: true
    },
    amount: {
        type: Number,
        required: true,
        min: 0
    },
    description: {
        type: String,
        required: true
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order',
        default: null
    },
    returnRequestId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ReturnRequest',
        default: null
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, { _id: true });

const walletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true
    },
    balance: {
        type: Number,
        default: 0,
        min: 0
    },
    transactions: [transactionSchema],
    isActive: {
        type: Boolean,
        default: true
    }
}, { 
    timestamps: true 
});

// Method to add money to wallet
walletSchema.methods.addMoney = function(amount, description, orderId = null, returnRequestId = null) {
    this.balance += amount;
    this.transactions.push({
        type: 'credit',
        amount: amount,
        description: description,
        orderId: orderId,
        returnRequestId: returnRequestId
    });
    return this.save();
};

// Method to deduct money from wallet
walletSchema.methods.deductMoney = function(amount, description, orderId = null) {
    if (this.balance < amount) {
        throw new Error('Insufficient wallet balance');
    }
    this.balance -= amount;
    this.transactions.push({
        type: 'debit',
        amount: amount,
        description: description,
        orderId: orderId
    });
    return this.save();
};

// Method to get transaction history
walletSchema.methods.getTransactionHistory = function(limit = 10, skip = 0) {
    return this.transactions
        .sort({ createdAt: -1 })
        .slice(skip, skip + limit);
};

module.exports = mongoose.model('Wallet', walletSchema);
