

const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const categorySchema = require('../../models/categorySchema')
const addressSchema = require('../../models/addressSchema');
const productSchema = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema')
const WishList = require('../../models/wishlistSchema')
const Return = require('../../models/returnSchema')
const Wallet = require('../../models/walletSchema')
const generateOtp = require('../../utils/generateOtp');
const sendOtpEmail = require('../../utils/sendOtpEmail');
const sendResetPass = require('../../utils/sendResetPass');
const mongoose = require('mongoose')
const errorMiddleware = require('../../middlewares/errorMiddleware');
const crypto = require('crypto');
const path = require('path');
const { session } = require('passport');
const wishlistSchema = require('../../models/wishlistSchema');


const getLoadHomePage = async (req, res) => {
    try {

        const category = await categorySchema.find({ isListed: true });
        const products = await productSchema.find({ isActive: false })
        const user = req.session.user
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        res.render('user/home', {
            user, products, cloudName,
            category

        });
    } catch (error) {
        console.error("Home page error:", error);
        return res.render('user/page-404')
    }
};

const PageNotFound = (req, res) => {
    try {
        res.status(404).render('user/404');
    } catch (error) {
        console.error("404 page error:", error);
        res.status(404).send("Page Not Found");
    }
};


const loginPage = (req, res) => {
    try {

        if (req.session.user) {
            return res.redirect('/');
        }
        const passChange = req.query.params
        const message = req.query.message || '';
        const blocked = req.query.blocked || '';
        res.render('user/login', { message, blocked, passChange });
    } catch (error) {
        console.error("Login page error:", error);
        res.status(500).send("Internal Server Error");
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.redirect('/login?message= Email And Password  is required');
        }

        const user = await User.findOne({ email });
        if (!user) {
            return res.redirect('/login?message=User not found');
        }




        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.redirect('/login?message=Invalid email or password');
        }


        req.session.user = {
            _id: user._id,
            email: user.email,
            fullname: user.fullname
        };
        return res.redirect('/');

    } catch (error) {
        console.error("Login error:", error);
        return res.redirect('/login?message=Login failed. Please try again.');
    }
};

const logout = async (req, res) => {
    // req.session.destroy((err)=>{   
    //     if(err){
    //         console.log(err);
    //         return res.redirect('/page-404')
    //     }
    // })
    req.session.user = null;

    res.clearCookie('connect.sid');
    return res.redirect('/login');
}

const getforgotPass = async (req, res) => {
    try {

        const error1 = req.query.error1 || '';
        res.render('user/forgot-pass', { error1 });
    } catch (error) {
        next(error);
    }

}

const forgotPass = async (req, res) => {
    try {
        const { email } = req.body
        if (!email) {
            return res.redirect('/forgotpassword?error=Email%20is%20reqiured')
        }
        const user = await User.findOne({ email })

        if (!user) {
            return res.redirect('/forgotpassword?error=User%20not%20found')
        }
        if (email.toLowerCase() !== user.email.toLowerCase()) {
            return res.redirect('/forgotpassword?error=Email%20not%20exist')
        }

        const token = crypto.randomBytes(32).toString("hex")

        user.resetToken = token;
        user.resetTokenExpr = new Date() + 3600000
        await user.save()

        const resetLink = `http://localhost:3001/newPass/${token}`;

        await sendResetPass(email, resetLink)

        res.send("check your email for reset link");
    } catch (error) {
        console.log(error);
        res.status(500).send("Something went wrong");
    }


}

const getNewPass = async (req, res) => {
    try {
        const { token } = req.params;
        console.log(token, 'new get pass')

        res.render('user/newPass', { token });

    } catch (error) {
        console.log(error, "user not exist");
    }
}


const newPass = async (req, res) => {

    const { token } = req.params;
    const { password, confirm } = req.body;
    console.log(token, "post token");
    try {
        const user = await User.findOne({ resetToken: token })
        console.log(user, 'this is user');
        if (!user) {
            return res.json({ success: false, message: "Invalid or Expired token." });

        }

        if (password !== confirm) {
            return res.json({ success: false, message: "Passwords do not match" });
        }
        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(hashedPassword, "hashed");
        user.password = hashedPassword;
        user.resetToken = undefined;
        user.resetTokenExpr = undefined;

        await user.save();
        console.log("saved")

        return res.redirect('/login?passChange=password chnaged')

    } catch (error) {
        res.status(500).json({ message: "server error" });
    }
}

const signUpPage = (req, res) => {
    try {

        if (req.session.user) {
            return res.redirect('/');
        }
        const message = req.query.message || '';
        const error2 = req.query.error2 || '';

        res.render('user/signup', { message, error2 });
    } catch (error) {
        console.error("Signup page error:", error);
        res.status(500).send("Internal Server Error");
    }
};


const signUp = async (req, res) => {
    try {
        const { fullname, email, mobile, password } = req.body;



        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.redirect('/signup?error2=User already exists with this email');
        }


        const existingMobile = await User.findOne({ mobile });
        if (existingMobile) {
            return res.redirect('/signup?message=User already exists with this mobile number');
        }


        const hashedPassword = await bcrypt.hash(password, 10);


        const otp = generateOtp();

        const otpExpr = Date.now() + 1 * 60 * 1000;
        console.log(otp)

        await sendOtpEmail(email, otp)

        req.session.tempUser = {
            fullname,
            email,
            mobile,
            password: hashedPassword,
            otp,
            otpExpr
        };

        return res.redirect('/verify-otp');

    } catch (error) {
        console.error("Signup error:", error);
        return res.redirect('/signup?message=Signup failed: ' + error.message);
    }
};


const getVerifyOtp = (req, res) => {
    try {


        if (!req.session.tempUser) {
            return res.redirect('/signup?message=Session expired. Please sign up again.');
        }
        const otpExpr = req.session.tempUser.otpExpr

        const message = req.query.message || '';
        res.render('user/verify-otp', {
            message,
            email: req.session.tempUser.email,
            otpExpr
        });
    } catch (error) {
        console.error("OTP page error:", error);
        res.status(500).send("Internal Server Error");
    }
};


const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        console.log("Received OTP:", otp);

        const sessionUser = req.session.tempUser;
        console.log("Session User:", sessionUser);
        if (!sessionUser) {
            return res.redirect('/signup?message=Session expired. Please sign up again.');
        }

        console.log("Session OTP:", sessionUser.otp);
        console.log("Submitted OTP:", otp);


        if (new Date() > sessionUser?.otpExpr) {
            delete sessionUser.otp
            return res.redirect('/verify-otp?message=OTP expired . Please try again.');
        }


        if (String(otp).trim() !== String(sessionUser.otp).trim()) {
            return res.redirect('/verify-otp?message=Invalid OTP. Please try again.');
        }


        if (sessionUser.userId) {

            await User.findByIdAndUpdate(sessionUser.userId, { isVerified: true });


            req.session.user = {
                _id: sessionUser.userId,
                email: sessionUser.email,
                fullname: sessionUser.fullname
            };

            delete req.session.tempUser;
            return res.redirect('/?message=Account created successfully');
        } else {

            const newUser = new User({
                fullname: sessionUser.fullname,
                email: sessionUser.email,
                password: sessionUser.password,
                mobile: sessionUser.mobile,
                isVerified: true
            });

            const savedUser = await newUser.save();



            req.session.user = {
                _id: savedUser._id,
                email: savedUser.email,
                fullname: savedUser.fullname
            };

            delete req.session.tempUser;
            return res.redirect('/?message=Account created successfully');
        }

    } catch (error) {
        console.error("OTP verification error:", error);
        return res.redirect('/verify-otp?message=Verification failed: ' + error.message);
    }
};


const resendOtp = async (req, res) => {

    try {
        const sessionUser = req.session.tempUser;

        const email = sessionUser.email


        if (!sessionUser) {
            return res.status(400).json({
                success: false,
                message: 'Session expired. Please sign up again.'
            });
        }


        const newOtp = generateOtp();
        const newotpExpr = new Date() + 1 * 60 * 1000;
        console.log(newOtp);

        req.session.tempUser.otp = newOtp;
        req.session.tempUser.otpExpr = newotpExpr;

        await sendOtpEmail(email, newOtp)
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully to your email'
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(500).json({
            success: false,
            message: 'Failed to resend OTP: ' + error.message
        });
    }
};

const getShopPage = async (req, res) => {
    try {
        const {
            search = "",
            categoryId: categoryFilter = [],
            sortBy
        } = req.query;



        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        const categories = await categorySchema.find({ isListed: true });

        let filter = { isActive: false };


        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { model: { $regex: search, $options: 'i' } }
            ];
        }


        let categoryIds = categoryFilter;
        if (!Array.isArray(categoryIds)) {
            categoryIds = categoryIds ? [categoryIds] : [];
        }
        if (categoryIds.length > 0) {
            categoryIds = categoryIds.map(id => new mongoose.Types.ObjectId(id));
            filter.categoryId = { $in: categoryIds };
        }
        const totalProduct = await productSchema.countDocuments(filter);
        const totalPage = Math.ceil(totalProduct / limit);

        let products;

        if (sortBy === 'price-asc' || sortBy === 'price-desc') {
            const sortDirection = sortBy === 'price-asc' ? 1 : -1;

            products = await productSchema.aggregate([
                { $match: filter },
                {
                    $addFields: {
                        finalPrice: {
                            $min: {
                                $map: {
                                    input: "$variants",
                                    as: "variant",
                                    in: { $ifNull: ["$$variant.salePrice", "$$variant.regularPrice"] }
                                }
                            }
                        }
                    }
                },
                { $sort: { finalPrice: sortDirection } },
                { $skip: skip },
                { $limit: limit }
            ]);


            for (let i = 0; i < products.length; i++) {
                const category = await categorySchema.findById(products[i].categoryId).lean();
                products[i].categoryId = category;
            }
        } else {

            let sortOption = { createdAt: -1 };

            if (sortBy === 'name-asc') {
                sortOption = { categoryId: 1, name: 1 };
            } else if (sortBy === 'name-desc') {
                sortOption = { categoryId: 1, name: -1 };
            }

            products = await productSchema.find(filter)
                .populate({
                    path: "categoryId",
                    model: 'Category',
                    match: { isListed: true }
                })
                .sort(sortOption)
                .skip(skip)
                .limit(limit)
                .lean();
        }

        // Get user's wishlist for displaying wishlist status
        let userWishlist = [];
        if (req.session.user) {
            const wishlist = await wishlistSchema.findOne({ user: req.session.user._id });
            if (wishlist && wishlist.products.length > 0) {
                userWishlist = wishlist.products.map(p => p.toString());
            }
        }

        res.render('user/shops', {
            user: req.session.user,
            products,
            cloudName,
            query: req.query,
            categories,
            categoryFilter: categoryIds,
            currentPage: page,
            totalPage,
            userWishlist
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.status(500).send("Server error");
    }
};


const getProductDetails = async (req, res) => {
    try {
        const id = req.params.id
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const product = await productSchema.findById(id)
        const products = await productSchema.find()
        const productLength = 4
        const description = await productSchema.find()

        res.render('user/details', {
            user: req.session.user,
            product,
            cloudName,
            products,
            productLength,
            description

        })
    } catch (error) {
        console.log(error)
    }
}



const getUserProfile = async (req, res, next) => {
    try {
        const userId = req.session.user;

        const user = await User.findById(userId);
        //  const orders = await Order.find({ userId }).sort({ createdAt: -1 });

        res.render('user/userProfile', { user });
    } catch (error) {
        next(error);
    }
}

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        const { name, email, mobile } = req.body;
        
        const existUser = await User.findById(userId);
        if (!existUser) {
            return res, json({
                success: false,
                message: "user not found"
            })
        }
        await User.findByIdAndUpdate(userId, {
            fullname:name,
            email,
            mobile
        }, { new: true });
        return res.json({
            success: true,})

    } catch (error) {
        next(error);
    }
}

const verifyChangeEmail = async (req, res, next) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp == req.session.userOtp) {
            res.redirect('/')
        }
    } catch (error) {
        next(error);
    }
}

const changeEmail = async (req, res, next) => {
    try {
        
        const { name,mobile } = req.body;
        
        const email = req.body.newEmail;
        
        const userId = req.session.user._id;
        
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            
            return res.status(400).json({ success: false, message: 'Email already exists' });
        }
        console.log('checkpoint 1');

        const otp = generateOtp();
        console.log("Generated OTP:", otp);
        const otpExpr = Date.now() + 1 * 60 * 1000;

        await sendOtpEmail(email, otp);

        req.session.userOtp = otp;
        req.session.emailChange = { 
            userId, 
            email, 
            otpExpr, 
            name, 
            mobile 
        };

        return res.status(200).json({ success: true, message: 'OTP sent to your new email' });

    } catch (error) {
        next(error);
    }
}

const getChangeEmailOtp = (req, res) => {
    try {
        
        if (!req.session.emailChange) {
            return res.redirect('/userProfile?message=Session expired. Please try again.');
        }
        
        const { email } = req.session.emailChange;
        const otpExpr = req.session.emailChange.otpExpr;
        
        req.session.tempUser = {email,otp: req.session.userOtp,};
       res.render('user/changeEmailOtp', { 
            email, 
            otpExpr,
            query: req.query  
        });
    } catch (error) {
        console.error("Change email OTP page error:", error);
        res.status(500).send("Internal Server Error");
    }
}

const verifyChangeEmailOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionData = req.session.emailChange;

        if (!sessionData) {
            return res.redirect('/userProfile?message=Session expired. Please try again.');
        }


        if (String(otp).trim() !== String(req.session.userOtp).trim()) {
            
            return res.redirect('/profile/otp-sent?message=Invalid OTP. Please try again.');
        }

        await User.findByIdAndUpdate(sessionData.userId, {
            email: sessionData.email,
            fullname: sessionData.name,
            mobile: sessionData.mobile
        });

        delete req.session.emailChange;
        delete req.session.userOtp;

        return res.redirect('/userProfile?message=Email changed successfully');
    } catch (error) {
        console.error("Change email OTP verification error:", error);
        return res.redirect('/profile/otp-sent?message=Verification failed: ' + error.message);
    }   
}


const changePassword =async (req,res,next) => {
    try {
        const userId = req.session.user._id;
        const { currentPassword, newPassword, confirmPassword } = req.body;
       console.log("userId",userId);
       console.log("req.body",req.body);
      const existsUser = await User.findById(userId);
      if(!existsUser){
        console.log("user not found");
        return res.status(400).json({success:false,message:"user not found"})
      } 
console.log("checkpoint 0");
      if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }
console.log("checkpoint 1");
      const passwordMatch = await bcrypt.compare(currentPassword, existsUser.password);
      if (!passwordMatch) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }
console.log("checkpoint 2");
        
        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
        }
        console.log("checkpoint 3");
      existsUser.password = await bcrypt.hash(newPassword, 10);
      await existsUser.save();
      console.log("existsUser",existsUser);
        return res.status(200).json({ success: true, message: 'Password changed successfully' });


    } catch (error) {
        next(error);
    }
    
}

const getAddress = async (req, res, next) => {
    try {
        if(!req.session.user) {
            return res.redirect('/login?message=Please login to view your address');
        }
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        const addresses = await addressSchema.find({ userId: userId }).lean();
        res.render('user/address',{user,addresses});
    } catch (error) {
        next(error);    
    }
}
const getAddAddress = async (req, res, next) => {
    try {
        const user = req.session.user._id;
        res.render('user/addAddress',{ user });
      

    } catch (error) {
        next(error);
    }
}
    
const addAddress = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
       
        const {fullName, phone, pinCode, city, state, district, address, landmark, addressType } = req.body;

        const newAddress = new addressSchema({ 
            userId,
            fullName,
            phone,
            pinCode,
            city,
            state,
            district,
            address,
            landmark,
            addressType
        });
        await newAddress.save();
        return res.status(200).redirect('/address?message=Address added successfully');
    } catch (error) {
        next(error);
    }
}


const getEditAddress = async (req, res, next) => {
  try {
    const addressId = req.params.id;
    const address = await addressSchema.findById(addressId);
    if (!address) return res.status(404).send('Address not found');
    res.render('user/editAddress', {
         user: req.session.user,
        address });
  } catch (err) {
    next(err);
  }
};


const editAddress = async(req, res, next) => {
    try {
      const addressId = req.params.id;
      console.log("addressId",addressId);

        const { fullName, phone, pinCode, city, state, district, address, landmark, addressType } = req.body;
        console.log(req.body, "req.body in edit address");
        const currentAddress = await addressSchema.findById(addressId);
        if (!currentAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        let existingAddress = null;   
        if(fullName && fullName !== currentAddress.fullName) {
             existingAddress = await addressSchema.findOne({ 
                _id: { $ne: addressId },
                fullName: new RegExp(`^${fullName}$`, 'i')
            });
        }

        if(existingAddress){
            return res.status(400).json({ success: false, message: 'Address with this name already exists' });
        }

        await addressSchema.findByIdAndUpdate(addressId, {
            fullName,
            phone,
            pinCode,
            city,
            state,
            district,
            address,
            landmark,
            addressType
        });
        return res.status(200).json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        next(error);
    }
}

const deleteAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        console.log("addressId",addressId);

        const address = await addressSchema.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        await addressSchema.findByIdAndDelete(addressId);
        return res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        next(error);
    }
}

const getWishList = async (req, res, next) => {
  try {
    const userId = req.session.user?._id;
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    if (!userId) {
      return res.redirect('/login');
    }

    // Get user's wishlist with populated products
    const wishlist = await wishlistSchema.findOne({ user: userId })
      .populate({
        path: 'products',
        match: { isActive: false, isDeleted: false } // Only active, non-deleted products
      });

    let wishlistProducts = [];
    if (wishlist && wishlist.products) {
      // Filter out null products (in case some products were deleted)
      wishlistProducts = wishlist.products.filter(product => product !== null);
    }

    res.render('user/wishList', {
      user: req.session.user,
      wishlistProducts,
      cloudName,
      wishlistCount: wishlistProducts.length
    });

  } catch (error) {
    console.error("Wishlist page error:", error);
    next(error);
  }
};

const addWishlist = async (req,res,next) => {
    try {
        const userId = req.session.user._id;
        const {productId} = req.body;

        let wishlist = await wishlistSchema.findOne({user:userId});

        if (!wishlist) {
            wishlist = new wishlistSchema({
                user: userId,
                products: [productId]
            });
            await wishlist.save();

            await User.findByIdAndUpdate(userId, { wishlist: wishlist._id });
            return res.status(200).json({ success: true, message: "Product added to wishlist" });
        }

        if (wishlist.products.includes(productId)) {
            return res.status(400).json({ success: false, message: "Already in wishlist" });
        }

        wishlist.products.push(productId);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product added to wishlist" });

    } catch (error) {
        console.error("Add to wishlist error:", error);
        next(error);
    }
};

const removeFromWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { productId } = req.body;

        const wishlist = await wishlistSchema.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        const productIndex = wishlist.products.indexOf(productId);
        if (productIndex === -1) {
            return res.status(404).json({ success: false, message: "Product not in wishlist" });
        }

        wishlist.products.splice(productIndex, 1);
        await wishlist.save();

        res.status(200).json({ success: true, message: "Product removed from wishlist" });

    } catch (error) {
        console.error("Remove from wishlist error:", error);
        next(error);
    }
};

const clearWishlist = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const wishlist = await wishlistSchema.findOne({ user: userId });

        if (!wishlist) {
            return res.status(404).json({ success: false, message: "Wishlist not found" });
        }

        wishlist.products = [];
        await wishlist.save();

        res.status(200).json({ success: true, message: "Wishlist cleared successfully" });

    } catch (error) {
        console.error("Clear wishlist error:", error);
        next(error);
    }
};


const getCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean()

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.render('user/cart', {
        user: req.session.user,    
        items: [],
        totalMRP: 0,
        discount: 0,
        shippingFee: 0,
        grandTotal: 0,
        total: 0
      });
    }

    let total = 0;
let totalMRP = 0;
// let platformFee = 20;
let shippingFee = 50;

cart.items.forEach(item => {
  if (item.product.variants && item.product.variants.length > 0) {
    const variant = item.product.variants[0];
    const salePrice = variant.salePrice || variant.regularPrice;
    const regularPrice = variant.regularPrice;

    total += salePrice * item.quantity;
    totalMRP += regularPrice * item.quantity;
  }
});
console.log(totalMRP,"totalMRP")
const discount = totalMRP - total;
const grandTotal = total  + shippingFee;

    console.log(cart.items.map(item => item.product.images?.[0]?.public_id));
    res.render('user/cart', {
  user: req.session.user,
  items: cart.items,
  total,
  totalMRP,
  discount,
  shippingFee,
  grandTotal,
  cloudName: process.env.CLOUDINARY_CLOUD_NAME
});

  } catch (error) {
    next(error);
  }
};


const addToCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const productId = req.body.productId;

    const product = await productSchema.findById(productId).populate('categoryId');

    
    if (
      !product || 
      product.isActive || 
      !product.categoryId?.isListed || 
      product.isDeleted
    ) {
      return res.status(404).json({ success: false, message: 'Product is unavailable or blocked.' });
    }

    const maxQuantityAllowed = 5; 

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [] });
    }

    const existingItem = cart.items.find(item => item.product.toString() === productId);

    
    const stockQty = product.variants[0]?.quantity || 0;
    const itemPrice = product.variants[0]?.salePrice || product.variants[0]?.regularPrice
    console.log(itemPrice,"price")


    if (existingItem) {
      if (existingItem.quantity >= stockQty) {
        return res.status(400).json({ success: false, message: 'Cannot add more, stock limit reached.' });
      }
      if (existingItem.quantity >= maxQuantityAllowed) {
        return res.status(400).json({ success: false, message: `Cannot add more than ${maxQuantityAllowed} items.` });
      }
      existingItem.quantity += 1;
    } else {
      if (stockQty <= 0) {
        return res.status(400).json({ success: false, message: 'Product out of stock.' });
      }
      cart.items.push({ product: productId, quantity:1,price:itemPrice });
    }


    // Remove from wishlist when added to cart
    await wishlistSchema.updateOne(
      { user: userId },
      { $pull: { products: productId } }
    );

    await cart.save();

    return res.status(200).json({ success: true, message: 'Product added to cart successfully' });

  } catch (error) {
    next(error);
  }
};


const updateCartItem = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { productId, action } = req.body;
    console.log(req.body,'this is body ');

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    const item = cart.items.find(item => item.product.toString() === productId);
    if (!item) return res.status(404).json({ success: false, message: 'Product not found in cart' });

    const product = await productSchema.findById(productId).populate('categoryId');
    if (!product || product.isActive || !product.categoryId.isListed || product.isDeleted) {
      return res.status(400).json({ success: false, message: 'Product is unavailable or blocked' });
    }

    const totalStock = product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
    const MAX_QTY = 5;

    if (action === 'increase') {
  if (item.quantity >= MAX_QTY) {
    return res.status(400).json({ success: false, message: `Max ${MAX_QTY} quantity allowed` });
  }
  if (item.quantity >= totalStock) {
    return res.status(400).json({ success: false, message: 'Insufficient stock' });
  }
  item.quantity += 1;
  await cart.save();
  return res.json({ success: true, message: 'Quantity increased', quantity: item.quantity });
}

if (action === 'decrease') {
  if (item.quantity <= 1) {
    return res.status(400).json({ success: false, message: 'Minimum 1 quantity required' });
  } else {
    item.quantity -= 1;
    await cart.save();
    return res.json({ success: true, message: 'Quantity decreased', quantity: item.quantity });
  }
}

    return res.status(400).json({ success: false, message: 'Invalid action' });
  } catch (err) {
    next(err);
  }
};


const removeFromCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const productId = req.params.productId;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = cart.items.filter(item => item.product.toString() !== productId);
    await cart.save();

    res.json({ success: true, message: 'Product removed from cart' });
  } catch (err) {
    next(err);
  }
};


const emptyCart = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ user: userId });
    if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

    cart.items = [];
    await cart.save();

    res.json({ success: true, message: 'Cart emptied' });
  } catch (err) {
    next(err);
  }
};

const checkoutGetController = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const addresses = await addressSchema.find({ userId });
    const defaultAddress = addresses.find(addr => addr.isDefault);

    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();
    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    let subTotal = 0;

    const cartItems = cart.items.map(item => {
      const product = item.product;
      

      const variant = product.variants?.[0] || {};
      const price = variant.salePrice || variant.regularPrice || 0;
      
      const total = price * item.quantity;
      subTotal += total;

      return {
        _id: product._id,
        name: product.name,
        image: product.images?.[0]?.public_id  || '/images/default-product.jpg',
        quantity: item.quantity,
        price,
        total
      };
    });


    const shipping = 50;
    const discount = 0;

    const grandTotal = subTotal  + shipping - discount;

    res.render('user/checkOut', {
      user: req.session.user,
      addresses,
      defaultAddress,
      cartItems,
      subTotal,
      shipping,
      discount,
      grandTotal,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });

  } catch (error) {
    next(error);
  }
};

const addNewAddress = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    console.log(req.body,"thi isn body");
    const {
      fullName,
      phone,
      pinCode,
      city,
      state,
      district,
      address,
      landmark,
      isDefault,
    } = req.body;

    
    if (isDefault) {
      await addressSchema.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new addressSchema({
      userId,
      fullName,
      phone,
      pinCode,
      city,
      state,
      district,
      address,
      landmark,
      isDefault: !!isDefault, 
    });
    
    await newAddress.save();
    console.log(newAddress, "tisksdk") 
    res.status(200).json({
      success: true,
      message: "Address added successfully",
    });

   
  } catch (error) {
    next(error);
  }
};

const deleteCheckAddress = async (req,res,next) => {
    try {

       const addressId = req.params.id;
       await addressSchema.findByIdAndDelete(addressId);
       res.status(200).json({success:true,message:"Address deleted successfull"});

    } catch (error) {
        next(error);
    }
    
}


const getPayment = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.query.addressId;

    if (!addressId || addressId === 'undefined') {
      return res.json({ success: false, message: "Please select a valid address" });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    let subTotal = 0;
    let totalDiscount = 0;

    const cartItems = cart.items.map(item => {
      const product = item.product;
      const variant = product.variants?.[0] || {};

      const regularPrice = variant.regularPrice || 0;
      const salePrice = variant.salePrice || regularPrice;

      const quantity = item.quantity;
      const price = regularPrice;
      const total = price * quantity;

      const itemDiscount = (regularPrice - salePrice) * quantity;
      totalDiscount += itemDiscount;

      subTotal += total;

      return {
        _id: product._id,
        name: product.name,
        image: product.images?.[0]?.public_id || null,
        quantity,
        price,
        total,
        regularPrice,
        salePrice,
        itemDiscount
      };
    });

    const shipping = 50;
    const grandTotal = subTotal;
    const lastAmount = (subTotal + shipping -totalDiscount)
    return res.render('user/placeOrder', {
      user: req.session.user,
      addresses: addressId, 
      cartItems,
      subTotal,
      shipping,
      discount: totalDiscount,
      grandTotal,
      lastAmount
    });

  } catch (err) {
    console.error('Error loading place order page:', err);
    res.status(500).send('Something went wrong.');
  }
};

const placeOrder = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, addressId } = req.body;
    console.log(addressId,"addrs id")
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const address = await addressSchema.findOne({ _id: addressId });
    console.log(address)
    if (!address) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }

    let total = 0;
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      // Check if product is blocked or deleted (isActive: false means available, true means blocked)
      if (product.isActive === true || product.isDeleted === true) {
        return res.status(400).json({ success: false, message: `${product.name} is not available` });
      }

      // Get price from variants
      const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
      if (!variant) {
        return res.status(400).json({ success: false, message: `${product.name} has no pricing information` });
      }

      const itemPrice = variant.salePrice || variant.regularPrice;

      if (!itemPrice || itemPrice <= 0 || isNaN(itemPrice)) {
        return res.status(400).json({ success: false, message: `${product.name} has invalid pricing` });
      }

      // Check stock availability
      if (variant.quantity < item.quantity) {
        return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
      }

      orderItems.push({
        product: product._id,
        quantity: item.quantity,
        price: itemPrice
      });

      total += item.quantity * itemPrice;

      // Update stock
      variant.quantity -= item.quantity;
      await product.save();
    }

    const order = new Order({
      user: userId,
      items: orderItems,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine: address.address,
        city: address.city,
        pincode: address.pinCode,
        state: address.state
      },
      totalAmount: total,
      paymentMethod: paymentMethod,
      status: 'Placed'
    });

    await order.save();

    
    cart.items = [];
    await cart.save();

    res.json({ success: true, orderId: order._id, redirectUrl: `/order-success?orderId=${order._id}` });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Something went wrong' });
  }
};

const getOrderSuccess = async (req, res, next) => {
    try {
        const orderId = req.query.orderId;

        if (!orderId) {
            return res.redirect('/shop');
        }

        // Get order details
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user');

        if (!order || order.user._id.toString() !== req.session.user._id.toString()) {
            return res.redirect('/shop');
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/orderSuccess', {
            user: req.session.user,
            order,
            cloudName
        });
    } catch (error) {
        console.error("Order success page error:", error);
        next(error);
    }
};

const getOrderDetails = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user');

        if (!order || order.user._id.toString() !== userId.toString()) {
            return res.status(404).render('user/404');
        }

        // Check for return request
        const returnRequest = await Return.findOne({ order: orderId, user: userId })
            .populate('items.product', 'name');

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/orderDetails', {
            user: req.session.user,
            order,
            returnRequest,
            cloudName
        });
    } catch (error) {
        console.error("Order details page error:", error);
        next(error);
    }
};

const getMyOrders = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalOrders = await Order.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalOrders / limit);

        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/myOrders', {
            user: req.session.user,
            orders,
            cloudName,
            currentPage: page,
            totalPages,
            totalOrders
        });
    } catch (error) {
        console.error("My orders page error:", error);
        next(error);
    }
};


const requestReturn = async (req, res, next) => {
    try {
        const { orderId, reason, description, items } = req.body;
        const userId = req.session.user._id;

        // Validate order
        const order = await Order.findById(orderId).populate('items.product');
        if (!order || order.user.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Returns are only allowed for delivered orders' });
        }

        // Check if return already exists
        const existingReturn = await Return.findOne({ order: orderId });
        if (existingReturn) {
            return res.status(400).json({ success: false, message: 'Return request already exists for this order' });
        }

        // Calculate total refund amount
        let totalRefundAmount = 0;
        const returnItems = [];

        for (const item of items) {
            const orderItem = order.items.find(oi => oi.product._id.toString() === item.productId);
            if (!orderItem) {
                return res.status(400).json({ success: false, message: 'Invalid product in return request' });
            }

            if (item.quantity > orderItem.quantity) {
                return res.status(400).json({ success: false, message: 'Return quantity cannot exceed ordered quantity' });
            }

            const refundAmount = orderItem.price * item.quantity;
            totalRefundAmount += refundAmount;

            returnItems.push({
                product: item.productId,
                quantity: item.quantity,
                price: orderItem.price,
                reason: item.reason || reason
            });
        }

        // Create return request
        const returnRequest = new Return({
            user: userId,
            order: orderId,
            items: returnItems,
            totalRefundAmount,
            reason,
            description
        });

        await returnRequest.save();

        res.json({
            success: true,
            message: 'Return request submitted successfully. We will review it within 24-48 hours.',
            returnId: returnRequest._id
        });

    } catch (error) {
        console.error('Return request error:', error);
        next(error);
    }
};


const getMyReturns = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalReturns = await Return.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalReturns / limit);

        const returns = await Return.find({ user: userId })
            .populate('order')
            .populate('items.product', 'name images')
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit);

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/myReturns', {
            user: req.session.user,
            returns,
            cloudName,
            currentPage: page,
            totalPages,
            totalReturns
        });
    } catch (error) {
        console.error("My returns page error:", error);
        next(error);
    }
};


const getWallet = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            await wallet.save();

        
            await User.findByIdAndUpdate(userId, { wallet: wallet._id });
        }

        res.render('user/wallet', {
            user: req.session.user,
            wallet
        });

    } catch (error) {
        console.error('Wallet page error:', error);
        next(error);
    }
};



module.exports = {
    getLoadHomePage,
    PageNotFound,
    loginPage,
    login,
    getforgotPass,
    signUpPage,
    signUp,
    getVerifyOtp,
    verifyOtp,
    resendOtp,
    logout,
    getShopPage,
    getProductDetails,
    getNewPass,
    newPass,
    forgotPass,
    getUserProfile,
    updateProfile,
    changeEmail,
    getChangeEmailOtp,
    verifyChangeEmailOtp,
    changePassword,
    getAddress,
    getAddAddress,
    addAddress,
    getEditAddress,
    editAddress,
    deleteAddress,
    getWishList,
    addWishlist,
    removeFromWishlist,
    clearWishlist,
    getCart,
    addToCart,
    updateCartItem,
    removeFromCart,
    emptyCart,
    checkoutGetController,
    addNewAddress,
    deleteCheckAddress,
    getPayment,
    placeOrder,
    getOrderSuccess,
    getOrderDetails,
    getMyOrders,
    requestReturn,
    getMyReturns,
    getWallet
};