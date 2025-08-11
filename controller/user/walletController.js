const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');
const logger = require('../../utils/logger');

const getWallet = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    let page = parseInt(req.query.page) || 1;
    const limit = 5;

    let wallet = await Wallet.findOne({ user: userId });

    if (!wallet) {
      wallet = await Wallet.findOneAndUpdate(
        { user: userId },
        { $setOnInsert: { balance: 0, transactions: [] } },
        { new: true, upsert: true }
      );
      await User.findByIdAndUpdate(userId, { wallet: wallet._id });
    }

    const totalTransactions = wallet.transactions.length;
    const totalPage = Math.ceil(totalTransactions / limit);

    const transactions = wallet.transactions
      .slice()
      .reverse()
      .slice((page - 1) * limit, page * limit);

    res.render('user/wallet', {
      user: req.session.user,
      wallet,
      transactions,
      currentPage: page,
      totalPage,
    });
  } catch (error) {
    logger.error('Wallet page error:', error);
    next(error);
  }
};

const addAmount = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid amount' });
    }

    const user = await User.findById(userId);
    let wallet = null;
    if (user.wallet) {
      wallet = await Wallet.findById(user.wallet);
    }

    if (!wallet) {
      wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
      await wallet.save();

      user.wallet = wallet._id;
      await user.save();
    }

    wallet.balance += Number(amount);

    wallet.transactions.unshift({
      type: 'credit',
      amount: Number(amount),
      date: new Date(),
      description: `Credited by ${user.fullname}`,
    });

    await wallet.save();

    res.json({ success: true, message: 'Amount added to wallet' });
  } catch (err) {
    logger.error('Add Amount Error:', err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

module.exports = {
  getWallet,
  addAmount,
};
