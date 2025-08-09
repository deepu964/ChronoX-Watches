const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const generateOtp = require('../../utils/generateOtp');
const sendOtpEmail = require('../../utils/sendOtpEmail');
const logger = require('../../utils/logger')

const getUserProfile = async (req, res, next) => {
    try {
        const userId = req.session.user;

        const user = await User.findById(userId);

        res.render('user/userProfile', { user });
    } catch (error) {
        logger.error('user profile  error');
        next(error);
    }
};

const updateProfile = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const { name, email, mobile } = req.body;

        const existUser = await User.findById(userId);
        if (!existUser) {
            return res.json({
                success: false,
                message: 'user not found'
            });
        }
        await User.findByIdAndUpdate(userId, {
            fullname: name,
            email,
            mobile
        }, { new: true });
        return res.json({
            success: true,
        });

    } catch (error) {
        logger.error('profile updated error');
        next(error);
    }
};

const verifyChangeEmail = async (req, res, next) => {
    try {
        const enteredOtp = req.body.otp;
        if (enteredOtp == req.session.userOtp) {
            res.redirect('/');
        }
    } catch (error) {
        logger.error('this is  verifychange mail page ',error);
        next(error);
    }
};

const changeEmail = async (req, res, next) => {
    try {

        const { name, mobile } = req.body;

        const email = req.body.newEmail;

        const userId = req.session.user._id;

        if (!email) {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {

            return res.status(400).json({ success: false, message: 'Email already exists' });
        }


        const otp = generateOtp();
        logger.info('Generated OTP:', otp);
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
};

const getChangeEmailOtp = (req, res, next) => {
    try {

        if (!req.session.emailChange) {
            return res.redirect('/userProfile?message=Session expired. Please try again.');
        }

        const { email } = req.session.emailChange;
        const otpExpr = req.session.emailChange.otpExpr;

        req.session.tempUser = { email, otp: req.session.userOtp, };
        res.render('user/changeEmailOtp', {
            email,
            otpExpr,
            query: req.query
        });
    } catch (error) {
        logger.error('Change email OTP page error:', error);
        next(error);
    }
};

const verifyChangeEmailOtp = async (req, res, next) => {
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
        logger.error('Change email OTP verification error:', error);
        next(error)
    }
};

const changePassword = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { currentPassword, newPassword, confirmPassword } = req.body;
        
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'No changes to update' });
        }


        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({ success: false, message: 'All fields are required' });
        }


        const existsUser = await User.findById(userId);
        if (!existsUser) {

            return res.status(400).json({ success: false, message: 'user not found' });
        }


        const passwordMatch = await bcrypt.compare(currentPassword, existsUser.password);
        if (!passwordMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

          if (newPassword.length < 6) {
            return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long' });
        }

        if (newPassword === currentPassword) {
            return res.status(400).json({ success: false, message: 'New password cannot be the same as current password' });
        }


        if (newPassword !== confirmPassword) {
            return res.status(400).json({ success: false, message: 'New password and confirm password do not match' });
        }

        existsUser.password = await bcrypt.hash(newPassword, 10);
        await existsUser.save();

        return res.status(200).json({ success: true, message: 'Password changed successfully' });


    } catch (error) {
        logger.error('change pass page error');
        next(error);
    }

};

module.exports = {
    getUserProfile,
    updateProfile,
    verifyChangeEmail,
    changeEmail,
    getChangeEmailOtp,
    verifyChangeEmailOtp,
    changePassword
};
