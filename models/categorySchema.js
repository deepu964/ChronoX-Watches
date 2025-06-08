
const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },

  offer: {
    type: Number,
    default: 0
  },
  description: {
    type: String,
    default: ''
  },
  addedDate: {
    type: Date,
    default: Date.now
  },
  isListed: {
    type: Boolean,
    default: true
  },
  isDeleted:{
    type:Boolean,
    default:false
  }
});

module.exports = mongoose.model('Category', categorySchema);
