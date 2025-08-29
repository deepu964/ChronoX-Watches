const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'product' },
        variantId: mongoose.Schema.Types.ObjectId,  
        price: { type: Number },
        quantity: { type: Number, default: 1 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Cart', cartSchema);
