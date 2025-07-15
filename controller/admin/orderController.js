const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Return = require('../../models/returnSchema');
const Wallet = require('../../models/walletSchema');


const getOrders = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        
        let searchQuery = {};
        if (search) {
           
            const users = await User.find({
                $or: [
                    { fullname: { $regex: search, $options: 'i' } },
                    { email: { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            
            const userIds = users.map(user => user._id);
            
            searchQuery = {
                $or: [
                    { user: { $in: userIds } },
                    { status: { $regex: search, $options: 'i' } }
                ]
            };
        }

        
        const total = await Order.countDocuments(searchQuery);
        const totalPages = Math.ceil(total / limit);

        
        const orders = await Order.find(searchQuery)
            .populate('user', 'fullname email mobile')
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('admin/orders', {
            orders,
            currentPage: page,
            totalPages,
            search,
            total,
            limit,
            cloudName
        });

    } catch (error) {
        console.error('Error fetching orders:', error);
        next(error);
    }
};

const getOrderDetails = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId)
            .populate('user', 'fullname email mobile')
            .populate('items.product', 'name images brand model');

        
        const returnRequest = await Return.findOne({ order: orderId })
            .populate('items.product', 'name');

        if (!order) {
            return res.status(404).render('admin/404', { message: 'Order not found' });
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        res.render('admin/orderDetails', { order, cloudName, returnRequest });

    } catch (error) {
        console.error('Error fetching order details:', error);
        next(error);
    }
};

const updateOrderStatus = async (req, res, next) => {
    try {
        const orderId = req.params.id;
        const { status } = req.body;

        const validStatuses = ['Placed', 'Pending', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }

        res.json({ 
            success: true, 
            message: 'Order status updated successfully',
            newStatus: status
        });

    } catch (error) {
        console.error('Error updating order status:', error);
        next(error);
    }
};

const processReturn = async (req, res, next) => {
  try {
    const returnId = req.params.id;
    const { action, adminNotes } = req.body;

    const returnRequest = await Return.findOne({ _id: returnId, order: { $ne: null } })
      .populate('user')
      .populate({
        path: 'order',
        populate: {
          path: 'items.product'
        }
      })
      .populate('items.product');

    if (!returnRequest) {
      return res.status(404).json({
        success: false,
        message: 'Return request not found'
      });
    }

    if (returnRequest.status !== 'Requested' && returnRequest.status !== 'Under Review') {
      return res.status(400).json({
        success: false,
        message: 'Return request has already been processed'
      });
    }

    if (action === 'approve') {
      returnRequest.status = 'Approved';
      returnRequest.reviewedAt = new Date();
      returnRequest.adminNotes = adminNotes;
      await returnRequest.save();

      let totalItemsInOrder = returnRequest.order.items.length;
      let couponAmount = returnRequest.order.coupon?.discountAmount || 0;
      let perItemCoupon = totalItemsInOrder > 0 ? couponAmount / totalItemsInOrder : 0;

      let totalRefund = 0;

      for (const item of returnRequest.items) {
        let itemPrice = Number(item.price) || 0;
        let couponShare = Number(perItemCoupon) || 0;
        let itemRefund = itemPrice - couponShare;
        totalRefund += itemRefund;
      }

      totalRefund = Math.round(totalRefund * 100) / 100; 

      
      let wallet = await Wallet.findOne({ user: returnRequest.user._id });
      if (!wallet) {
        wallet = new Wallet({
          user: returnRequest.user._id,
          balance: 0,
          transactions: []
        });
      }

      await wallet.addMoney(
        totalRefund,
        `Refund for return request #${returnRequest._id.toString().slice(-8)}`,
        returnRequest.order._id,
        returnRequest._id
      );

      
      await User.findByIdAndUpdate(returnRequest.user._id, {
        $setOnInsert: { wallet: wallet._id }
      }, { upsert: false });

      
      for (const item of returnRequest.items) {
        if (item.product && item.product._id) {
          const product = await Product.findById(item.product._id);
          if (product && product.variants[0].quantity !== undefined) {
            product.variants[0].quantity += item.quantity;
            await product.save();
          }
        }
      }

      returnRequest.status = 'Approved';
      returnRequest.refundedAt = new Date();
      await returnRequest.save();

      return res.json({
        success: true,
        message: 'Return approved and refund credited to user wallet successfully.',
        refundAmount: totalRefund,
        customerInfo: {
          name: returnRequest.user.fullname,
          email: returnRequest.user.email
        }
      });

    } else if (action === 'reject') {
      returnRequest.status = 'Rejected';
      returnRequest.reviewedAt = new Date();
      returnRequest.adminNotes = adminNotes;
      await returnRequest.save();

      return res.json({
        success: true,
        message: 'Return request rejected successfully'
      });

    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid action. Use "approve" or "reject"'
      });
    }

  } catch (error) {
    console.error('Process return error:', error);
    next(error);
  }
};

const getReturns = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        const search = req.query.search || '';

        let searchQuery = {};
        if (search) {
            searchQuery = {
                $or: [
                    { status: { $regex: search, $options: 'i' } },
                    { reason: { $regex: search, $options: 'i' } }
                ]
            };
        }

        const fullQuery = { ...searchQuery, order: { $ne: null } };
        const total = await Return.countDocuments(searchQuery);
        const totalPages = Math.ceil(total / limit);

        const returns = await Return.find(fullQuery)
            .populate('user', 'fullname email')
            .populate('order')
            .populate('items.product', 'name')
            .sort({ requestedAt: -1 })
            .skip(skip)
            .limit(limit);
           
        
        res.render('admin/returns', {
            returns,
            currentPage: page,
            totalPages,
            search,
            total,
            limit
        });

    } catch (error) {
        console.error('Error fetching returns:', error);
        next(error);
    }
};



module.exports = {
    getOrders,
    getOrderDetails,
    updateOrderStatus,
    processReturn,
    getReturns
};
