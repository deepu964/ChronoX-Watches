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
    isDefault: {
    type: Boolean,
    default: false
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required:true
    }
});

module.exports = mongoose.model('Address', addressSchema);
