

const express = require('express');

const authController = require('../controller/user/authController');
const profileController = require('../controller/user/profileController');
const addressController = require('../controller/user/addressController');
const wishlistController = require('../controller/user/wishlistController');
const cartController = require('../controller/user/cartController');
const orderController = require('../controller/user/orderController');
const returnController = require('../controller/user/returnController');
const walletController = require('../controller/user/walletController');
const pageController = require('../controller/user/pageController');
const couponController = require('../controller/user/couponController');

const passport = require('passport');
const router = express.Router();
const checkBlocked = require('../middlewares/checkBlocked');
const isAuth = require('../middlewares/userAuth');
const productController = require('../controller/admin/productController');
const invoice = require('../controller/user/invoiceController');


router.get('/',checkBlocked, isAuth, pageController.getLoadHomePage);
router.get('/PageNotFound', pageController.PageNotFound);


router.get('/login', authController.loginPage);
router.post('/login', checkBlocked, authController.login);
router.get('/logout', authController.logout);
router.post('/logout', isAuth, authController.logout);

router.get('/forgot-pass', authController.getforgotPass);
router.post('/forgot-pass', authController.forgotPass)

router.get('/newPass/:token', authController.getNewPass);
router.post('/newPass/:token', authController.newPass);

router.get('/signup', authController.signUpPage);
router.post('/signup', authController.signUp);

router.get('/verify-otp', authController.getVerifyOtp);
router.post('/verify-otp', authController.verifyOtp);
router.post('/resend-otp', authController.resendOtp);


router.get('/user/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/user/google/callback',passport.authenticate('google',{failureRedirect:'/login'}),(req,res)=>{
    req.session.user = req.user;
    req.session.isAuth = true;
    res.redirect('/');
});


router.get('/shop', isAuth, pageController.getShopPage);
router.get('/productdetails/:id', isAuth, pageController.getProductDetails)

router.get('/productdetails/:id', productController.getProductDetails);
router.post('/productdetails/review/:id', productController.addReview);


router.get('/userProfile', isAuth, profileController.getUserProfile);
router.post('/userProfile', isAuth, profileController.updateProfile);
router.post("/user-email-change", isAuth, profileController.changeEmail);
router.get("/profile/otp-sent", isAuth, profileController.getChangeEmailOtp);
router.post("/email-verify-otp", isAuth, profileController.verifyChangeEmailOtp);

router.post('/profile-change-pass', isAuth, profileController.changePassword);


router.get('/address', isAuth, addressController.getAddress);
router.get('/add-address', isAuth, addressController.getAddAddress);
router.post('/add-address', isAuth, addressController.addAddress);
router.get('/edit-address/:id', isAuth, addressController.getEditAddress);
router.put('/edit-address/:id', isAuth, addressController.editAddress);
router.delete('/delete-address/:id', isAuth, addressController.deleteAddress);


router.get('/wish-list', isAuth, wishlistController.getWishList);
router.post('/wishlist-add', isAuth, wishlistController.addWishlist);
router.post('/wishlist-remove', isAuth, wishlistController.removeFromWishlist);
router.post('/wishlist-clear', isAuth, wishlistController.clearWishlist);


router.get('/cart', isAuth, cartController.getCart);
router.post('/add-to-cart', isAuth, cartController.addToCart);
router.post('/cart/update', isAuth, cartController.updateCartItem);
router.post('/cart/remove/:productId', isAuth, cartController.removeFromCart);
router.post('/cart/empty', isAuth, cartController.emptyCart);


router.post('/validate-cart', isAuth, orderController.validateCartForCheckout);
router.get('/check-out', isAuth, orderController.checkoutGetController);
router.post('/check-out', isAuth, orderController.addNewAddress);
router.delete('/delete-check-address/:id', isAuth, orderController.deleteCheckAddress);


router.post('/apply-coupon', isAuth, couponController.applyCoupon);
router.delete('/remove-coupon',isAuth,couponController.removeCoupon);

router.get('/payment', isAuth, orderController.getPayment);
router.post('/payment', isAuth, orderController.placeOrder);
router.get('/retry-payment/:orderId',isAuth,orderController.getRetry);

router.get('/order-success', isAuth, orderController.getOrderSuccess);
router.get('/order-details/:orderId', isAuth, orderController.getOrderDetails);
router.get('/my-orders', isAuth, orderController.getMyOrders);
router.put('/cancel-order/:orderId', isAuth, orderController.cancelOrder);
router.put('/cancel-order-item/:orderId/:itemId', isAuth, orderController.cancelOrderItem);
router.get('/debug-order-ids', isAuth, orderController.debugOrderIds);
router.post('/create-order',isAuth, orderController.createRazorpayOrder);


router.post('/request-return', isAuth, returnController.requestReturn);
router.get('/my-returns', isAuth, returnController.getMyReturns);

router.get('/wallet', isAuth, walletController.getWallet);

router.get('/download-invoice/:orderId', isAuth, invoice.generateInvoice);


module.exports = router;