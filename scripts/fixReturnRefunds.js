const mongoose = require('mongoose');
const Return = require('../models/returnSchema');
const Wallet = require('../models/walletSchema');


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chronox', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const fixDuplicateRefunds = async () => {
  try {
    console.log('Starting return refund fix...');

    // Find all return requests that might have duplicate refunds
    const returns = await Return.find({
      status: { $in: ['Approved', 'Refunded'] },
      refundedAt: { $exists: true }
    })
    .populate('user')
    .populate('order');

    console.log(`Found ${returns.length} processed returns to check`);

    for (const returnRequest of returns) {
      try {
        if (!returnRequest.user || !returnRequest.order) {
          console.log(`Skipping return ${returnRequest._id} - missing user or order`);
          continue;
        }

        const wallet = await Wallet.findOne({ user: returnRequest.user._id });
        if (!wallet) {
          console.log(`No wallet found for user ${returnRequest.user._id}`);
          continue;
        }

        // Check for duplicate transactions for this return
        const returnTransactions = wallet.transactions.filter(t => 
          t.returnId && t.returnId.toString() === returnRequest._id.toString()
        );

        if (returnTransactions.length > 1) {
          console.log(`Found ${returnTransactions.length} duplicate transactions for return ${returnRequest._id}`);
          
          // Keep only the first transaction, remove duplicates
          const duplicateAmount = returnTransactions.slice(1).reduce((sum, t) => sum + t.amount, 0);
          
          // Remove duplicate transactions
          wallet.transactions = wallet.transactions.filter(t => {
            if (t.returnId && t.returnId.toString() === returnRequest._id.toString()) {
              return t._id.toString() === returnTransactions[0]._id.toString();
            }
            return true;
          });

          // Adjust wallet balance
          wallet.balance -= duplicateAmount;
          wallet.balance = Math.max(0, wallet.balance); // Ensure balance doesn't go negative

          await wallet.save();
          console.log(`Fixed duplicate refund for return ${returnRequest._id}, removed ₹${duplicateAmount}`);
        }

        // Ensure the return has correct refund amount calculation
        if (!returnRequest.totalRefundAmount || returnRequest.totalRefundAmount === 0) {
          let totalRefund = 0;
          
          for (const item of returnRequest.items) {
            const orderItem = returnRequest.order.items.find(
              oi => oi.product.toString() === item.product.toString()
            );
            
            if (orderItem) {
              let actualPaidPrice = orderItem.paidPrice || orderItem.price;
              if (!orderItem.paidPrice && orderItem.pricingSnapshot) {
                actualPaidPrice = orderItem.pricingSnapshot.finalPrice || orderItem.price;
              }

              const itemTotal = actualPaidPrice * item.quantity;
              let couponShare = 0;

              if (
                returnRequest.order.coupon &&
                returnRequest.order.coupon.discountAmount > 0 &&
                returnRequest.order.totalBeforeDiscount > 0
              ) {
                const fullItemValue = actualPaidPrice * orderItem.quantity;
                const itemLevelCouponShare =
                  (fullItemValue / returnRequest.order.totalBeforeDiscount) *
                  returnRequest.order.coupon.discountAmount;
                couponShare = (item.quantity / orderItem.quantity) * itemLevelCouponShare;
              }

              const refundAmount = Math.max(0, itemTotal - couponShare);
              totalRefund += refundAmount;
            }
          }

          totalRefund = Math.round(totalRefund * 100) / 100;
          
          if (totalRefund !== returnRequest.totalRefundAmount) {
            returnRequest.totalRefundAmount = totalRefund;
            await returnRequest.save();
            console.log(`Updated refund amount for return ${returnRequest._id} to ₹${totalRefund}`);
          }
        }

      } catch (error) {
        console.error(`Error processing return ${returnRequest._id}:`, error);
      }
    }

    console.log('Return refund fix completed successfully');
    process.exit(0);

  } catch (error) {
    console.error('Error in fixDuplicateRefunds:', error);
    process.exit(1);
  }
};

// Run the fix
fixDuplicateRefunds();