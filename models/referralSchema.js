const mongoose = require('mongoose');

const referralSchema = new mongoose.Schema(
  {
    referrer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referred: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    referralCode: {
      type: String,
      required: true,
    },
    rewardAmount: {
      type: Number,
      default: 50,
    },
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed'],
      default: 'Completed',
    },
    rewardGiven: {
      type: Boolean,
      default: false,
    },
    rewardGivenAt: {
      type: Date,
    },
    notes: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
referralSchema.index({ referrer: 1, createdAt: -1 });
referralSchema.index({ referred: 1 });
referralSchema.index({ referralCode: 1 });
referralSchema.index({ status: 1, createdAt: -1 });
referralSchema.index({ rewardGiven: 1, createdAt: -1 });

// Static method to get referral statistics
referralSchema.statics.getReferralStats = async function () {
  const stats = await this.aggregate([
    {
      $group: {
        _id: null,
        totalReferrals: { $sum: 1 },
        completedReferrals: {
          $sum: { $cond: [{ $eq: ['$status', 'Completed'] }, 1, 0] },
        },
        totalRewardsGiven: {
          $sum: { $cond: ['$rewardGiven', '$rewardAmount', 0] },
        },
        pendingRewards: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$status', 'Completed'] },
                  { $eq: ['$rewardGiven', false] },
                ],
              },
              '$rewardAmount',
              0,
            ],
          },
        },
      },
    },
  ]);

  return (
    stats[0] || {
      totalReferrals: 0,
      completedReferrals: 0,
      totalRewardsGiven: 0,
      pendingRewards: 0,
    }
  );
};

// Static method to get top referrers
referralSchema.statics.getTopReferrers = async function (limit = 10) {
  return await this.aggregate([
    { $match: { status: 'Completed' } },
    {
      $group: {
        _id: '$referrer',
        totalReferrals: { $sum: 1 },
        totalRewards: { $sum: '$rewardAmount' },
      },
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'referrerInfo',
      },
    },
    { $unwind: '$referrerInfo' },
    {
      $project: {
        _id: 1,
        totalReferrals: 1,
        totalRewards: 1,
        fullname: '$referrerInfo.fullname',
        email: '$referrerInfo.email',
        referralCode: '$referrerInfo.referralCode',
      },
    },
    { $sort: { totalReferrals: -1 } },
    { $limit: limit },
  ]);
};

module.exports = mongoose.model('Referral', referralSchema);
