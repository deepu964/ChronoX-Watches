

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

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
    }
});

const User = mongoose.model('User', userSchema);


module.exports = User;