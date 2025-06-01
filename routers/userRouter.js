

const express = require('express');
const userController = require('../controller/user/userController');
const passport = require('passport');
const router = express.Router();
const checkBlocked = require('../middlewares/checkBlocked');
const isAuth = require('../middlewares/userAuth');
const productController = require('../controller/admin/productController');


router.get('/',checkBlocked, isAuth,userController.getLoadHomePage);

router.get('/PageNotFound', userController.PageNotFound);


router.get('/login',userController.loginPage);
router.post('/login',checkBlocked,userController.login);
router.get('/logout',userController.logout);

router.get('/forgot-pass',userController.getforgotPass);
router.post('/forgot-pass',userController.forgotPass)

router.get('/newPass/:token',userController.getNewPass);
router.post('/newPass/:token',userController.newPass);



router.get('/signup' ,userController.signUpPage);
router.post('/signup',userController.signUp);


router.get('/verify-otp', userController.getVerifyOtp);
router.post('/verify-otp' , userController.verifyOtp);
router.post('/resend-otp' ,userController.resendOtp)



router.post('/logout', isAuth ,userController.logout);

router.get('/user/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/user/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{
    req.session.user = req.user;
    req.session.isAuth = true;
    res.redirect('/');
});


router.get('/shop',isAuth,userController.getShopPage);
router.get('/productdetails/:id',isAuth,userController.getProductDetails)

router.get('/productdetails/:id', productController.getProductDetails);
router.post('/productdetails/review/:id', productController.addReview);

module.exports = router;