const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const productSchema = require('../../models/productSchema');

// Get all orders with pagination and filtering
const getOrderList = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        // Filter options
        const status = req.query.status || '';
        const search = req.query.search || '';
        const dateFrom = req.query.dateFrom || '';
        const dateTo = req.query.dateTo || '';
        
        // Build filter query
        let filter = {};
        
        if (status && status !== 'all') {
            filter.status = status;
        }
        
        if (search) {
            filter.$or = [
                { '_id': { $regex: search, $options: 'i' } },
                { 'address.fullName': { $regex: search, $options: 'i' } },
                { 'address.phone': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (dateFrom || dateTo) {
            filter.createdAt = {};
            if (dateFrom) {
                filter.createdAt.$gte = new Date(dateFrom);
            }
            if (dateTo) {
                filter.createdAt.$lte = new Date(dateTo + 'T23:59:59.999Z');
            }
        }
        
        // Get total count for pagination
        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);
        
        // Get orders with populated data
        const orders = await Order.find(filter)
            .populate('user', 'fullname email')
            .populate('items.product', 'name images')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get order statistics
        const stats = await getOrderStats();
        
        res.render('admin/orders', {
            orders,
            currentPage: page,
            totalPages,
            totalOrders,
            stats,
            filters: {
                status,
                search,
                dateFrom,
                dateTo
            }
        });
        
    } catch (error) {
        console.error("Order list error:", error);
        next(error);
    }
};

// Get detailed view of a specific order
const getOrderDetails = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        
        const order = await Order.findById(orderId)
            .populate('user', 'fullname email mobile')
            .populate('items.product', 'name images brand model');
        
        if (!order) {
            return res.status(404).render('admin/404', { message: 'Order not found' });
        }
        
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        
        res.render('admin/orderDetails', {
            order,
            cloudName
        });
        
    } catch (error) {
        console.error("Order details error:", error);
        next(error);
    }
};

// Update order status
const updateOrderStatus = async (req, res, next) => {
    try {
        const orderId = req.params.orderId;
        const { status } = req.body;
        
        const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
        
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid status' 
            });
        }
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ 
                success: false, 
                message: 'Order not found' 
            });
        }
        
        // Prevent status changes for delivered or cancelled orders
        if (order.status === 'Delivered' || order.status === 'Cancelled') {
            return res.status(400).json({ 
                success: false, 
                message: 'Cannot change status of delivered or cancelled orders' 
            });
        }
        
        order.status = status;
        await order.save();
        
        res.json({ 
            success: true, 
            message: 'Order status updated successfully',
            newStatus: status
        });
        
    } catch (error) {
        console.error("Update order status error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update order status' 
        });
    }
};

// Get order statistics for dashboard
const getOrderStats = async () => {
    try {
        const totalOrders = await Order.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'Placed' });
        const processingOrders = await Order.countDocuments({ status: 'Processing' });
        const shippedOrders = await Order.countDocuments({ status: 'Shipped' });
        const deliveredOrders = await Order.countDocuments({ status: 'Delivered' });
        const cancelledOrders = await Order.countDocuments({ status: 'Cancelled' });
        
        // Calculate total revenue
        const revenueResult = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, totalRevenue: { $sum: '$totalAmount' } } }
        ]);
        
        const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
        
        // Get today's orders
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayOrders = await Order.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        return {
            totalOrders,
            pendingOrders,
            processingOrders,
            shippedOrders,
            deliveredOrders,
            cancelledOrders,
            totalRevenue,
            todayOrders
        };
        
    } catch (error) {
        console.error("Get order stats error:", error);
        return {
            totalOrders: 0,
            pendingOrders: 0,
            processingOrders: 0,
            shippedOrders: 0,
            deliveredOrders: 0,
            cancelledOrders: 0,
            totalRevenue: 0,
            todayOrders: 0
        };
    }
};

// Export orders to CSV
const exportOrdersCSV = async (req, res, next) => {
    try {
        const orders = await Order.find()
            .populate('user', 'fullname email')
            .populate('items.product', 'name')
            .sort({ createdAt: -1 });
        
        let csv = 'Order ID,Customer Name,Email,Total Amount,Status,Payment Method,Order Date,Items\n';
        
        orders.forEach(order => {
            const items = order.items.map(item => 
                `${item.product.name} (${item.quantity})`
            ).join('; ');
            
            csv += `${order._id},${order.address.fullName},${order.user.email},${order.totalAmount},${order.status},${order.paymentMethod},${order.createdAt.toISOString().split('T')[0]},"${items}"\n`;
        });
        
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
        res.send(csv);
        
    } catch (error) {
        console.error("Export orders CSV error:", error);
        next(error);
    }
};

module.exports = {
    getOrderList,
    getOrderDetails,
    updateOrderStatus,
    getOrderStats,
    exportOrdersCSV
};
