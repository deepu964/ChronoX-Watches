const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('mongodb connected succesfully');
  } catch (error) {
    console.error('Mongodb Connection Error', error);
    process.exit(1);
  }
};

module.exports = connectDB;
