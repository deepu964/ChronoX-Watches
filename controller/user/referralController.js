const User = require('../../models/userSchema');
const Referral = require('../../models/referralSchema');
const Wallet = require('../../models/walletSchema');
const logger = require('../../utils/logger');

const getReferralDashboard = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
       
        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        
        const referralStats = await Referral.aggregate([
            { $match: { referrer: userId } },
            {
                $group: {
                    _id: null,
                    totalReferrals: { $sum: 1 },
                    successfulReferrals: {
                        $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] }
                    },
                    totalRewards: {
                        $sum: { $cond: ['$rewardGiven', '$rewardAmount', 0] }
                    },
                    pendingRewards: {
                        $sum: { $cond: [{ $and: [{ $eq: ['$status', 'Completed'] }, { $eq: ['$rewardGiven', false] }] }, '$rewardAmount', 0] }
                    }
                }
            }
        ]);

       
        const recentReferrals = await Referral.find({ referrer: userId })
            .populate('referred', 'fullname email createdAt')
            .sort({ createdAt: -1 })
            .limit(10);

        
        const wallet = await Wallet.findOne({ user: userId });

        const stats = referralStats[0] || {
            totalReferrals: 0,
            successfulReferrals: 0,
            totalRewards: 0,
            pendingRewards: 0
        };

        res.render('user/referralDashboard', {
            user,
            stats,
            recentReferrals,
            walletBalance: wallet ? wallet.balance : 0
        });

    } catch (error) {
        logger.error('Error fetching referral dashboard:', error);
        next(error);
    }
};

const getReferralHistory = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const totalReferrals = await Referral.countDocuments({ referrer: userId });
        const totalPages = Math.ceil(totalReferrals / limit);

        const referrals = await Referral.find({ referrer: userId })
            .populate('referred', 'fullname email createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        res.render('user/referralHistory', {
            user,
            referrals,
            currentPage: page,
            totalPages,
            totalReferrals
        });

    } catch (error) {
        logger.error('Error fetching referral history:', error);
        next(error);
    }
};

const generateReferralLink = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        
        if (!user || !user.referralCode) {
            return res.status(404).json({ 
                success: false, 
                message: 'Referral code not found' 
            });
        }

        const baseUrl = req.protocol + '://' + req.get('host');
        const referralLink = `${baseUrl}/signup?ref=${user.referralCode}`;

        res.json({
            success: true,
            referralCode: user.referralCode,
            referralLink: referralLink
        });

    } catch (error) {
        logger.error('Error generating referral link:', error);
        next(error)
    }
};

const getReferralEarnings = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        
        if (!user) {
            return res.redirect('/login');
        }

        
        const earningsData = await Referral.aggregate([
            { $match: { referrer: userId, rewardGiven: true } },
            {
                $group: {
                    _id: {
                        year: { $year: '$rewardGivenAt' },
                        month: { $month: '$rewardGivenAt' }
                    },
                    totalEarnings: { $sum: '$rewardAmount' },
                    referralCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': -1, '_id.month': -1 } },
            { $limit: 12 }
        ]);

       
        const recentEarnings = await Referral.find({ 
            referrer: userId, 
            rewardGiven: true 
        })
        .populate('referred', 'fullname email')
        .sort({ rewardGivenAt: -1 })
        .limit(10);

        
        const wallet = await Wallet.findOne({ user: userId });
        let referralTransactions = [];
        
        if (wallet) {
            referralTransactions = wallet.transactions.filter(transaction => 
                transaction.description.toLowerCase().includes('referral')
            ).slice(0, 10);
        }

        res.render('user/referralEarnings', {
            user,
            earningsData,
            recentEarnings,
            referralTransactions,
            walletBalance: wallet ? wallet.balance : 0
        });

    } catch (error) {
        logger.error('Error fetching referral earnings:', error);
        next(error);
    }
};

module.exports = {
    getReferralDashboard,
    getReferralHistory,
    generateReferralLink,
    getReferralEarnings
};
