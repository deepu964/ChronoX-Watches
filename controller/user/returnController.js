const Order = require('../../models/orderSchema');
const Return = require('../../models/returnSchema');
const Wallet = require('../../models/walletSchema');
const logger = require('../../utils/logger');

const getMyReturns = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 5;
    const skip = (page - 1) * limit;

    const totalReturns = await Return.countDocuments({ user: userId });
    const totalPages = Math.ceil(totalReturns / limit);

    const returns = (
      await Return.find({ user: userId })
        .populate('order')
        .populate('items.product', 'name images')
        .sort({ requestedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
    ).filter((r) => r.order);

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    res.render('user/myReturns', {
      user: req.session.user,
      returns,
      cloudName,
      currentPage: page,
      totalPages,
      totalReturns,
    });
  } catch (error) {
    logger.error('My returns page error:', error);
    next(error);
  }
};

const requestReturn = async (req, res, next) => {
  try {
    const { orderId, reason, description, items } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findById(orderId).populate('items.product');
    if (!order || order.user.toString() !== userId.toString()) {
      return res
        .status(404)
        .json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'Delivered') {
      return res.status(400).json({
        success: false,
        message: 'Returns are only allowed for delivered orders',
      });
    }

    const existingReturn = await Return.findOne({ order: orderId });
    if (existingReturn) {
      return res.status(400).json({
        success: false,
        message: 'Return request already exists for this order',
      });
    }

    let totalRefundAmount = 0;
    const returnItems = [];

    for (const item of items) {
      const orderItem = order.items.find(
        (oi) => oi.product._id.toString() === item.productId
      );
      if (!orderItem) {
        return res.status(400).json({
          success: false,
          message: 'Invalid product in return request',
        });
      }

      if (item.quantity > orderItem.quantity) {
        return res.status(400).json({
          success: false,
          message: 'Return quantity cannot exceed ordered quantity',
        });
      }

      const itemTotal = orderItem.price * item.quantity;
      let couponShare = 0;

      if (
        order.coupon &&
        order.coupon.discountAmount > 0 &&
        order.totalBeforeDiscount > 0
      ) {
        const fullItemValue = orderItem.price * orderItem.quantity;
        const itemLevelCouponShare =
          (fullItemValue / order.totalBeforeDiscount) *
          order.coupon.discountAmount;
        couponShare =
          (item.quantity / orderItem.quantity) * itemLevelCouponShare;
      }

      const refundAmount = itemTotal - couponShare;
      totalRefundAmount += refundAmount;

      returnItems.push({
        product: item.productId,
        quantity: item.quantity,
        price: orderItem.price,
        reason: item.reason || reason,
        refundAmount,
        couponShare,
      });
    }

    const returnRequest = new Return({
      user: userId,
      order: orderId,
      items: returnItems,
      totalRefundAmount,
      reason,
      description,
    });

    await returnRequest.save();

    await Wallet.updateOne(
      { user: userId },
      {
        $inc: { balance: totalRefundAmount },
        $push: {
          transactions: {
            type: 'credit',
            amount: totalRefundAmount,
            description: `Refund for return - Order ${orderId}`,
            date: new Date(),
          },
        },
      },
      { upsert: true }
    );

    res.json({
      success: true,
      message:
        'Return request submitted successfully. We will review it within 24-48 hours.',
      returnId: returnRequest._id,
    });
  } catch (error) {
    logger.error(' Return request error:', error);
    next(error);
  }
};

module.exports = {
  requestReturn,
  getMyReturns,
};
