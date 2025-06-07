const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  fullName: String,
  phone: String,
  pincode: String,
  city: String,
  state: String,
  house: String,
  area: String,
  landmark: String,
  type: String 
}, { timestamps: true });

module.exports = mongoose.model('Address', addressSchema);
