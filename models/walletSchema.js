const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['credit', 'debit'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  description: {
    type: String,
    required: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
  },
  returnId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Return',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const walletSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    balance: {
      type: Number,
      default: 0,
      min: 0,
    },
    transactions: [transactionSchema],
  },
  {
    timestamps: true,
  }
);

walletSchema.methods.addMoney = function (
  amount,
  description,
  orderId = null,
  returnId = null
) {
  this.balance += amount;
  this.transactions.push({
    type: 'credit',
    amount,
    description,
    orderId,
    returnId,
  });
  return this.save();
};

walletSchema.methods.deductMoney = function (
  amount,
  description,
  orderId = null
) {
  if (this.balance < amount) {
    throw new Error('Insufficient wallet balance');
  }
  this.balance -= amount;
  this.transactions.push({
    type: 'debit',
    amount,
    description,
    orderId,
  });
  return this.save();
};

module.exports = mongoose.model('Wallet', walletSchema);
