

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const addressSchema = new Schema({
    house: { type: String, required: true },
    street: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    pincode: { type: String, required: true },
    phone: { type: String, required: true }
}, { _id: false });

const userSchema = new Schema({
    fullname: {
        type: String,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    mobile: {
        type: String,
        sparse:true,
        default:null,
        trim: true
    },
    googleId:{
        type:String,
        unique:true,
        sparse:true,
    },
    password: {
        type: String,
        required: false
    },
    addresses: [addressSchema], 
    resetToken: String,
    resetTokenExpr: Date,
    
    isEmailVerified: {
        type: Boolean,
        default: false
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    lastLogin: {
        type: Date
    },
    cart: [
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    quantity: Number,
    price: Number         
  }
]
});

const User = mongoose.model('User', userSchema);


module.exports = User;