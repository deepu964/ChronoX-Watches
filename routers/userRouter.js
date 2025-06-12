

const express = require('express');
const userController = require('../controller/user/userController');
const returnController = require('../controller/user/returnController');
const walletController = require('../controller/user/walletController');
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

// Return Request Routes
router.get('/return-request/:orderId',isAuth,returnController.getReturnRequestForm);
router.post('/return-request/:orderId',isAuth,returnController.submitReturnRequest);
router.get('/return-request-details/:returnRequestId',isAuth,returnController.getReturnRequestDetails);
router.get('/my-return-requests',isAuth,returnController.getMyReturnRequests);
router.post('/cancel-return-request/:returnRequestId',isAuth,returnController.cancelReturnRequest);

// Debug route to check orders
router.get('/debug-orders',isAuth, async (req, res) => {
    try {
        const Order = require('../models/orderSchema');
        const orders = await Order.find({ user: req.session.user._id }).populate('items.product');
        res.json({
            user: req.session.user,
            orders: orders.map(order => ({
                id: order._id,
                status: order.status,
                createdAt: order.createdAt,
                totalAmount: order.totalAmount,
                itemCount: order.items.length
            }))
        });
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Debug route to mark order as delivered
router.get('/debug-deliver/:orderId',isAuth, async (req, res) => {
    try {
        const Order = require('../models/orderSchema');
        const order = await Order.findOneAndUpdate(
            { _id: req.params.orderId, user: req.session.user._id },
            { status: 'Delivered' },
            { new: true }
        );
        if (order) {
            res.json({ success: true, message: 'Order marked as delivered', order: { id: order._id, status: order.status } });
        } else {
            res.json({ success: false, message: 'Order not found' });
        }
    } catch (error) {
        res.json({ error: error.message });
    }
});

// Wallet Routes
router.get('/wallet',isAuth,walletController.getWallet);
router.post('/wallet/add-money',isAuth,walletController.addMoneyToWallet);
router.post('/wallet/use-for-payment',isAuth,walletController.useWalletForPayment);
router.get('/wallet/balance',isAuth,walletController.getWalletBalance);
router.get('/wallet/transactions',isAuth,walletController.getTransactionHistory);



module.exports = router;