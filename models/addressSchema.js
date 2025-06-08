const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    fullName: String,
    email: String,
    phone: String,
    addressType: String,
    address: String,
    district: String,
    state: String,
    city: String,
    pinCode: String,
    landmark: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
});

module.exports = mongoose.model('Address', addressSchema);
