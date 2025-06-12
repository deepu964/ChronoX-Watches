

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

router.get('/userProfile',isAuth,userController.getUserProfile);
router.post('/userProfile',isAuth,userController.updateProfile);
router.post("/user-email-change", isAuth, userController.changeEmail);
router.get("/profile/otp-sent", isAuth, userController.getChangeEmailOtp);
router.post("/email-verify-otp", isAuth, userController.verifyChangeEmailOtp);


router.post('/profile-change-pass',isAuth,userController.changePassword);

router.get('/address',isAuth,userController.getAddress);

router.get('/add-address',isAuth,userController.getAddAddress);
router.post('/add-address',isAuth,userController.addAddress);

router.get('/edit-address/:id',isAuth,userController.getEditAddress);
router.put('/edit-address/:id',isAuth,userController.editAddress);
router.delete('/delete-address/:id', isAuth, userController.deleteAddress);


router.get('/wish-list',isAuth,userController.getWishList);
router.post('/wishlist-add',isAuth,userController.addWishlist);
router.post('/wishlist-remove',isAuth,userController.removeFromWishlist);
router.post('/wishlist-clear',isAuth,userController.clearWishlist);

router.get('/cart',isAuth,userController.getCart);
router.post('/add-to-cart',isAuth,userController.addToCart);
router.post('/cart/update', isAuth,userController.updateCartItem);
router.post('/cart/remove/:productId',isAuth, userController.removeFromCart);
router.post('/cart/empty',isAuth, userController.emptyCart);

router.get('/check-out',isAuth,userController.checkoutGetController);
router.post('/check-out',isAuth,userController.addNewAddress);
router.delete('/delete-check-address/:id',isAuth,userController.deleteCheckAddress);

router.get('/payment',isAuth,userController.getPayment);
router.post('/payment',isAuth,userController.placeOrder);

router.get('/order-success',isAuth,userController.getOrderSuccess);
router.get('/order-details/:orderId',isAuth,userController.getOrderDetails);
router.get('/my-orders',isAuth,userController.getMyOrders);



module.exports = router;