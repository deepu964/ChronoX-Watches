const User = require('../../models/userSchema');
const Wallet = require('../../models/walletSchema');

const getWallet = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        let page = parseInt(req.query.page) || 1;
        const limit = 5;

        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
            await wallet.save();
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
            totalPage
        });

    } catch (error) {
        console.error('Wallet page error:', error);
        next(error);
    }
};

module.exports = {
    getWallet
};
