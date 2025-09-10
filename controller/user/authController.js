const bcrypt = require('bcrypt');
const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const Referral = require('../../models/referralSchema');
const generateOtp = require('../../utils/generateOtp');
const sendOtpEmail = require('../../utils/sendOtpEmail');
const sendResetPass = require('../../utils/sendResetPass');
const crypto = require('crypto');
const logger = require('../../utils/logger');

function generateReferralCode(name) {
  return (
    name.toLowerCase().slice(0, 3) + Math.floor(1000 + Math.random() * 9000)
  );
}

const loginPage = (req, res, next) => {
  try {
    if (req.session.user) {
      return res.redirect('/');
    }
    const passChange = req.query.params;
    const message = req.query.message || '';
    const blocked = req.query.blocked || '';
    res.render('user/login', { message, blocked, passChange });
  } catch (error) {
    logger.error('Login page error:', error);
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
      fullname: user.fullname,
    };
    return res.redirect('/');
  } catch (error) {
    logger.error('Login error:', error);
    return res.redirect('/login?message=Login failed. Please try again.');
  }
};

const logout = async (req, res) => {
  req.session.user = null;
  res.clearCookie('connect.sid');
  return res.redirect('/login');
};

const signUpPage = (req, res) => {
  try {
    if (req.session.user) {
      return res.redirect('/');
    }
    const message = req.query.message || '';
    const error2 = req.query.error2 || '';
    const referralCode = req.query.ref || ''; // Get referral code from URL

    res.render('user/signup', { message, error2, referralCode });
  } catch (error) {
    logger.error('Signup page error:', error);
    res.status(500).send('Internal Server Error');
  }
};

const signUp = async (req, res) => {
  try {
    const { fullname, email, mobile, password, referredBy } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.redirect('/signup?error2=User already exists with this email');
    }

   
    let validReferralCode = null;
    if (referredBy && referredBy.trim()) {
      const referrer = await User.findOne({ referralCode: referredBy.trim() });
      if (!referrer) {
        return res.redirect(
          '/signup?message=Invalid referral code. Please check and try again.'
        );
      }
      if (referrer.isBlocked) {
        return res.redirect(
          '/signup?message=This referral code is not available.'
        );
      }
      if (referrer.email.toLowerCase() === email.toLowerCase()) {
        return res.redirect(
          '/signup?message=You cannot use your own referral code.'
        );
      }
      validReferralCode = referredBy.trim();
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = generateOtp();
    const otpExpr = Date.now() + 1 * 60 * 1000;
    logger.info(otp);

    await sendOtpEmail(email, otp);

    req.session.tempUser = {
      fullname,
      email,
      mobile,
      password: hashedPassword,
      otp,
      otpExpr,
      referredBy: validReferralCode,
    };

    return res.redirect('/verify-otp');
  } catch (error) {
    logger.error('Signup error:', error);
    return res.redirect('/signup?message=Signup failed: ' + error.message);
  }
};

const getVerifyOtp = (req, res, next) => {
  try {
    if (!req.session.tempUser) {
      return res.redirect(
        '/signup?message=Session expired. Please sign up again.'
      );
    }
    const otpExpr = req.session.tempUser.otpExpr;

    const message = req.query.message || '';
    res.render('user/verify-otp', {
      message,
      email: req.session.tempUser.email,
      otpExpr,
    });
  } catch (error) {
    logger.error('OTP page error:', error);
    next(error);
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    const sessionUser = req.session.tempUser;

    if (!sessionUser) {
      return res.redirect(
        '/signup?message=Session expired. Please sign up again.'
      );
    }

    logger.info('Session OTP:', sessionUser.otp);
    logger.info('Submitted OTP:', otp);

    if (new Date() > sessionUser?.otpExpr) {
      delete sessionUser.otp;
      return res.redirect('/verify-otp?message=OTP expired. Please try again.');
    }

    if (String(otp).trim() !== String(sessionUser.otp).trim()) {
      return res.redirect('/verify-otp?message=Invalid OTP. Please try again.');
    }

    const referralCode = generateReferralCode(sessionUser.fullname);

    if (sessionUser.userId) {
      await User.findByIdAndUpdate(sessionUser.userId, { isVerified: true });

      req.session.user = {
        _id: sessionUser.userId,
        email: sessionUser.email,
        fullname: sessionUser.fullname,
      };

      delete req.session.tempUser;
      return res.redirect('/?message=Account verified successfully');
    } else {
      const newUser = new User({
        fullname: sessionUser.fullname,
        email: sessionUser.email,
        password: sessionUser.password,
        mobile: sessionUser.mobile,
        isVerified: true,
        referralCode,
        referredBy: sessionUser.referredBy || null,
      });

      const savedUser = await newUser.save();

      if (sessionUser.referredBy) {
        const referrer = await User.findOne({
          referralCode: sessionUser.referredBy,
        });
        if (referrer && referrer._id.toString() !== savedUser._id.toString()) {
          try {
            if (referrer.isBlocked) {
              throw new Error('Referrer account is blocked');
            }

            const existingReferral = await Referral.findOne({
              referrer: referrer._id,
              referred: savedUser._id,
            });

            if (existingReferral) {
              logger.warn('Referral record already exists, skipping reward');
            } else {
              let referrerWallet = await Wallet.findOne({ user: referrer._id });
              if (!referrerWallet) {
                referrerWallet = new Wallet({
                  user: referrer._id,
                  balance: 0,
                  transactions: [],
                });
                await referrerWallet.save();
                await User.findByIdAndUpdate(referrer._id, {
                  wallet: referrerWallet._id,
                });
              }

              const rewardAmount = 100;
              await referrerWallet.addMoney(
                rewardAmount,
                `Referral reward for referring ${savedUser.fullname}`,
                null,
                null
              );

              let newUserWallet = await Wallet.findById(savedUser.wallet);
              if (!newUserWallet) {
                newUserWallet = new Wallet({
                  user: savedUser._id,
                  balance: 0,
                  transactions: [],
                });
                await newUserWallet.save();
                await User.findByIdAndUpdate(savedUser._id, {
                  wallet: newUserWallet._id,
                });
              }

              await newUserWallet.addMoney(
                rewardAmount,
                `Welcome bonus for joining with referral code ${sessionUser.referredBy}`,
                null,
                null
              );

              const referralRecord = new Referral({
                referrer: referrer._id,
                referred: savedUser._id,
                referralCode: sessionUser.referredBy,
                rewardAmount: rewardAmount,
                status: 'Completed',
                rewardGiven: true,
                rewardGivenAt: new Date(),
                notes: `Referral reward of ₹${rewardAmount} credited to wallet successfully`,
              });
              await referralRecord.save();

              logger.warn(
                `Referral reward of ₹${rewardAmount} credited to ${referrer.fullname}'s wallet`
              );
            }
          } catch (error) {
            logger.error('Error processing referral reward:', error);

            try {
              const failedReferralRecord = new Referral({
                referrer: referrer._id,
                referred: savedUser._id,
                referralCode: sessionUser.referredBy,
                rewardAmount: 100,
                status: 'Failed',
                rewardGiven: false,
                notes: `Failed to credit referral reward: ${error.message}`,
              });
              await failedReferralRecord.save();
            } catch (recordError) {
              logger.error(
                'Error creating failed referral record:',
                recordError
              );
            }
          }
        } else {
          logger.warn('Invalid referrer or self-referral attempt detected');
        }
      }

      req.session.user = {
        _id: savedUser._id,
        email: savedUser.email,
        fullname: savedUser.fullname,
      };

      delete req.session.tempUser;
      return res.redirect('/?message=Account created successfully');
    }
  } catch (error) {
    logger.error('OTP verification error:', error);
    return res.redirect(
      '/verify-otp?message=Verification failed: ' + error.message
    );
  }
};

const resendOtp = async (req, res) => {
  try {
    const sessionUser = req.session.tempUser;
    const email = sessionUser.email;

    if (!sessionUser) {
      return res.status(400).json({
        success: false,
        message: 'Session expired. Please sign up again.',
      });
    }

    const newOtp = generateOtp();
    const newotpExpr = new Date() + 1 * 60 * 1000;
    logger.info(newOtp);

    req.session.tempUser.otp = newOtp;
    req.session.tempUser.otpExpr = newotpExpr;

    await sendOtpEmail(email, newOtp);
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully to your email',
    });
  } catch (error) {
    logger.error('Resend OTP error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to resend OTP: ' + error.message,
    });
  }
};

const getforgotPass = async (req, res, next) => {
  try {
    const error1 = req.query.error1 || '';
    res.render('user/forgot-pass', { error1 });
  } catch (error) {
    next(error);
  }
};

const forgotPass = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.redirect('/forgotpassword?error=Email%20is%20reqiured');
    }
    const user = await User.findOne({ email });

    if (!user) {
      return res.redirect('/forgotpassword?error=User%20not%20found');
    }
    if (email.toLowerCase() !== user.email.toLowerCase()) {
      return res.redirect('/forgotpassword?error=Email%20not%20exist');
    }

    const token = crypto.randomBytes(32).toString('hex');

    user.resetToken = token;
    user.resetTokenExpr = new Date() + 3600000;
    await user.save();

    const resetLink = `http://localhost:3001/newPass/${token}`;

    await sendResetPass(email, resetLink);

    res.send('check your email for reset link');
  } catch (error) {
    logger.error(error);
    res.status(500).send('Something went wrong');
  }
};

const getNewPass = async (req, res) => {
  try {
    const { token } = req.params;
    logger.info(token, 'new get pass');

    res.render('user/newPass', { token });
  } catch (error) {
    logger.error(error, 'user not exist');
  }
};

const newPass = async (req, res) => {
  const { token } = req.params;
  const { password, confirm } = req.body;

  try {
    const user = await User.findOne({ resetToken: token });

    if (!user) {
      return res.json({ success: false, message: 'Invalid or Expired token.' });
    }

    if (password !== confirm) {
      return res.json({ success: false, message: 'Passwords do not match' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);

    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpr = undefined;

    await user.save();

    return res.redirect('/login?passChange=password chnaged');
  } catch (error) {
    res.status(500).json({ message: 'server error', error });
  }
};

const validateReferralCode = async (req, res) => {
  try {
    const { referralCode, userEmail } = req.body;

    if (!referralCode || !referralCode.trim()) {
      return res.json({ valid: false, message: 'Referral code is required' });
    }

    const codePattern = /^[a-zA-Z]{3}\d{4}$/;
    if (!codePattern.test(referralCode.trim())) {
      return res.json({
        valid: false,
        message: 'Invalid referral code format',
      });
    }

    const referrer = await User.findOne({ referralCode: referralCode.trim() });

    if (!referrer) {
      return res.json({ valid: false, message: 'Referral code not found' });
    }

    if (referrer.isBlocked) {
      return res.json({
        valid: false,
        message: 'This referral code is not available',
      });
    }

    if (userEmail && referrer.email.toLowerCase() === userEmail.toLowerCase()) {
      return res.json({
        valid: false,
        message: 'You cannot use your own referral code',
      });
    }

    if (userEmail) {
      const existingUser = await User.findOne({
        email: userEmail.toLowerCase(),
      });
      if (existingUser && existingUser.referredBy) {
        return res.json({
          valid: false,
          message: 'This email has already been referred',
        });
      }
    }

    return res.json({
      valid: true,
      message: 'Valid referral code',
      referrerName: referrer.fullname,
    });
  } catch (error) {
    logger.error('Error validating referral code:', error);
    return res.json({
      valid: false,
      message: 'Error validating referral code',
    });
  }
};

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
  newPass,
  validateReferralCode,
};
