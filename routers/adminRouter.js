const express = require('express');
const router = express.Router();
const nocache = require('nocache')
const adminController = require('../controller/admin/adminController');
const userListController = require('../controller/admin/userListController');
const productController = require('../controller/admin/productController');
const categoryController = require('../controller/admin/categoryController')
const couponController = require('../controller/admin/couponController');
const orderController = require('../controller/admin/orderController');
// const isAdmin = require('../middlewares/adminAuth');
const {authMiddleware,adminAuth} = require('../middlewares/adminAuth')


function preventBackHistory(req, res, next) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
}



router.get('/',adminController.getAdminLogin);
router.post('/login',adminController.adminLogin);
router.get('/logout',adminController.logout);


router.get('/dashboard',preventBackHistory,authMiddleware,adminController.getDashBoard);


router.get('/userlist',authMiddleware,userListController.userList);
router.put('/userlist/block/:id',authMiddleware,userListController.blockUser);



router.get('/product',authMiddleware,adminAuth,productController.product);
router.put('/product/block/:id',authMiddleware,adminAuth,productController.blockedProduct)

router.get('/addproduct',authMiddleware,adminAuth,productController.getproductAdd);
router.post('/addproduct',authMiddleware,adminAuth,productController.addProduct)

router.get('/editproduct/edit/:id',productController.getEditProduct);
router.put('/product/edit/:id',productController.editProduct);
router.delete('/product/:id',productController.deleteProduct)

router.get('/category', authMiddleware,adminAuth,categoryController.listCategories);

router.get('/addcategory',authMiddleware,adminAuth, categoryController.getAddCategory);
router.post('/addcategory', authMiddleware,adminAuth,categoryController.addCategory);

router.patch('/category/toggle-status/:id',authMiddleware,adminAuth,categoryController.toggleCategoryStatus);

router.get('/category/edit/:id',authMiddleware,adminAuth,categoryController.getEditCategory);
router.put('/category/edit/:id',authMiddleware,adminAuth, categoryController.editCategory); 

router.delete('/category/:id', authMiddleware,adminAuth,categoryController.deleteCategory)


router.get('/coupon',couponController.getCoupon);

router.get('/coupon/addCoupon',couponController.getAddCoupon);
router.post('/coupon/addCoupon',couponController.addCoupon);

router.delete('/coupon/delete/:id',couponController.deleteCoupon)


router.get('/orders', authMiddleware, adminAuth, orderController.getOrders);
router.get('/orders/:id', authMiddleware, adminAuth, orderController.getOrderDetails);
router.put('/orders/:id/status', authMiddleware, adminAuth, orderController.updateOrderStatus);


router.get('/returns', authMiddleware, adminAuth, orderController.getReturns);
router.put('/returns/:id/process', authMiddleware, adminAuth, orderController.processReturn);


module.exports = router;


