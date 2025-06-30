const addressSchema = require('../../models/addressSchema');
const Cart = require('../../models/cartSchema');
const Order = require('../../models/orderSchema');
const productSchema = require('../../models/productSchema');
const Wallet = require('../../models/walletSchema');
const User = require('../../models/userSchema');
const Razorpay = require('razorpay');
const cartSchema = require('../../models/cartSchema');
const categoryOffer = require('../../models/categoryOfferSchema');
const couponSchema = require('../../models/couponSchema');
const Return = require('../../models/returnSchema');

const razorpayInstance = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const validateCartForCheckout = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const cart = await Cart.findOne({ user: userId }).populate({
      path: 'items.product',
      populate: {
        path: 'categoryId',
        model: 'Category'
      }
    });

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Your cart is empty'
      });
    }

    const invalidItems = [];
    const outOfStockItems = [];

    for (const item of cart.items) {
      const product = item.product;


      if (product.isActive === true || product.isDeleted === true) {
        invalidItems.push(product.name);
        continue;
      }


      if (!product.categoryId || !product.categoryId.isListed) {
        invalidItems.push(product.name);
        continue;
      }


      const variant = product.variants && product.variants.length > 0 ? product.variants[0] : null;
      if (!variant || variant.quantity < item.quantity) {
        outOfStockItems.push({
          name: product.name,
          available: variant ? variant.quantity : 0,
          requested: item.quantity
        });
      }
    }

    if (invalidItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: `The following items are no longer available: ${invalidItems.join(', ')}. Please remove them from your cart.`,
        type: 'invalid_products',
        invalidItems
      });
    }

    if (outOfStockItems.length > 0) {
      const outOfStockMessage = outOfStockItems.map(item =>
        `${item.name} (Available: ${item.available}, Requested: ${item.requested})`
      ).join(', ');

      return res.status(400).json({
        success: false,
        message: `The following items are out of stock: ${outOfStockMessage}. Please update quantities or remove them from your cart.`,
        type: 'out_of_stock',
        outOfStockItems
      });
    }


    return res.status(200).json({
      success: true,
      message: 'Cart validation successful'
    });

  } catch (error) {
    console.error('Cart validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'An error occurred while validating your cart'
    });
  }
};

const checkoutGetController = async (req, res, next) => {
  try {
    const userId = req.session.user._id;

    const addresses = await addressSchema.find({ userId });
    const defaultAddress = addresses.find(addr => addr.isDefault);

    const couponAmount = req.session.coupon || 0;
    const discountAmount = couponAmount.discountAmount || 0;

    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect('/cart');
    }

    const today = new Date();
    const coupons = await couponSchema.find({
      isActive: true,
      expiryDate: { $gte: today },
      usersUsed: { $ne: userId }
    });

    const categoryOff = await categoryOffer.find({ isDeleted: false }).lean();

    let subTotal = 0;
    let discount = 0;
    let cartItems = [];
    let netTotal = 0; // 👈 total MRP (used for coupon calculation)

    for (let item of cart.items) {
      const product = item.product;
      const variant = product.variants?.[0] || {};
      const regularPrice = variant.regularPrice || 0;
      const salePrice = variant.salePrice || regularPrice;
      const quantity = item.quantity;

      const productOffer = regularPrice - salePrice;

      const catOffer = categoryOff.find(cat => cat.category._id.toString() === product.categoryId.toString());
      let catDiscount = 0;
      if (catOffer && catOffer.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }

      const bestOffer = Math.max(productOffer, catDiscount);

      const finalPrice = regularPrice - bestOffer;
      const total = finalPrice * quantity;
      const mrpTotal = regularPrice * quantity; // 👈 Total MRP for this item

      subTotal += total;
      discount += bestOffer * quantity;
      netTotal += mrpTotal;

      cartItems.push({
        _id: product._id,
        name: product.name,
        image: product.images?.[0]?.public_id || '/images/default-product.jpg',
        quantity,
        price: finalPrice,
        total,
        mrpTotal // 👈 Store MRP for coupon split
      });
    }

    const grandTotal = subTotal;

    res.render('user/checkOut', {
      user: req.session.user,
      cart: cart.items,
      addresses,
      defaultAddress,
      cartItems,
      subTotal,
      discount,
      grandTotal,
      netTotal, // 👈 Used in order placement to set totalBeforeDiscount
      coupons,
      discountAmount,
      couponAmount,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });

  } catch (error) {
    console.log('get checkout page error:', error);
    next(error);
  }
};

const addNewAddress = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    
    const {
      fullName,
      phone,
      pinCode,
      city,
      state,
      district,
      address,
      landmark,
      isDefault,
    } = req.body;

    if (isDefault) {
      await addressSchema.updateMany(
        { userId },
        { $set: { isDefault: false } }
      );
    }

    const newAddress = new addressSchema({
      userId,
      fullName,
      phone,
      pinCode,
      city,
      state,
      district,
      address,
      landmark,
      isDefault: !!isDefault,
    });
    
    await newAddress.save();

    res.status(200).json({
      success: true,
      message: "Address added successfully",
    });

  } catch (error) {
    console.log('add new address page error')
    next(error);
  }
};

const deleteCheckAddress = async (req, res, next) => {
  try {
    const addressId = req.params.id;
    await addressSchema.findByIdAndDelete(addressId);
    res.status(200).json({ success: true, message: "Address deleted successfull" });

  } catch (error) {
    console.log(' delete address page error')
    next(error);
  }
}

const getPayment = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.query.addressId;

    if (!addressId || addressId === 'undefined') {
      return res.json({ success: false, message: "Please select a valid address" });
    }

    const cart = await Cart.findOne({ user: userId }).populate('items.product').lean();

    if (!cart || !cart.items || cart.items.length === 0) {
      return res.redirect('/cart');
    }
    const coupon = req.session.coupon ? req.session.coupon : 0;
    
    const categoryOff = await categoryOffer.find({ isDeleted: false }).lean();

    let totalMRP = 0;
    let discount = 0;
    let grandTotal = 0;

    const cartItems = cart.items.map(item => {
      const product = item.product;
      const variant = product.variants?.[0] || {};

      const regularPrice = variant.regularPrice || 0;
      const salePrice = variant.salePrice || regularPrice;
      const quantity = item.quantity;


      const productOffer = regularPrice - salePrice;


      const catOffer = categoryOff.find(cat => cat.category._id.toString() === product.categoryId.toString());
      let catDiscount = 0;
      if (catOffer && catOffer.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }


      const bestOffer = Math.max(productOffer, catDiscount);
      const discountedPrice = regularPrice - bestOffer;


      totalMRP += regularPrice * quantity;
      discount += bestOffer * quantity;

      if (coupon) {
        grandTotal += discountedPrice * quantity - coupon.discountAmount;
        
      } else {
        grandTotal += discountedPrice * quantity;
        
      }
      return {
        _id: product._id,
        name: product.name,
        image: product.images?.[0]?.public_id || null,
        quantity,
        regularPrice,
        salePrice,

      };
    });




    return res.render('user/placeOrder', {
      user: req.session.user,
      addresses: addressId,
      cartItems,
      subTotal: totalMRP,
      discount: discount,
      grandTotal,
      coupon

    });

  } catch (err) {
    console.error('Error loading place order page:', err);
    next(err);
  }
};

const placeOrder = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const { paymentMethod, addressId, razorpayOrderId, paymentId, orderId } = req.body;
    const coupon = req.session.coupon || null;

    // ✅ Razorpay Retry Logic
    if (orderId) {
      const existingOrder = await Order.findById(orderId);
      if (!existingOrder) return res.status(400).json({ success: false, message: 'Order not found' });
      if (existingOrder.user.toString() !== userId.toString()) {
        return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
      }

      existingOrder.razorpayPaymentId = paymentId || null;
      existingOrder.razorpayOrderId = razorpayOrderId || null;
      existingOrder.status = 'Placed';
      existingOrder.paymentStatus = 'Paid';
      existingOrder.isPaid = paymentMethod === 'ONLINE';
      existingOrder.coupon = {
        code: coupon?.code || '',
        discountAmount: coupon?.discountAmount || 0
      };

      existingOrder.couponMinAmount = coupon?.minPurchase || 0;
      console.log(existingOrder,'this is order')
      await existingOrder.save();

      const cart = await Cart.findOne({ user: userId });
      if (cart) {
        cart.items = [];
        await cart.save();
      }

      return res.json({
        success: true,
        orderId: existingOrder._id,
        redirectUrl: `/order-success?orderId=${existingOrder._id}`
      });
    }

    // ✅ Normal New Order Flow
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const address = await addressSchema.findOne({ _id: addressId });
    if (!address) {
      return res.status(400).json({ success: false, message: 'Invalid address' });
    }

    const categoryOff = await categoryOffer.find({ isDeleted: false }).lean();

    let totalBeforeDiscount = 0; // MRP total
    let finalTotal = 0; // After product/category offers
    const orderItems = [];

    for (const item of cart.items) {
      const product = item.product;

      if (!product.isActive || product.isDeleted) {
        return res.status(400).json({ success: false, message: `${product.name} is not available` });
      }

      const variant = product.variants?.[0];
      if (!variant) {
        return res.status(400).json({ success: false, message: `${product.name} has no pricing information` });
      }

      const quantity = item.quantity;
      const regularPrice = variant.regularPrice;
      const salePrice = variant.salePrice || regularPrice;
      const productOffer = regularPrice - salePrice;

      const catOffer = categoryOff.find(cat => cat.category._id.toString() === product.categoryId.toString());
      let catDiscount = 0;
      if (catOffer?.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }

      const bestOffer = Math.max(productOffer, catDiscount);
      const finalPrice = regularPrice - bestOffer;
      const itemMrpTotal = regularPrice * quantity;
      const itemPaidPrice = finalPrice * quantity;

      if (variant.quantity < quantity) {
        return res.status(400).json({ success: false, message: `${product.name} is out of stock` });
      }

      orderItems.push({
        product: product._id,
        quantity,
        variantIndex: 0,
        price: regularPrice,
        paidPrice: finalPrice,
        discount: bestOffer,
        discountShare: 0
      });

      totalBeforeDiscount += itemMrpTotal;
      finalTotal += itemPaidPrice;

      variant.quantity -= quantity;
      await product.save();
    }

    const couponAmount = coupon?.discountAmount || 0;
    const couponMin = coupon?.minPurchase || 0;
    const totalAmount = couponAmount > 0 ? finalTotal - couponAmount : finalTotal;

    // ✅ Distribute coupon discount across items
    if (couponAmount > 0 && totalBeforeDiscount > 0) {
      for (let item of orderItems) {
        const itemMrp = item.price * item.quantity;
        item.discountShare = Math.round((itemMrp / totalBeforeDiscount) * couponAmount);
      }
    }

    const order = new Order({
      user: userId,
      items: orderItems,
      address: {
        fullName: address.fullName,
        phone: address.phone,
        addressLine: address.address,
        city: address.city,
        pincode: address.pinCode,
        state: address.state
      },
      totalAmount,
      totalBeforeDiscount,
      couponMinAmount: couponMin,
      coupon: {
        code: coupon?.code || '',
        discountAmount: couponAmount
      },
      paymentMethod,
      razorpayPaymentId: paymentId || null,
      razorpayOrderId: razorpayOrderId || null,
      status: 'Placed',
      isPaid: paymentMethod === 'ONLINE',
      paymentStatus: paymentMethod === 'ONLINE' ? 'Paid' : 'Pending'
    });

    
    await order.save();
    
    req.session.coupon = null;

    cart.items = [];
    await cart.save();

    res.json({
      success: true,
      orderId: order._id,
      redirectUrl: `/order-success?orderId=${order._id}`
    });

  } catch (err) {
    console.error('place order error', err);
    next(err);
  }
};


const getRetry = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const addressId = req.query.addressId

    const orderId = req.params.orderId;

    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('address');

    if (!order) {
      return res.json({ success: false, message: "Order Not Found" })
    }


    if (order.user.toString() !== userId.toString()) {
      return res.status(403).json({ success: false, message: "Unauthorized access to order" });
    }


    const totalAmount = order.totalAmount;


    const cart = await Cart.findOne({ user: userId }).populate('items.product');

    const addresses = await addressSchema.findById(addressId)

    res.render('user/retryPayment', {
      cart: cart || { items: [] },
      order,
      addresses,
      user: req.session.user,
      toast: req.session.toast,
      totalAmount
    });

    delete req.session.toast;


  } catch (error) {
    console.log("this is retry page error", error);
    next(error);
  }
}

const getOrderSuccess = async (req, res, next) => {
  try {
    const orderId = req.query.orderId;

    if (!orderId) {
      return res.redirect('/shop');
    }

    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('user');

    if (!order || order.user._id.toString() !== req.session.user._id.toString()) {
      return res.redirect('/shop');
    }

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    res.render('user/orderSuccess', {
      user: req.session.user,
      order,
      cloudName
    });

  } catch (error) {
    console.error("Order success page error:", error);
    next(error);
  }
};

const getOrderDetails = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user._id;

    const order = await Order.findById(orderId)
      .populate('items.product')
      .populate('user');

    if (!order || order.user._id.toString() !== userId.toString()) {
      return res.status(404).render('user/404');
    }

    const returnRequest = await Return.findOne({ order: orderId, user: userId })
      .populate('items.product', 'name');

    const categoryOff = await categoryOffer.find({ isDeleted: false }).lean();

    let totalMRP = 0;
    let discount = 0;
    let grandTotal = 0;
    let bestOffer = 0;
    let regularPrice = 0;
    let salePrice = 0;
    let catDiscount = 0;


    for (let item of order.items) {
      const product = item.product;
      const quantity = item.quantity;
      const variant = product.variants[0];

      regularPrice = variant.regularPrice;
      salePrice = variant.salePrice;

      const productOffer = regularPrice - salePrice;


      const catOffer = categoryOff.find(cat => cat.category._id.toString() === product.categoryId.toString());
      if (catOffer && catOffer.discount) {
        catDiscount = (regularPrice * catOffer.discount) / 100;
      }
      bestOffer = Math.max(productOffer, catDiscount);
      const discountedPrice = regularPrice - bestOffer;


      totalMRP += regularPrice * quantity;
      discount += bestOffer * quantity;


      grandTotal += discountedPrice * quantity;
    }

    const finalTotal = grandTotal;

    res.render('user/orderDetails', {
      user: req.session.user,
      items: order.items,
      total: totalMRP - discount,
      totalMRP,
      order,
      returnRequest,
      discount,
      catDiscount,
      bestOffer,
      regularPrice,
      salePrice,
      grandTotal: finalTotal,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });

  } catch (error) {
    console.error("Order details page error:", error);
    next(error);
  }
};

const getMyOrders = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = 6;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    let orders = [];
    let totalOrders = 0;

    if (search) {
      let searchTerm = search.startsWith('#') ? search.substring(1) : search;
      searchTerm = searchTerm.toUpperCase();

      const allOrders = await Order.find({ user: userId })
        .populate('items.product')
        .sort({ createdAt: -1 });

      const filteredOrders = allOrders.filter(order => {
        const fullId = order._id.toString().toUpperCase();
        const last8 = fullId.slice(-8);
        return fullId.includes(searchTerm) || last8.includes(searchTerm);
      });

      totalOrders = filteredOrders.length;
      orders = filteredOrders.slice(skip, skip + limit);

    } else {
      totalOrders = await Order.countDocuments({ user: userId });

      orders = await Order.find({ user: userId })
        .populate('items.product')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    }

    const totalPages = Math.max(1, Math.ceil(totalOrders / limit));
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

    res.render('user/myOrders', {
      user: req.session.user,
      orders,
      cloudName,
      currentPage: page,
      totalPages,
      totalOrders,
      searchParams: { search }
    });

  } catch (error) {
    console.error("My orders page error:", error);
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  try {
    const cancelId = req.params.orderId;
    const userId = req.session.user._id;

    const order = await Order.findOne({ _id: cancelId, user: userId }).populate([
      {
        path: 'user',
        populate: { path: 'wallet' }
      },
      {
        path: 'items.product'
      }
    ]);

    if (!order) return res.status(404).json({ message: 'Order not found' });
    if (order.status !== 'Placed') return res.status(400).json({ message: 'Order cannot be cancelled' });

    // ✅ Update order status
    order.status = 'Cancelled';

    for (const item of order.items) {
      if (item.status === 'Placed') {
        item.status = 'Cancelled';
        item.cancelledAt = new Date();
        item.cancelReason = 'Full order cancelled';

        const { quantity, variantIndex } = item;

        // ✅ Stock restore
        const product = item.product;
        if (product && product.variants[variantIndex]) {
          product.variants[variantIndex].quantity += quantity;
          await product.save();
        }
      }
    }

    // ✅ Refund the total order amount directly
    const totalRefund = order.totalAmount;

    if (order.paymentMethod === 'ONLINE' && order.isPaid && totalRefund > 0) {
      let wallet = order.user.wallet;

      if (!wallet) {
        wallet = new Wallet({ user: userId, balance: 0, transactions: [] });
        await wallet.save();
        order.user.wallet = wallet;
      }

      await wallet.addMoney(
        totalRefund,
        `Refund for cancelled order: ${order._id.toString().slice(-8)}`,
        order._id
      );
    }

    await order.save();
    res.status(200).json({ message: 'Order cancelled and refund issued to wallet' });

  } catch (error) {
    console.error("Cancel order error:", error);
    next(error);
  }
};

const cancelOrderItem = async (req, res, next) => {
  try {
    const { orderId, itemId } = req.params;
    const { reason } = req.body;
    const userId = req.session.user._id;

    const order = await Order.findById(orderId).populate('items.product');
    console.log(order)
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    const item = order.items.id(itemId);
    console.log(item,'thi is item');
    if (!item) return res.status(404).json({ success: false, message: 'Item not found' });
    if (item.status === 'Cancelled') return res.status(400).json({ success: false, message: 'Already cancelled' });

    
    item.status = 'Cancelled';
    item.cancelReason = reason;
    item.cancelDate = new Date();

    
    const product = item.product;
    const variantIndex = item.variantIndex;
    if (product?.variants?.[variantIndex]) {
      product.variants[variantIndex].quantity += item.quantity;
      await product.save();
    }
    const paidPrice = Number(item.price) || 0;
    const quantity = Number(item.quantity) || 1;
    const itemTotal = paidPrice * quantity;


    let refundAmount = 0;
  
    if(order.coupon && order.totalAmount > order.couponMinAmount){
        const refundingAmount = (itemTotal/order.totalAmount)*order.coupon.discountAmount;
        refundAmount = itemTotal-refundingAmount;

    }
    
    if (isNaN(refundAmount) || refundAmount <= 0) {
      return res.status(500).json({ success: false, message: 'Refund calculation error' });
    }

    
    const user = await User.findById(userId).populate('wallet');
    user.wallet.balance += refundAmount;
    user.wallet.transactions.push({
      type: 'credit',
      amount: refundAmount,
      description: `Refund for cancelled item - ${product?.name || 'product'}`,
      orderId: order._id
    });
    await user.wallet.save();
    await user.save();

    
    await order.save();

    
    const allCancelled = order.items.every(i => i.status === 'Cancelled');
    if (allCancelled) {
      order.status = 'Cancelled';
      await order.save();
    }

    return res.status(200).json({ success: true, message: `Item cancelled and refund issued ${refundAmount}` });

  } catch (err) {
    console.error(err);
    next(err);
  }
};




const debugOrderIds = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const orders = await Order.find({ user: userId }).sort({ createdAt: -1 });

    const orderData = orders.map(order => ({
      fullId: order._id.toString(),
      displayId: '#' + order._id.toString().slice(-8).toUpperCase(),
      createdAt: order.createdAt,
      totalAmount: order.totalAmount
    }));

    res.json({
      success: true,
      totalOrders: orders.length,
      orders: orderData
    });
  } catch (error) {
    console.error("Debug order IDs error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, address, orderId } = req.body;

    const selectedAddress = await addressSchema.findById(address);
    if (!selectedAddress) {
      return res.json({ success: false, message: "Invalid Address" });
    }


    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }


    let cartItems = [];
    let localOrder;

    if (orderId) {

      localOrder = await Order.findById(orderId);
      if (!localOrder) {
        return res.json({ success: false, message: "Order not found" });
      }

      if (localOrder.user.toString() !== req.session.user._id.toString()) {
        return res.json({ success: false, message: "Unauthorized access to order" });
      }


      cartItems = localOrder.items;
    } else {

      const cart = await cartSchema.find({ user: req.session.user }).populate('items.product').lean();
      if (!cart || cart.length === 0) {
        return res.json({ success: false, message: "No items in cart" });
      }

      for (let item of cart) {
        for (let it of item.items) {
          cartItems.push(it);
        }
      }
    }


    const options = {
      amount: amount * 100,
      currency: "INR",
      receipt: `rcpt_${Math.floor(Math.random() * 100000)}`,
      payment_capture: 1
    };

    const razorpayOrder = await razorpayInstance.orders.create(options);
    const coupon = req.session.coupon ? req.session.coupon : 0;

    if (!orderId) {
      localOrder = await Order.create({
        user: req.session.user._id,
        address: selectedAddress,
        items: cartItems,
        totalAmount: amount,
        status: "Pending",
        paymentStatus: "Pending",
        isPaid: false,
        paymentMethod: "ONLINE",
        razorpayOrderId: razorpayOrder.id,
        coupon: coupon.discountAmount
      });
    } else {

      localOrder.razorpayOrderId = razorpayOrder.id;
      await localOrder.save();
    }


    return res.status(200).json({
      success: true,
      orderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID,
      localOrderId: localOrder._id
    });

  } catch (err) {
    console.error("Razorpay Order Creation Failed:", err);
    return res.status(500).json({ success: false, message: "Failed to create payment order" });
  }
};


module.exports = {
  validateCartForCheckout,
  checkoutGetController,
  addNewAddress,
  deleteCheckAddress,
  getPayment,
  placeOrder,
  getOrderSuccess,
  getOrderDetails,
  getMyOrders,
  cancelOrder,
  cancelOrderItem,
  debugOrderIds,
  createRazorpayOrder,
  getRetry,

};
