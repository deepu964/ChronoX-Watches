const Order = require('../../models/orderSchema');
const logger = require('../../utils/logger');
const Product = require('../../models/productSchema');
const categoryOffer = require('../../models/categoryOfferSchema');

const generateInvoice = async (req, res, next) => {
  try {
    const orderId = req.params.orderId;
    const userId = req.session.user._id;

    const order = await Order.findById(orderId)
      .populate('user')
      .populate({
        path: 'items.product',
        populate: {
          path: 'categoryId',
          model: 'Category',
        },
      });

    if (!order) {
      return res.status(404).send('Order not found');
    }

    // Verify order belongs to the user
    if (order.user._id.toString() !== userId.toString()) {
      return res.status(403).send('Unauthorized access to order');
    }

    // Get category offers for discount calculations
    const categoryOffers = await categoryOffer.find({ isDeleted: false }).lean();

    // Calculate proper pricing and discounts for each item
    let subtotal = 0;
    let totalDiscount = 0;
    let totalMRP = 0;

    const processedItems = order.items.map((item) => {
      const product = item.product;
      const quantity = item.quantity;
      
      // Get the correct variant based on variantIndex
      const variantIndex = item.variantIndex || 0;
      const variant = product.variants && product.variants[variantIndex] 
        ? product.variants[variantIndex] 
        : product.variants[0];

      if (!variant) {
        logger.error(`No variant found for product ${product.name}`);
        return {
          ...item.toObject(),
          variant: { regularPrice: 0, salePrice: 0 },
          itemTotal: 0,
          itemDiscount: 0,
          itemMRP: 0,
        };
      }

      const regularPrice = variant.regularPrice || 0;
      const salePrice = variant.salePrice || regularPrice;
      
      // Calculate product offer discount
      const productOffer = regularPrice - salePrice;

      // Calculate category offer discount
      let categoryDiscount = 0;
      if (product.categoryId) {
        const catOffer = categoryOffers.find(
          (cat) => cat.category && cat.category._id.toString() === product.categoryId._id.toString()
        );
        if (catOffer && catOffer.discount) {
          categoryDiscount = (regularPrice * catOffer.discount) / 100;
        }
      }

      // Take the best offer
      const bestDiscount = Math.max(productOffer, categoryDiscount);
      const finalPrice = regularPrice - bestDiscount;
      
      // Calculate totals
      const itemMRP = regularPrice * quantity;
      const itemTotal = finalPrice * quantity;
      const itemDiscount = bestDiscount * quantity;

      // Add to overall totals
      totalMRP += itemMRP;
      subtotal += itemTotal;
      totalDiscount += itemDiscount;

      return {
        ...item.toObject(),
        variant: {
          regularPrice,
          salePrice,
          finalPrice,
        },
        itemTotal,
        itemDiscount,
        itemMRP,
        bestDiscount,
      };
    });

    // Calculate coupon discount
    const couponDiscount = order.coupon ? order.coupon.discountAmount || 0 : 0;
    
    // Calculate final totals
    const finalTotal = subtotal - couponDiscount;

    // Prepare invoice data
    const invoiceData = {
      ...order.toObject(),
      items: processedItems,
      calculations: {
        subtotal,
        totalMRP,
        totalDiscount,
        couponDiscount,
        finalTotal: Math.max(0, finalTotal), // Ensure non-negative
        shippingFee: order.shippingFee || 0,
      },
    };

    return res.render('user/invoice', { 
      order: invoiceData,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME 
    });
  } catch (error) {
    logger.error('Invoice generation error:', error);
    next(error);
  }
};

module.exports = {
  generateInvoice,
};
