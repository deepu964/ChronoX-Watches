const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const generateOtp = require('../../utils/generateOtp');
const sendOtpEmail = require('../../utils/sendOtpEmail');
const sendResetPass = require('../../utils/sendResetPass');
const crypto = require('crypto');


function generateReferralCode(name) {
  return name.toLowerCase().slice(0, 3) + Math.floor(1000 + Math.random() * 9000);
}

function generateCouponCode() {
    return 'CPN' + Math.floor(100000 + Math.random() * 900000); 
}

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
        next(error);
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
    req.session.user = null;
    res.clearCookie('connect.sid');
    return res.redirect('/login');
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
            otpExpr,
            referredBy: req.body.referredBy || null
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
        next(error);
    }
};

// const verifyOtp = async (req, res) => {
//     try {
//         const { otp } = req.body;

//         const sessionUser = req.session.tempUser;
//         console.log("Session User:", sessionUser);
//         if (!sessionUser) {
//             return res.redirect('/signup?message=Session expired. Please sign up again.');
//         }

//         console.log("Session OTP:", sessionUser.otp);
//         console.log("Submitted OTP:", otp);

//         if (new Date() > sessionUser?.otpExpr) {
//             delete sessionUser.otp
//             return res.redirect('/verify-otp?message=OTP expired . Please try again.');
//         }

//         if (String(otp).trim() !== String(sessionUser.otp).trim()) {
//             return res.redirect('/verify-otp?message=Invalid OTP. Please try again.');
//         }

//         if (sessionUser.userId) {
//             await User.findByIdAndUpdate(sessionUser.userId, { isVerified: true });

//             req.session.user = {
//                 _id: sessionUser.userId,
//                 email: sessionUser.email,
//                 fullname: sessionUser.fullname
//             };

//             delete req.session.tempUser;
//             return res.redirect('/?message=Account created successfully');
//         } else {
//             const newUser = new User({
//                 fullname: sessionUser.fullname,
//                 email: sessionUser.email,
//                 password: sessionUser.password,
//                 mobile: sessionUser.mobile,
//                 isVerified: true
//             });

//             const savedUser = await newUser.save();

//             req.session.user = {
//                 _id: savedUser._id,
//                 email: savedUser.email,
//                 fullname: savedUser.fullname
//             };

//             delete req.session.tempUser;
//             return res.redirect('/?message=Account created successfully');
//         }

//     } catch (error) {
//         console.error("OTP verification error:", error);
//         return res.redirect('/verify-otp?message=Verification failed: ' + error.message);
//     }
// };

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body;
        const sessionUser = req.session.tempUser;

        if (!sessionUser) {
            return res.redirect('/signup?message=Session expired. Please sign up again.');
        }

        console.log("Session OTP:", sessionUser.otp);
        console.log("Submitted OTP:", otp);

        if (new Date() > sessionUser?.otpExpr) {
            delete sessionUser.otp;
            return res.redirect('/verify-otp?message=OTP expired. Please try again.');
        }

        if (String(otp).trim() !== String(sessionUser.otp).trim()) {
            return res.redirect('/verify-otp?message=Invalid OTP. Please try again.');
        }

        // OTP is valid
        const referralCode = generateReferralCode(sessionUser.fullname);

        if (sessionUser.userId) {
            // If it's an existing user (OTP for email change or other action)
            await User.findByIdAndUpdate(sessionUser.userId, { isVerified: true });

            req.session.user = {
                _id: sessionUser.userId,
                email: sessionUser.email,
                fullname: sessionUser.fullname
            };

            delete req.session.tempUser;
            return res.redirect('/?message=Account verified successfully');
        } else {
            // New user registration
            const newUser = new User({
                fullname: sessionUser.fullname,
                email: sessionUser.email,
                password: sessionUser.password,
                mobile: sessionUser.mobile,
                isVerified: true,
                referralCode,
                referredBy: sessionUser.referredBy || null
            });

            const savedUser = await newUser.save();

            // Reward the referrer
            if (sessionUser.referredBy) {
                const referrer = await User.findOne({ referralCode: sessionUser.referredBy });
                if (referrer) {
                    const coupon = new Coupon({
                        user: referrer._id,
                        code: generateCouponCode(),
                        discount: 100,
                        expiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
                    });
                    await coupon.save();
                }
            }

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

module.exports = {
    loginPage,
    login,
    logout,
    signUpPage,
    signUp,
    getVerifyOtp,
    verifyOtp,
    resendOtp,
    getforgotPass,
    forgotPass,
    getNewPass,
    newPass
};
