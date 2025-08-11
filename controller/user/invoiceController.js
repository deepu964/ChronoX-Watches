const Order = require('../../models/orderSchema');
const logger = require('../../utils/logger');

const generateInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate('user')
      .populate('items.product');

    if (!order) {
      return res.status(404).send('Order not found');
    }

    return res.render('user/invoice', { order });
  } catch (error) {
    logger.error('this is invoice error');
    next(error);
  }
};

module.exports = {
  generateInvoice,
};
