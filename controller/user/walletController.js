const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');

// Get user's wallet details
const getWallet = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        // Get or create user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0 });
            await wallet.save();
            
            // Update user's wallet reference
            await User.findByIdAndUpdate(userId, { wallet: wallet._id });
        }
        
        // Get transaction history with pagination
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;
        
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        
        const transactions = wallet.transactions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(skip, skip + limit);
        
        res.render('user/wallet', {
            user: req.session.user,
            wallet,
            transactions,
            currentPage: page,
            totalPages,
            totalTransactions
        });
        
    } catch (error) {
        console.error("Get wallet error:", error);
        next(error);
    }
};

// Add money to wallet (for testing purposes - in real app this would be through payment gateway)
const addMoneyToWallet = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { amount } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        
        // Get or create user's wallet
        let wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            wallet = new Wallet({ user: userId, balance: 0 });
            await wallet.save();
            
            // Update user's wallet reference
            await User.findByIdAndUpdate(userId, { wallet: wallet._id });
        }
        
        // Add money to wallet
        await wallet.addMoney(parseFloat(amount), 'Money added to wallet');
        
        res.json({ 
            success: true, 
            message: 'Money added to wallet successfully',
            newBalance: wallet.balance
        });
        
    } catch (error) {
        console.error("Add money to wallet error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to add money to wallet' 
        });
    }
};

// Use wallet balance for payment
const useWalletForPayment = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const { amount, orderId, description } = req.body;
        
        if (!amount || amount <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid amount' 
            });
        }
        
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.status(404).json({ 
                success: false, 
                message: 'Wallet not found' 
            });
        }
        
        if (wallet.balance < amount) {
            return res.status(400).json({ 
                success: false, 
                message: 'Insufficient wallet balance' 
            });
        }
        
        // Deduct money from wallet
        await wallet.deductMoney(
            parseFloat(amount), 
            description || 'Payment for order',
            orderId
        );
        
        res.json({ 
            success: true, 
            message: 'Payment successful',
            newBalance: wallet.balance
        });
        
    } catch (error) {
        console.error("Use wallet for payment error:", error);
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Payment failed' 
        });
    }
};

// Get wallet balance
const getWalletBalance = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        
        const wallet = await Wallet.findOne({ user: userId });
        const balance = wallet ? wallet.balance : 0;
        
        res.json({ 
            success: true, 
            balance: balance
        });
        
    } catch (error) {
        console.error("Get wallet balance error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get wallet balance' 
        });
    }
};

// Get transaction history
const getTransactionHistory = async (req, res, next) => {
    try {
        const userId = req.session.user._id;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const wallet = await Wallet.findOne({ user: userId });
        if (!wallet) {
            return res.json({ 
                success: true, 
                transactions: [],
                totalTransactions: 0,
                currentPage: page,
                totalPages: 0
            });
        }
        
        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);
        
        const transactions = wallet.transactions
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(skip, skip + limit);
        
        res.json({ 
            success: true, 
            transactions,
            totalTransactions,
            currentPage: page,
            totalPages
        });
        
    } catch (error) {
        console.error("Get transaction history error:", error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get transaction history' 
        });
    }
};

module.exports = {
    getWallet,
    addMoneyToWallet,
    useWalletForPayment,
    getWalletBalance,
    getTransactionHistory
};
