
const Order = require('../models/orderSchema');
const categoryOffer = require('../models/categoryOfferSchema');
const couponSchema = require('../models/couponSchema');
const logger = require('./logger');

/**
 * Migration script to add snapshot data to existing orders
 * This should be run once after deploying the new order schema
 */
const migrateOrderSnapshots = async () => {
  try {
    console.log('Starting order snapshot migration...');
    
    // Find all orders that don't have snapshot data
    const ordersToMigrate = await Order.find({
      'items.productSnapshot': { $exists: false }
    }).populate('items.product');

    console.log(`Found ${ordersToMigrate.length} orders to migrate`);

    let migratedCount = 0;
    let errorCount = 0;

    for (const order of ordersToMigrate) {
      try {
        console.log(`Migrating order ${order._id}...`);
        
        // Get category offers that were active at the time of order creation
        const orderDate = order.createdAt;
        const categoryOffers = await categoryOffer.find({
          isDeleted: false,
          startDate: { $lte: orderDate },
          endDate: { $gte: orderDate }
        }).lean();

        // Update each item with snapshot data
        for (let item of order.items) {
          if (!item.productSnapshot && item.product) {
            const product = item.product;
            const variant = product.variants?.[item.variantIndex] || product.variants?.[0];
            
            if (variant) {
              // Create product snapshot
              item.productSnapshot = {
                name: product.name,
                description: product.description,
                brand: product.brand,
                model: product.model,
                images: product.images,
                categoryId: product.categoryId,
                categoryName: 'Historical Category',
                variant: {
                  regularPrice: variant.regularPrice,
                  salePrice: variant.salePrice,
                  originalQuantity: variant.quantity
                }
              };

              // Create pricing snapshot
              const regularPrice = variant.regularPrice;
              const salePrice = variant.salePrice || regularPrice;
              const productOffer = regularPrice - salePrice;

              // Find category offer that was active
              const catOffer = categoryOffers.find(
                cat => cat.category._id.toString() === product.categoryId.toString()
              );
              
              let catDiscountAmount = 0;
              let categoryOfferData = null;
              
              if (catOffer?.discount) {
                catDiscountAmount = (regularPrice * catOffer.discount) / 100;
                categoryOfferData = {
                  name: catOffer.offerName,
                  discount: catOffer.discount,
                  discountAmount: catDiscountAmount
                };
              }

              const bestOffer = Math.max(productOffer, catDiscountAmount);
              const finalPrice = regularPrice - bestOffer;

              item.pricingSnapshot = {
                regularPrice: regularPrice,
                salePrice: salePrice,
                productOffer: productOffer,
                categoryOffer: categoryOfferData,
                bestOffer: bestOffer,
                finalPrice: finalPrice
              };
            }
          }
        }

        // Create coupon snapshot if coupon was used
        if (order.coupon && order.coupon.code && !order.couponSnapshot) {
          try {
            const coupon = await couponSchema.findOne({ 
              couponcode: order.coupon.code 
            });
            
            if (coupon) {
              order.couponSnapshot = {
                name: coupon.name,
                couponcode: coupon.couponcode,
                discount: coupon.discount,
                minPurchase: coupon.minPurchase,
                discountAmount: order.coupon.discountAmount,
                appliedAt: order.createdAt
              };
            }
          } catch (couponError) {
            console.log(`Could not find coupon data for order ${order._id}: ${couponError.message}`);
          }
        }

        // Save the updated order
        await order.save();
        migratedCount++;
        console.log(`Successfully migrated order ${order._id}`);
        
      } catch (itemError) {
        console.error(`Error migrating order ${order._id}:`, itemError);
        errorCount++;
      }
    }

    console.log(`Migration completed. Migrated: ${migratedCount}, Errors: ${errorCount}`);
    return { migratedCount, errorCount };
    
  } catch (error) {
    console.error('Migration failed:', error);
    logger.error('Order snapshot migration failed:', error);
    throw error;
  }
};

/**
 * Utility function to check migration status
 */
const checkMigrationStatus = async () => {
  try {
    const totalOrders = await Order.countDocuments();
    const ordersWithSnapshots = await Order.countDocuments({
      'items.productSnapshot': { $exists: true }
    });
    const ordersWithoutSnapshots = totalOrders - ordersWithSnapshots;

    console.log(`Migration Status:
      Total Orders: ${totalOrders}
      Orders with Snapshots: ${ordersWithSnapshots}
      Orders without Snapshots: ${ordersWithoutSnapshots}
      Migration Progress: ${((ordersWithSnapshots / totalOrders) * 100).toFixed(2)}%`);

    return {
      totalOrders,
      ordersWithSnapshots,
      ordersWithoutSnapshots,
      migrationProgress: (ordersWithSnapshots / totalOrders) * 100
    };
  } catch (error) {
    console.error('Error checking migration status:', error);
    throw error;
  }
};

module.exports = {
  migrateOrderSnapshots,
  checkMigrationStatus
};