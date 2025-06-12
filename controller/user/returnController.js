const ReturnRequest = require('../../models/returnRequestSchema');
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const productSchema = require('../../models/productSchema');

// Get return request form for a specific order
const getReturnRequestForm = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;

        console.log("Return request form - Order ID:", orderId);
        console.log("Return request form - User ID:", userId);

        // Get order details
        const order = await Order.findById(orderId)
            .populate('items.product')
            .populate('user');

        console.log("Order found:", order ? "Yes" : "No");
        if (order) {
            console.log("Order status:", order.status);
            console.log("Order user ID:", order.user._id.toString());
            console.log("Current user ID:", userId.toString());
        }

        if (!order || order.user._id.toString() !== userId.toString()) {
            console.log("Order not found or user mismatch - rendering 404");
            return res.status(404).render('user/page-404', {
                user: req.session.user,
                message: 'Order not found'
            });
        }

        // Check if order is eligible for return (delivered and within 7 days)
        console.log("Checking order eligibility - Status:", order.status);
        if (order.status !== 'Delivered') {
            console.log("Order not delivered - rendering not eligible page");
            return res.render('user/returnNotEligible', {
                user: req.session.user,
                message: 'Only delivered orders can be returned',
                order
            });
        }

        const daysSinceDelivery = Math.floor((new Date() - order.createdAt) / (1000 * 60 * 60 * 24));
        console.log("Days since delivery:", daysSinceDelivery);
        if (daysSinceDelivery > 7) {
            console.log("Return period expired - rendering not eligible page");
            return res.render('user/returnNotEligible', {
                user: req.session.user,
                message: 'Return period has expired. Returns are only allowed within 7 days of delivery.',
                order
            });
        }

        // Check if return request already exists
        const existingReturn = await ReturnRequest.findOne({ order: orderId });
        console.log("Existing return request:", existingReturn ? "Found" : "None");
        if (existingReturn) {
            console.log("Redirecting to existing return request");
            return res.redirect(`/return-request-details/${existingReturn._id}`);
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        console.log("All checks passed - rendering return request form");
        res.render('user/returnRequestForm', {
            user: req.session.user,
            order,
            cloudName
        });

    } catch (error) {
        console.error("Get return request form error:", error);
        next(error);
    }
};

// Submit return request
const submitReturnRequest = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user._id;
        const { items, requestReason, pickupAddress } = req.body;

        // Validate order
        const order = await Order.findById(orderId).populate('items.product');
        if (!order || order.user.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Only delivered orders can be returned' });
        }

        // Check if return request already exists
        const existingReturn = await ReturnRequest.findOne({ order: orderId });
        if (existingReturn) {
            return res.status(400).json({ success: false, message: 'Return request already exists for this order' });
        }

        // Validate and process return items
        const returnItems = [];
        let totalRefundAmount = 0;

        for (const item of items) {
            const orderItem = order.items.find(oi => oi.product._id.toString() === item.productId);
            if (!orderItem) {
                return res.status(400).json({ success: false, message: 'Invalid product in return request' });
            }

            if (item.quantity > orderItem.quantity) {
                return res.status(400).json({ success: false, message: 'Return quantity cannot exceed ordered quantity' });
            }

            returnItems.push({
                product: item.productId,
                quantity: parseInt(item.quantity),
                price: orderItem.price,
                reason: item.reason,
                condition: item.condition
            });

            totalRefundAmount += orderItem.price * parseInt(item.quantity);
        }

        // Create return request
        const returnRequest = new ReturnRequest({
            user: userId,
            order: orderId,
            items: returnItems,
            totalRefundAmount,
            requestReason,
            pickupAddress: JSON.parse(pickupAddress)
        });

        await returnRequest.save();

        res.json({ 
            success: true, 
            message: 'Return request submitted successfully',
            returnRequestId: returnRequest._id
        });

    } catch (error) {
        console.error("Submit return request error:", error);
        res.status(500).json({ success: false, message: 'Failed to submit return request' });
    }
};

// Get return request details
const getReturnRequestDetails = async (req, res, next) => {
    try {
        const returnRequestId = req.params.returnRequestId;
        const userId = req.session.user._id;

        const returnRequest = await ReturnRequest.findById(returnRequestId)
            .populate('user')
            .populate('order')
            .populate('items.product')
            .populate('reviewedBy');

        if (!returnRequest || returnRequest.user._id.toString() !== userId.toString()) {
            return res.status(404).render('user/page-404', {
                user: req.session.user,
                message: 'Return request not found'
            });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/returnRequestDetails', {
            user: req.session.user,
            returnRequest,
            cloudName
        });

    } catch (error) {
        console.error("Get return request details error:", error);
        next(error);
    }
};

// Get user's return requests list
const getMyReturnRequests = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const totalRequests = await ReturnRequest.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalRequests / limit);

        const returnRequests = await ReturnRequest.find({ user: userId })
            .populate('order')
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/myReturnRequests', {
            user: req.session.user,
            returnRequests,
            cloudName,
            currentPage: page,
            totalPages,
            totalRequests
        });

    } catch (error) {
        console.error("Get my return requests error:", error);
        next(error);
    }
};

// Cancel return request
const cancelReturnRequest = async (req, res, next) => {
    try {
        const returnRequestId = req.params.returnRequestId;
        const userId = req.session.user._id;

        const returnRequest = await ReturnRequest.findById(returnRequestId);

        if (!returnRequest || returnRequest.user.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Return request not found' });
        }

        if (!['Pending', 'Under Review'].includes(returnRequest.status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot cancel return request in current status' 
            });
        }

        returnRequest.status = 'Cancelled';
        await returnRequest.save();

        res.json({ success: true, message: 'Return request cancelled successfully' });

    } catch (error) {
        console.error("Cancel return request error:", error);
        res.status(500).json({ success: false, message: 'Failed to cancel return request' });
    }
};

module.exports = {
    getReturnRequestForm,
    submitReturnRequest,
    getReturnRequestDetails,
    getMyReturnRequests,
    cancelReturnRequest
};
