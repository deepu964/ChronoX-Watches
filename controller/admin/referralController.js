const User = require('../../models/userSchema');
const Referral = require('../../models/referralSchema');
const Wallet = require('../../models/walletSchema');


const getReferralList = async (req, res, next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

       
        let searchQuery = {};
        if (search) {
            
            const users = await User.find({
                $or: [
                    { fullname: { $regex: search, $options: "i" } },
                    { email: { $regex: search, $options: "i" } },
                    { referralCode: { $regex: search, $options: "i" } }
                ]
            }).select('_id');
            
            const userIds = users.map(user => user._id);
            searchQuery = {
                $or: [
                    { referrer: { $in: userIds } },
                    { referred: { $in: userIds } },
                    { referralCode: { $regex: search, $options: "i" } }
                ]
            };
        }

        const totalReferrals = await Referral.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalReferrals / limit);

        const referrals = await Referral.find(searchQuery)
            .populate('referrer', 'fullname email referralCode')
            .populate('referred', 'fullname email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);


            

        res.render('admin/referrals', {
            referrals,
            currentPage: page,
            totalPages,
            search,
            totalReferrals,
            limit
        });

    } catch (error) {
        console.error('Error fetching referral list:', error);
        next(error);
    }
};

const getReferralStats = async (req, res, next) => {
    try {
        const stats = await Referral.getReferralStats();
        const topReferrers = await Referral.getTopReferrers(5);
        
       
        const monthlyData = await Referral.aggregate([
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    rewards: { $sum: '$rewardAmount' }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } },
            { $limit: 12 }
        ]);

        res.json({
            success: true,
            stats,
            topReferrers,
            monthlyData
        });

    } catch (error) {
        console.error('Error fetching referral stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch referral statistics' });
    }
};

const getReferralDetails = async (req, res, next) => {
    try {
        const referralId = req.params.id;
        
        const referral = await Referral.findById(referralId)
            .populate('referrer', 'fullname email mobile referralCode createdAt')
            .populate('referred', 'fullname email mobile createdAt');

        if (!referral) {
            return res.status(404).render('admin/error', { 
                message: 'Referral not found' 
            });
        }

        
        const referrerWallet = await Wallet.findOne({ user: referral.referrer._id });
        
      
        const referrerStats = await Referral.aggregate([
            { $match: { referrer: referral.referrer._id } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    totalRewards: { $sum: '$rewardAmount' },
                    successfulReferrals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    }
                }
            }
        ]);
        

        res.render('admin/referralDetails', {
            referral,
            referrerWallet,
            referrerStats: referrerStats[0] || { totalReferrals: 0, totalRewards: 0, successfulReferrals: 0 }
        });

    } catch (error) {
        console.error('Error fetching referral details:', error);
        next(error);
    }
};

const updateReferralStatus = async (req, res, next) => {
    try {
        const referralId = req.params.id;
        const { status, notes } = req.body;

        const referral = await Referral.findById(referralId);
        if (!referral) {
            return res.status(404).json({ success: false, message: 'Referral not found' });
        }

        
        if (referral.status === 'Failed' && status === 'Completed' && !referral.rewardGiven) {
            try {
                const referrer = await User.findById(referral.referrer);
                let referrerWallet = await Wallet.findOne({ user: referrer._id });
                
                if (!referrerWallet) {
                    referrerWallet = new Wallet({ user: referrer._id, balance: 0, transactions: [] });
                    await referrerWallet.save();
                    await User.findByIdAndUpdate(referrer._id, { wallet: referrerWallet._id });
                }

                await referrerWallet.addMoney(
                    referral.rewardAmount,
                    `Referral reward (Admin processed) for referring user`,
                    null,
                    null
                );

                referral.rewardGiven = true;
                referral.rewardGivenAt = new Date();
            } catch (error) {
                console.error('Error processing referral reward:', error);
                return res.status(500).json({ 
                    success: false, 
                    message: 'Failed to process referral reward' 
                });
            }
        }

        referral.status = status;
        if (notes) referral.notes = notes;
        await referral.save();

        res.json({ success: true, message: 'Referral status updated successfully' });

    } catch (error) {
        console.error('Error updating referral status:', error);
        res.status(500).json({ success: false, message: 'Failed to update referral status' });
    }
};

const getReferralAnalytics = async (req, res, next) => {
    try {
        const { period = '30' } = req.query;
        const days = parseInt(period);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);

        const analytics = await Referral.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: "%Y-%m-%d", date: "$createdAt" }
                    },
                    referrals: { $sum: 1 },
                    rewards: { $sum: '$rewardAmount' },
                    successful: {
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    }
                }
            },
            { $sort: { '_id': 1 } }
        ]);

        res.json({ success: true, analytics });

    } catch (error) {
        console.error('Error fetching referral analytics:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch analytics data' });
    }
};

module.exports = {
    getReferralList,
    getReferralStats,
    getReferralDetails,
    updateReferralStatus,
    getReferralAnalytics
};
