const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');

const requestReturn = async (req, res, next) => {
    try {
        const { orderId, reason, description, items } = req.body;
        const userId = req.session.user._id;

        const order = await Order.findById(orderId).populate('items.product');
        if (!order || order.user.toString() !== userId.toString()) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.status !== 'Delivered') {
            return res.status(400).json({ success: false, message: 'Returns are only allowed for delivered orders' });
        }

        const existingReturn = await Return.findOne({ order: orderId });
        if (existingReturn) {
            return res.status(400).json({ success: false, message: 'Return request already exists for this order' });
        }

        let totalRefundAmount = 0;
        const returnItems = [];

        for (const item of items) {
            const orderItem = order.items.find(oi => oi.product._id.toString() === item.productId);
            if (!orderItem) {
                return res.status(400).json({ success: false, message: 'Invalid product in return request' });
            }

            if (item.quantity > orderItem.quantity) {
                return res.status(400).json({ success: false, message: 'Return quantity cannot exceed ordered quantity' });
            }

            const refundAmount = orderItem.price * item.quantity;
            totalRefundAmount += refundAmount;

            returnItems.push({
                product: item.productId,
                quantity: item.quantity,
                price: orderItem.price,
                reason: item.reason || reason
            });
        }

        const returnRequest = new Return({
            user: userId,
            order: orderId,
            items: returnItems,
            totalRefundAmount,
            reason,
            description
        });

        await returnRequest.save();

        res.json({
            success: true,
            message: 'Return request submitted successfully. We will review it within 24-48 hours.',
            returnId: returnRequest._id
        });

    } catch (error) {
        console.error('Return request error:', error);
        next(error);
    }
};

const getMyReturns = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 5;
        const skip = (page - 1) * limit;

        const totalReturns = await Return.countDocuments({ user: userId });
        const totalPages = Math.ceil(totalReturns / limit);

        const returns = (await Return.find({ user: userId })
            .populate('order')
            .populate('items.product', 'name images')
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean())
            .filter(r => r.order);

        console.log(returns,'this is returrn');
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('user/myReturns', {
            user: req.session.user,
            returns,
            cloudName,
            currentPage: page,
            totalPages,
            totalReturns
        });
    } catch (error) {
        console.error("My returns page error:", error);
        next(error);
    }
};

module.exports = {
    requestReturn,
    getMyReturns
};
