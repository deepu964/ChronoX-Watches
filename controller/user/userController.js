

const bcrypt = require('bcrypt');
const User = require('../../models/userSchema'); 
const categorySchema= require('../../models/categorySchema')
const generateOtp = require('../../utils/generateOtp'); 
const productSchema = require('../../models/productSchema');
const sendOtpEmail = require('../../utils/sendOtpEmail');
const sendResetPass = require('../../utils/sendResetPass');
const mongoose = require('mongoose')
const errorMiddleware = require('../../middlewares/errorMiddleware');
const crypto = require('crypto');
const path = require('path');

const getLoadHomePage = async(req, res) => {
    try {
        
        const category = await categorySchema.find({isListed:true});
        const products = await productSchema.find({isActive:false})
        const user = req.session.user
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        res.render('user/home', { 
            user,products,cloudName,
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
        res.render('user/login', { message,blocked,passChange}); 
    } catch (error) {
        console.error("Login page error:", error);
        res.status(500).send("Internal Server Error");
    }
};


const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        if(!email || !password){
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

const logout = async (req,res) => {
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

const getforgotPass = async (req,res) => {
    try {
       
        const error1 = req.query.error1 || '';
        res.render('user/forgot-pass',{error1});
    } catch (error) {
        next(error);
    }
    
}

const forgotPass = async (req,res)=>{
    try {
        const {email} = req.body
        if(!email){
            return res.redirect('/forgotpassword?error=Email%20is%20reqiured')
        }
        const user = await User.findOne({email})
       
        if(!user){
            return res.redirect('/forgotpassword?error=User%20not%20found')
        }
        if( email.toLowerCase() !== user.email.toLowerCase()){
            return res.redirect('/forgotpassword?error=Email%20not%20exist')
        }
        
        const token = crypto.randomBytes(32).toString("hex")
        
        user.resetToken = token;
        user.resetTokenExpr = new Date()+3600000
        await user.save()

        const resetLink = `http://localhost:3001/newPass/${token}`;
        
        await sendResetPass(email,resetLink)

        res.send("check your email for reset link");
    } catch (error) {
        console.log(error);
        res.status(500).send("Something went wrong");
    }
    

}

const getNewPass  = async (req,res) => {
    try { 
        const {token}= req.params;
        console.log(token,'new get pass')

      res.render('user/newPass',{token});

    } catch (error) {
       console.log(error,"user not exist");
    }
}

    
const newPass = async (req, res) => {
        
        const {token} = req.params;
        const {password,confirm}= req.body;
        console.log(token,"post token");
        try {
            const user = await User.findOne({resetToken:token})
        console.log(user,'this is user');
            if(!user){
                return res.json({success:false, message:"Invalid or Expired token."});

            }

            if(password !== confirm){
                return res.json({success:false,message:"Passwords do not match"});
            }
            const hashedPassword = await bcrypt.hash(password,10);
            console.log(hashedPassword,"hashed");
            user.password =hashedPassword;      
            user.resetToken = undefined;
            user.resetTokenExpr = undefined;

            await user.save();
            console.log("saved")
            
            return res.redirect('/login?passChange=password chnaged')
            
        } catch (error) {
            res.status(500).json({message:"server error"});
        }
}

const signUpPage = (req, res) => {
    try {
        
        if (req.session.user) {
            return res.redirect('/');
        }
        const message = req.query.message || '';
        const error2 = req.query.error2 || '';

        res.render('user/signup', { message,error2 }); 
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

        await sendOtpEmail(email,otp)
        
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

        if (!sessionUser) {
            return res.redirect('/signup?message=Session expired. Please sign up again.');
        }

        console.log("Session OTP:", sessionUser.otp);
        console.log("Submitted OTP:", otp);

        
        if( new Date() > sessionUser?.otpExpr){
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


const resendOtp =async (req, res) => {
    
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
        const newotpExpr = new Date()+1*60*1000;
        console.log(newOtp);
       
        req.session.tempUser.otp = newOtp;
        req.session.tempUser.otpExpr = newotpExpr;

        await sendOtpEmail(email,newOtp)
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

       
        res.render('user/shops', {
            user: req.session.user,
            products,
            cloudName,
            query: req.query,
            categories,
            categoryFilter: categoryIds,
            currentPage: page,
            totalPage
        });

    } catch (error) {
        console.error("Shop page error:", error);
        res.status(500).send("Server error");
    }
};


const getProductDetails = async(req,res)=>{
    try {
        const id = req.params.id
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME
        const product = await productSchema.findById(id)
        const products = await productSchema.find()
        const productLength = 4
        const description = await productSchema.find()
        
        res.render('user/details',{
            user:req.session.user,
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
    forgotPass

};