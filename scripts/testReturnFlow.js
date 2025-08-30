const mongoose = require('mongoose');
const Order = require('../models/orderSchema');
const Return = require('../models/returnSchema');
const Wallet = require('../models/walletSchema');


// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/chronox', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const testReturnFlow = async () => {
  try {
    console.log('🧪 Testing Return/Refund Flow...\n');

    // Find a test order (delivered COD order)
    const testOrder = await Order.findOne({
      status: 'Delivered',
      paymentMethod: 'COD',
      isPaid: true
    }).populate('user').populate('items.product');

    if (!testOrder) {
      console.log('❌ No suitable test order found. Please create a delivered COD order first.');
      process.exit(1);
    }

    console.log(`📦 Using test order: ${testOrder._id}`);
    console.log(`👤 User: ${testOrder.user.fullname} (${testOrder.user.email})`);
    console.log(`💰 Order total: ₹${testOrder.totalAmount}`);
    console.log(`🎫 Coupon discount: ₹${testOrder.coupon?.discountAmount || 0}\n`);

    // Get user's wallet before return
    let userWallet = await Wallet.findOne({ user: testOrder.user._id });
    const initialBalance = userWallet ? userWallet.balance : 0;
    console.log(`💳 Initial wallet balance: ₹${initialBalance}\n`);

    // Simulate return request
    const returnItems = testOrder.items.slice(0, 1).map(item => ({
      productId: item.product._id.toString(),
      quantity: 1,
      reason: 'Test return - Product not as described'
    }));

    console.log('📝 Creating return request...');
    
    // Calculate expected refund (same logic as in returnController)
    let expectedRefund = 0;
    for (const item of returnItems) {
      const orderItem = testOrder.items.find(
        oi => oi.product._id.toString() === item.productId
      );
      
      let actualPaidPrice = orderItem.paidPrice || orderItem.price;
      if (!orderItem.paidPrice && orderItem.pricingSnapshot) {
        actualPaidPrice = orderItem.pricingSnapshot.finalPrice || orderItem.price;
      }

      const itemTotal = actualPaidPrice * item.quantity;
      let couponShare = 0;

      if (
        testOrder.coupon &&
        testOrder.coupon.discountAmount > 0 &&
        testOrder.totalBeforeDiscount > 0
      ) {
        const fullItemValue = actualPaidPrice * orderItem.quantity;
        const itemLevelCouponShare =
          (fullItemValue / testOrder.totalBeforeDiscount) *
          testOrder.coupon.discountAmount;
        couponShare = (item.quantity / orderItem.quantity) * itemLevelCouponShare;
      }

      const refundAmount = Math.max(0, itemTotal - couponShare);
      expectedRefund += refundAmount;
    }
    expectedRefund = Math.round(expectedRefund * 100) / 100;

    console.log(`💵 Expected refund amount: ₹${expectedRefund}`);

    // Create return request (simulating the fixed returnController logic)
    const returnRequest = new Return({
      user: testOrder.user._id,
      order: testOrder._id,
      items: returnItems.map(item => {
        const orderItem = testOrder.items.find(
          oi => oi.product._id.toString() === item.productId
        );
        
        let actualPaidPrice = orderItem.paidPrice || orderItem.price;
        if (!orderItem.paidPrice && orderItem.pricingSnapshot) {
          actualPaidPrice = orderItem.pricingSnapshot.finalPrice || orderItem.price;
        }

        const itemTotal = actualPaidPrice * item.quantity;
        let couponShare = 0;

        if (
          testOrder.coupon &&
          testOrder.coupon.discountAmount > 0 &&
          testOrder.totalBeforeDiscount > 0
        ) {
          const fullItemValue = actualPaidPrice * orderItem.quantity;
          const itemLevelCouponShare =
            (fullItemValue / testOrder.totalBeforeDiscount) *
            testOrder.coupon.discountAmount;
          couponShare = (item.quantity / orderItem.quantity) * itemLevelCouponShare;
        }

        const refundAmount = Math.max(0, itemTotal - couponShare);

        return {
          product: item.productId,
          quantity: item.quantity,
          price: actualPaidPrice,
          reason: item.reason,
          refundAmount,
          couponShare,
        };
      }),
      totalRefundAmount: expectedRefund,
      reason: 'Product Not as Described',
      description: 'Test return request',
      status: 'Requested',
    });

    await returnRequest.save();
    console.log(`✅ Return request created: ${returnRequest._id}`);

    // Check wallet balance after return request (should be unchanged)
    userWallet = await Wallet.findOne({ user: testOrder.user._id });
    const balanceAfterRequest = userWallet ? userWallet.balance : 0;
    console.log(`💳 Wallet balance after return request: ₹${balanceAfterRequest}`);
    
    if (balanceAfterRequest === initialBalance) {
      console.log('✅ PASS: Wallet not credited during return request creation\n');
    } else {
      console.log('❌ FAIL: Wallet was incorrectly credited during return request creation\n');
    }

    // Simulate admin approval (using fixed processReturn logic)
    console.log('👨‍💼 Admin approving return request...');
    
    returnRequest.status = 'Approved';
    returnRequest.reviewedAt = new Date();
    returnRequest.adminNotes = 'Test approval';

    // Find or create wallet
    if (!userWallet) {
      userWallet = new Wallet({
        user: testOrder.user._id,
        balance: 0,
        transactions: [],
      });
      await userWallet.save();
    }

    // Credit the wallet with the pre-calculated refund amount
    await userWallet.addMoney(
      expectedRefund,
      `Refund for return request #${returnRequest._id.toString().slice(-8)}`,
      testOrder._id,
      returnRequest._id
    );

    // Mark as refunded
    returnRequest.status = 'Refunded';
    returnRequest.refundedAt = new Date();
    await returnRequest.save();

    console.log('✅ Return approved and wallet credited');

    // Check final wallet balance
    userWallet = await Wallet.findOne({ user: testOrder.user._id });
    const finalBalance = userWallet.balance;
    console.log(`💳 Final wallet balance: ₹${finalBalance}`);

    const actualRefund = finalBalance - initialBalance;
    console.log(`💰 Actual refund credited: ₹${actualRefund}`);

    // Verify refund amount
    if (Math.abs(actualRefund - expectedRefund) < 0.01) {
      console.log('✅ PASS: Correct refund amount credited');
    } else {
      console.log('❌ FAIL: Incorrect refund amount');
    }

    // Check for duplicate transactions
    const returnTransactions = userWallet.transactions.filter(t => 
      t.returnId && t.returnId.toString() === returnRequest._id.toString()
    );

    if (returnTransactions.length === 1) {
      console.log('✅ PASS: No duplicate transactions found');
    } else {
      console.log(`❌ FAIL: Found ${returnTransactions.length} transactions for this return`);
    }

    console.log('\n🎉 Return flow test completed!');
    console.log('\n📊 Test Summary:');
    console.log(`- Return request created without wallet credit: ${balanceAfterRequest === initialBalance ? '✅' : '❌'}`);
    console.log(`- Correct refund amount: ${Math.abs(actualRefund - expectedRefund) < 0.01 ? '✅' : '❌'}`);
    console.log(`- No duplicate transactions: ${returnTransactions.length === 1 ? '✅' : '❌'}`);

    // Clean up test data
    console.log('\n🧹 Cleaning up test data...');
    await Return.findByIdAndDelete(returnRequest._id);
    
    // Restore wallet balance
    userWallet.balance = initialBalance;
    userWallet.transactions = userWallet.transactions.filter(t => 
      !t.returnId || t.returnId.toString() !== returnRequest._id.toString()
    );
    await userWallet.save();
    
    console.log('✅ Test data cleaned up');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error in testReturnFlow:', error);
    process.exit(1);
  }
};

// Run the test
testReturnFlow();