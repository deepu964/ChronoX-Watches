const addressSchema = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const productSchema = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Razorpay = require('razorpay');
const cartSchema = require('../../models/cartSchema');

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const validateCartForCheckout = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const cart = await Cart.findOne({ user: userId }).populate({
            path: 'items.product',
            populate: {
                path: 'categoryId',
                model: 'Category'
            }
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Your cart is empty'
            });
        }

        const invalidItems = [];
        const outOfStockItems = [];

        for (const item of cart.items) {
            const product = item.product;

            
            if (product.isActive === true || product.isDeleted === true) {
                invalidItems.push(product.name);
                continue;
            }

            
            if (!product.categoryId || !product.categoryId.isListed) {
                invalidItems.push(product.name);
                continue;
            }

            
            const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
            if (!variant || variant.quantity < item.quantity) {
                outOfStockItems.push({
                    name: product.name,
                    available: variant ? variant.quantity : 0,
                    requested: item.quantity
                });
            }
        }

        if (invalidItems.length > 0) {
            return res.status(400).json({
                success: false,
                message: `The following items are no longer available: ${invalidItems.join(', ')}. Please remove them from your cart.`,
                type: 'invalid_products',
                invalidItems
            });
        }

        if (outOfStockItems.length > 0) {
            const outOfStockMessage = outOfStockItems.map(item =>
                `${item.name} (Available: ${item.available}, Requested: ${item.requested})`
            ).join(', ');

            return res.status(400).json({
                success: false,
                message: `The following items are out of stock: ${outOfStockMessage}. Please update quantities or remove them from your cart.`,
                type: 'out_of_stock',
                outOfStockItems
            });
        }

        
        return res.status(200).json({
            success: true,
            message: 'Cart validation successful'
        });

    } catch (error) {
        console.error('Cart validation error:', error);
        return res.status(500).json({
            success: false,
            message: 'An error occurred while validating your cart'
        });
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
                image: product.images?.[0]?.public_id || '/images/default-product.jpg',
                quantity: item.quantity,
                price,
                total,
            };
        });
        
        const shipping = 50;
        const discount = 0;

        const grandTotal = subTotal + shipping - discount;

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
        console.log('get ckeck out page error')
        next(error);
    }
};

const addNewAddress = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

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

        res.status(200).json({
            success: true,
            message: "Address added successfully",
        });

    } catch (error) {
        console.log('add new address page error')
        next(error);
    }
};

const deleteCheckAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        await addressSchema.findByIdAndDelete(addressId);
        res.status(200).json({ success: true, message: "Address deleted successfull" });

    } catch (error) {
        console.log(' delete address page error')
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
        const lastAmount = (subTotal + shipping - totalDiscount)
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
        next(err);
    }
};

const placeOrder = async (req, res,next) => {
    try {
        const userId = req.session.user._id;
        const { paymentMethod, addressId,razorpayOrderId, paymentId } = req.body;
        const cart = await Cart.findOne({ user: userId }).populate('items.product');
        if (!cart || cart.items.length === 0) {
            return res.status(400).json({ success: false, message: 'Cart is empty' });
        }

        const address = await addressSchema.findOne({ _id: addressId });

        if (!address) {
            return res.status(400).json({ success: false, message: 'Invalid address' });
        }
        
        let total = 0;
        const orderItems = [];
        for (const item of cart.items) {
            const product = item.product;

            if (product.isActive === true || product.isDeleted === true) {
                return res.status(400).json({ success: false, message: `${product.name} is not available` });
            }

            const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
            if (!variant) {
                return res.status(400).json({ success: false, message: `${product.name} has no pricing information` });
            }

            const itemPrice = variant.salePrice || variant.regularPrice;
            const discount = variant.regularPrice - variant.salePrice
            
            if (!itemPrice || itemPrice <= 0 || isNaN(itemPrice)) {
                return res.status(400).json({ success: false, message: `${product.name} has invalid pricing` });
            }

            if (variant.quantity < item.quantity) {
                return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
            }

            orderItems.push({
                product: product._id,
                quantity: item.quantity,
                price: itemPrice,
                discount:discount
            });

            total += item.quantity * itemPrice;
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
            paymentId: paymentId || null,
            razorpayOrderId: razorpayOrderId || null,
            status: paymentMethod === 'online' ? 'Placed' : 'Placed'
        });
        console.log(razorpayOrderId,"id")
        await order.save();

        cart.items = [];
        await cart.save();

        res.json({ success: true, orderId: order._id, redirectUrl: `/order-success?orderId=${order._id}` });

    } catch (err) {
        console.error('place oreder page error',err);
        next(err)
    }
};


const getRetry = async(req,res,next)=>{
        try {
            const userId = req.session.user._id;
            const orderId = req.params.orderId;
            console.log(orderId,"orderid")

            const order = await Order.findById(orderId).populate('items.product');

            if (!order || order.user.toString() !== userId.toString()) {
                req.session.toast = {type :'error', message: "Order not found"};
                return res.redirect('/my-orders');
            }

            // Get user's addresses
            const addresses = await addressSchema.find({ userId });
            const defaultAddress = addresses.find(addr => addr.isDefault) || addresses[0];

            res.render('user/retryPayment', {
                order,
                addresses: defaultAddress,
                user: req.session.user,
                toast: req.session.toast,
                totalAmount: order.totalAmount
                });

                delete req.session.toast;

        } catch (error) {
            console.log("this is retry page error",error);
            next(error);
        }
    }

const getOrderSuccess = async (req, res, next) => {
    try {
        const orderId = req.query.orderId;

        if (!orderId) {
            return res.redirect('/shop');
        }

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
        console.error("Order success page error");
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

        const Return = require('../../models/returnSchema');
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
        console.error("Order details page error");
        next(error);
    }
};

const getMyOrders = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 6;
        const skip = (page - 1) * limit;

       
        const search = req.query.search || '';

        let orders;
        let totalOrders;

        if (search.trim()) {
            
            let searchTerm = search.trim();

            
            if (searchTerm.startsWith('#')) {
                searchTerm = searchTerm.substring(1);
            }

            const allOrders = await Order.find({ user: userId })
                .populate('items.product')
                .sort({ createdAt: -1 });

            
            const filteredOrders = allOrders.filter(order => {
                const fullId = order._id.toString();
                const last8 = fullId.slice(-8).toUpperCase();
                const searchUpper = searchTerm.toUpperCase();

                const matchesFull = fullId.toUpperCase().includes(searchUpper);
                const matchesLast8 = last8.includes(searchUpper);

                return matchesFull || matchesLast8;
            });

            

            
            totalOrders = filteredOrders.length;
            orders = filteredOrders.slice(skip, skip + limit);
        } else {
            
            totalOrders = await Order.countDocuments({ user: userId });
            orders = await Order.find({ user: userId })
                .populate('items.product')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

            
            if (orders.length > 0) {
                
                orders.forEach(order => {
                    const fullId = order._id.toString();
                    const last8 = fullId.slice(-8).toUpperCase();
                    
                });
                
            }
        }

        const totalPages = Math.ceil(totalOrders / limit);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/myOrders', {
            user: req.session.user,
            orders,
            cloudName,
            currentPage: page,
            totalPages,
            totalOrders,
            searchParams: { search }
        });
    } catch (error) {
        console.error("My orders page error:", error);
        next(error);
    }
};

const cancelOrder = async (req, res, next) => {
    try {
        const cancelId = req.params.orderId;
        const userId = req.session.user._id;

        const order = await Order.findById(cancelId);
        if (!order) {
            return res.status(404).json({ message: 'Order not found' });
        }

        // Check if order belongs to the user
        if (order.user.toString() !== userId.toString()) {
            return res.status(403).json({ message: 'Unauthorized access' });
        }

        if (order.status !== 'Placed') {
            if (order.status === 'Failed') {
                return res.status(400).json({
                    success: false,
                    message: 'This order has already failed and cannot be cancelled. You can retry payment instead.'
                });
            }
            return res.status(400).json({
                success: false,
                message: 'Order cannot be cancelled now'
            });
        }

        order.status = 'Cancelled';
        let totalRefundAmount = 0;

        // Cancel all items and restore stock
        for (const item of order.items) {
            if (item.status === 'Placed') {
                item.status = 'Cancelled';
                item.cancelledAt = new Date();
                item.cancelReason = 'Full order cancelled';

                console.log("Cancelling item:", item);

                // Restore stock
                const product = await productSchema.findById(item.product);
                if (product && product.variants.length > 0) {
                    const variant = product.variants[0];
                    variant.quantity += item.quantity;
                    await product.save();
                }

                // Calculate refund amount
                totalRefundAmount += item.price * item.quantity;
            }
        }

        await order.save();

        // Handle refund only if payment was successful
        let refundMessage = '';
        if (order.paymentMethod === 'ONLINE' && order.isPaid && order.paymentStatus === 'Completed' && totalRefundAmount > 0) {
            let wallet = await Wallet.findOne({ user: userId });
            if (!wallet) {
                wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
                await wallet.save();
                await User.findByIdAndUpdate(userId, { wallet: wallet._id });
            }

            wallet.balance += totalRefundAmount;
            wallet.transactions.push({
                type: 'credit',
                amount: totalRefundAmount,
                description: `Refund for cancelled order #${order._id.toString().slice(-8).toUpperCase()}`,
                orderId: order._id
            });

            await wallet.save();
            refundMessage = ` ₹${totalRefundAmount} refunded to wallet.`;
        } else if (order.paymentMethod === 'ONLINE' && (!order.isPaid || order.paymentStatus !== 'Completed')) {
            refundMessage = ' No refund needed as payment was not completed.';
        }

        res.status(200).json({
            success: true,
            message: `Order cancelled successfully and stock updated.${refundMessage}`,
            refundAmount: order.paymentMethod === 'ONLINE' && order.isPaid && order.paymentStatus === 'Completed' ? totalRefundAmount : 0
        });

    } catch (error) {
        console.log("this is cancel order page error", error);
        next(error);
    }
};

const cancelOrderItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findById(orderId).populate('items.product');
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: 'Unauthorized access' });
    }

    const item = order.items.id(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found in order' });
    }

    if (item.status !== 'Placed') {
      return res.status(400).json({ success: false, message: `Item cannot be cancelled. Current status: ${item.status}` });
    }

   
    item.status = 'Cancelled';
    item.cancelledAt = new Date();
    item.cancelReason = reason || 'Cancelled by customer';

   
    const product = await productSchema.findById(item.product._id);
    if (product && product.variants.length > 0) {
      const variant = product.variants[0]; 
      variant.quantity += item.quantity;
      await product.save();
    }

    
    const activeItems = order.items.filter(i => i.status !== 'Cancelled');
    if (activeItems.length === 0) {
      order.status = 'Cancelled';
    }

    
    const newTotal = activeItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    order.totalAmount = newTotal;

    await order.save();


    const refundAmount = item.price * item.quantity;
    let actualRefundAmount = 0;
    let refundMessage = '';

    // Only refund if payment was successful (money was actually charged)
    if (order.paymentMethod === 'ONLINE' && order.isPaid && order.paymentStatus === 'Completed' && refundAmount > 0) {
      let wallet = await Wallet.findOne({ user: userId });
      if (!wallet) {
        wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        await wallet.save();
        await User.findByIdAndUpdate(userId, { wallet: wallet._id });
      }

      wallet.balance += refundAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: refundAmount,
        description: `Refund for cancelled item: ${item.product.name}`,
        orderId: order._id
      });

      await wallet.save();
      actualRefundAmount = refundAmount;
      refundMessage = ` ₹${refundAmount} refunded to wallet.`;
    } else if (order.paymentMethod === 'ONLINE' && (!order.isPaid || order.paymentStatus !== 'Completed')) {
      // Payment failed or pending - no refund needed
      refundMessage = ' No refund needed as payment was not completed.';
    }

    res.status(200).json({
      success: true,
      message: `Item cancelled successfully.${refundMessage}`,
      refundAmount: actualRefundAmount,
      orderStatus: order.status
    });

  } catch (error) {
    console.error("Cancel order item error:", error);
    next(error);
  }
};


const debugOrderIds = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

        const orderData = orders.map(order => ({
            fullId: order._id.toString(),
            displayId: '#' + order._id.toString().slice(-8).toUpperCase(),
            createdAt: order.createdAt,
            totalAmount: order.totalAmount
        }));

        res.json({
            success: true,
            totalOrders: orders.length,
            orders: orderData
        });
    } catch (error) {
        console.error("Debug order IDs error:", error);
        res.status(500).json({ success: false, error: error.message });
    }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, address } = req.body;
    console.log(req.body, 'this is body');

    const selectedAddress = await addressSchema.findById(address);
    if (!selectedAddress) {
        return res.json({ success: false, message: "Invalid Address" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    const cart = await cartSchema.find({ user: req.session.user }).populate('items.product').lean();
    if (!cart || cart.length === 0) {
        return res.json({ success: false, message: "Item not found in cart" });
    }

    let cartItems = [];
    for (let item of cart) {
        for (let it of item.items) {
            cartItems.push(it);
        }
    }

    // Create Razorpay order options
    const options = {
        amount: amount * 100,
        currency: "INR",
        receipt: `rcpt_${Math.floor(Math.random() * 100000)}`,
        payment_capture: 1
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);

    // Create local order with pending status
    const localOrder = await Order.create({
        user: req.session.user._id,
        address: {
            fullName: selectedAddress.fullName,
            phone: selectedAddress.phone,
            addressLine: selectedAddress.address,
            city: selectedAddress.city,
            pincode: selectedAddress.pinCode,
            state: selectedAddress.state
        },
        items: cartItems,
        totalAmount: amount,
        status: "Pending",
        paymentStatus: "Pending",
        isPaid: false,
        paymentMethod: "ONLINE",
        razorpayOrderId: razorpayOrder.id
    });

    res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      localOrderId: localOrder._id
    });

  } catch (err) {
    console.error("Razorpay Order Creation Failed:", err);
    return res.status(500).json({ success: false, message: "Failed to create order" });
  }
};

// Payment verification function
const verifyPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, localOrderId } = req.body;

        // Verify payment signature
        const crypto = require('crypto');
        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        const isAuthentic = expectedSignature === razorpay_signature;

        if (isAuthentic) {
            // Payment successful - update order
            const order = await Order.findById(localOrderId);
            if (!order) {
                return res.status(404).json({ success: false, message: "Order not found" });
            }

            // Update order status
            order.status = "Placed";
            order.paymentStatus = "Completed";
            order.isPaid = true;
            order.paymentId = razorpay_payment_id;
            await order.save();

            // Clear cart
            const cart = await Cart.findOne({ user: req.session.user._id });
            if (cart) {
                cart.items = [];
                await cart.save();
            }

            // Update product quantities
            for (const item of order.items) {
                const product = await productSchema.findById(item.product);
                if (product && product.variants.length > 0) {
                    const variant = product.variants[0];
                    variant.quantity -= item.quantity;
                    await product.save();
                }
            }

            res.json({
                success: true,
                orderId: order._id,
                redirectUrl: `/order-success?orderId=${order._id}`
            });
        } else {
            // Payment verification failed
            const order = await Order.findById(localOrderId);
            if (order) {
                order.status = "Failed";
                order.paymentStatus = "Failed";
                order.isPaid = false;
                await order.save();
            }

            res.json({
                success: false,
                message: "Payment verification failed",
                redirectUrl: `/payment-failure?orderId=${localOrderId}`
            });
        }
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({
            success: false,
            message: "Payment verification failed",
            redirectUrl: `/payment-failure`
        });
    }
};

// Payment failure page controller
const getPaymentFailure = async (req, res, next) => {
    try {
        const orderId = req.query.orderId;
        let order = null;

        if (orderId) {
            order = await Order.findById(orderId)
                .populate('items.product')
                .populate('user');

            // Verify order belongs to current user
            if (order && order.user._id.toString() !== req.session.user._id.toString()) {
                order = null;
            }
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/paymentFailure', {
            user: req.session.user,
            order,
            cloudName
        });
    } catch (error) {
        console.error("Payment failure page error:", error);
        next(error);
    }
};

// Update order status (for payment failures)
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, paymentStatus } = req.body;
        const userId = req.session.user._id;

        const order = await Order.findById(orderId);
        if (!order || order.user.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // Update order status
        if (status) order.status = status;
        if (paymentStatus) order.paymentStatus = paymentStatus;

        await order.save();

        res.json({ success: true, message: "Order status updated" });
    } catch (error) {
        console.error("Update order status error:", error);
        res.status(500).json({ success: false, message: "Failed to update order status" });
    }
};


module.exports = {
    validateCartForCheckout,
    checkoutGetController,
    addNewAddress,
    deleteCheckAddress,
    getPayment,
    placeOrder,
    getOrderSuccess,
    getOrderDetails,
    getMyOrders,
    cancelOrder,
    cancelOrderItem,
    debugOrderIds,
    createRazorpayOrder,
    verifyPayment,
    getPaymentFailure,
    updateOrderStatus,
    getRetry
};
