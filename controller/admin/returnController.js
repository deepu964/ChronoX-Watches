const ReturnRequest = require('../../models/returnRequestSchema');
const Order = require('../../models/orderSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const productSchema = require('../../models/productSchema');

// Get all return requests with filtering and pagination
const getReturnRequests = async (req, res, next) => {
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
            // Search in order ID or user details
            const orders = await Order.find({
                $or: [
                    { '_id': { $regex: search, $options: 'i' } },
                    { 'address.fullName': { $regex: search, $options: 'i' } }
                ]
            }).select('_id');
            
            const orderIds = orders.map(order => order._id);
            filter.order = { $in: orderIds };
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
        const totalRequests = await ReturnRequest.countDocuments(filter);
        const totalPages = Math.ceil(totalRequests / limit);
        
        // Get return requests with populated data
        const returnRequests = await ReturnRequest.find(filter)
            .populate('user', 'fullname email')
            .populate('order')
            .populate('items.product', 'name images')
            .populate('reviewedBy', 'email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        
        // Get return request statistics
        const stats = await getReturnStats();
        
        res.render('admin/returnRequests', {
            returnRequests,
            currentPage: page,
            totalPages,
            totalRequests,
            stats,
            filters: {
                status,
                search,
                dateFrom,
                dateTo
            }
        });
        
    } catch (error) {
        console.error("Get return requests error:", error);
        next(error);
    }
};

// Get detailed view of a specific return request
const getReturnRequestDetails = async (req, res, next) => {
    try {
        const returnRequestId = req.params.returnRequestId;
        
        const returnRequest = await ReturnRequest.findById(returnRequestId)
            .populate('user', 'fullname email mobile')
            .populate('order')
            .populate('items.product', 'name images brand model')
            .populate('reviewedBy', 'email');
        
        if (!returnRequest) {
            return res.status(404).render('admin/404', { message: 'Return request not found' });
        }
        
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        
        res.render('admin/returnRequestDetails', {
            returnRequest,
            cloudName
        });
        
    } catch (error) {
        console.error("Get return request details error:", error);
        next(error);
    }
};

// Update return request status
const updateReturnStatus = async (req, res, next) => {
    try {
        const returnRequestId = req.params.returnRequestId;
        const { status, adminNotes } = req.body;
        const adminId = req.session.admin?.id || req.session.admin?._id;

        console.log("Update return status request:");
        console.log("- Return Request ID:", returnRequestId);
        console.log("- New Status:", status);
        console.log("- Admin Notes:", adminNotes);
        console.log("- Admin ID:", adminId);
        console.log("- Admin Session:", req.session.admin);

        const validStatuses = [
            'Pending', 'Under Review', 'Approved', 'Rejected',
            'Product Received', 'Refund Processed', 'Completed', 'Cancelled'
        ];

        if (!validStatuses.includes(status)) {
            console.log("Invalid status provided:", status);
            return res.status(400).json({
                success: false,
                message: 'Invalid status'
            });
        }
        
        const returnRequest = await ReturnRequest.findById(returnRequestId)
            .populate('user')
            .populate('order');

        console.log("Return request found:", returnRequest ? "Yes" : "No");
        if (returnRequest) {
            console.log("Current status:", returnRequest.status);
        }

        if (!returnRequest) {
            console.log("Return request not found in database");
            return res.status(404).json({
                success: false,
                message: 'Return request not found'
            });
        }

        // Update status
        console.log("Attempting to update status...");
        try {
            await returnRequest.updateStatus(status, adminId, adminNotes);
            console.log("Status updated successfully");
        } catch (updateError) {
            console.log("Error updating status:", updateError.message);
            throw updateError;
        }
        
        // If status is "Refund Processed", process the refund
        if (status === 'Refund Processed' && !returnRequest.isRefunded) {
            await processRefund(returnRequest);
        }
        
        res.json({ 
            success: true, 
            message: 'Return request status updated successfully',
            newStatus: status
        });
        
    } catch (error) {
        console.error("Update return status error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update return status' 
        });
    }
};

// Process refund to user's wallet
const processRefund = async (returnRequest) => {
    try {
        const userId = returnRequest.user._id;
        
        // Get or create user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0 });
            await wallet.save();
            
            // Update user's wallet reference
            await User.findByIdAndUpdate(userId, { wallet: wallet._id });
        }
        
        // Add refund amount to wallet
        const description = `Refund for return request #${returnRequest._id.toString().slice(-8).toUpperCase()}`;
        await wallet.addMoney(
            returnRequest.totalRefundAmount, 
            description, 
            returnRequest.order, 
            returnRequest._id
        );
        
        // Update return request
        returnRequest.isRefunded = true;
        returnRequest.refundedAt = new Date();
        await returnRequest.save();
        
        console.log(`Refund processed: ₹${returnRequest.totalRefundAmount} added to user ${userId} wallet`);
        
    } catch (error) {
        console.error("Process refund error:", error);
        throw error;
    }
};

// Get return request statistics
const getReturnStats = async () => {
    try {
        const totalRequests = await ReturnRequest.countDocuments();
        const pendingRequests = await ReturnRequest.countDocuments({ status: 'Pending' });
        const underReviewRequests = await ReturnRequest.countDocuments({ status: 'Under Review' });
        const approvedRequests = await ReturnRequest.countDocuments({ status: 'Approved' });
        const rejectedRequests = await ReturnRequest.countDocuments({ status: 'Rejected' });
        const completedRequests = await ReturnRequest.countDocuments({ status: 'Completed' });
        
        // Calculate total refund amount
        const refundResult = await ReturnRequest.aggregate([
            { $match: { isRefunded: true } },
            { $group: { _id: null, totalRefunded: { $sum: '$totalRefundAmount' } } }
        ]);
        
        const totalRefunded = refundResult.length > 0 ? refundResult[0].totalRefunded : 0;
        
        // Get today's return requests
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const todayRequests = await ReturnRequest.countDocuments({
            createdAt: { $gte: today, $lt: tomorrow }
        });
        
        return {
            totalRequests,
            pendingRequests,
            underReviewRequests,
            approvedRequests,
            rejectedRequests,
            completedRequests,
            totalRefunded,
            todayRequests
        };
        
    } catch (error) {
        console.error("Get return stats error:", error);
        return {
            totalRequests: 0,
            pendingRequests: 0,
            underReviewRequests: 0,
            approvedRequests: 0,
            rejectedRequests: 0,
            completedRequests: 0,
            totalRefunded: 0,
            todayRequests: 0
        };
    }
};

// Bulk approve return requests
const bulkApproveReturns = async (req, res, next) => {
    try {
        const { returnRequestIds } = req.body;
        const adminId = req.session.admin?.id || req.session.admin?._id;

        console.log("Bulk approve request:");
        console.log("- Return Request IDs:", returnRequestIds);
        console.log("- Admin ID:", adminId);
        
        if (!Array.isArray(returnRequestIds) || returnRequestIds.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'No return requests selected' 
            });
        }
        
        const updateResult = await ReturnRequest.updateMany(
            { 
                _id: { $in: returnRequestIds },
                status: { $in: ['Pending', 'Under Review'] }
            },
            { 
                status: 'Approved',
                reviewedBy: adminId,
                reviewedAt: new Date()
            }
        );
        
        res.json({ 
            success: true, 
            message: `${updateResult.modifiedCount} return requests approved successfully`
        });
        
    } catch (error) {
        console.error("Bulk approve returns error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to approve return requests' 
        });
    }
};

module.exports = {
    getReturnRequests,
    getReturnRequestDetails,
    updateReturnStatus,
    processRefund,
    getReturnStats,
    bulkApproveReturns
};
