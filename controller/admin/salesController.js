const orderSchema = require('../../models/orderSchema');
const productSchema = require('../../models/productSchema');
const categorySchema = require('../../models/categorySchema');
const returnSchema = require('../../models/returnSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const logger = require('../../utils/logger');

const getSalesReport = async (req, res, next) => {
  try {
    const limit = 15;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { 
      type, 
      fromDate, 
      toDate, 
      product, 
      category, 
      paymentMethod 
    } = req.query;

    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

   
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    };

    
    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

   
    let allOrders = await orderSchema
      .find(filter)
      .populate('user', 'fullname email')
      .populate('items.product', 'productName brand model')
      .sort({ createdAt: -1 });


    if (product && product !== 'all') {
      allOrders = allOrders.filter(order => 
        order.items.some(item => 
          item.product && item.product._id.toString() === product
        )
      );
    }

    if (category && category !== 'all') {
      allOrders = allOrders.filter(order => 
        order.items.some(item => 
          item.productSnapshot && item.productSnapshot.categoryId && 
          item.productSnapshot.categoryId.toString() === category
        )
      );
    }

    const totalOrders = allOrders.length;
    const totalPages = Math.ceil(totalOrders / limit);

  
    const orders = allOrders.slice(skip, skip + limit);

 
    const returnFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['Approved', 'Refunded'] }
    };
    const returns = await returnSchema.find(returnFilter);

  
    const summary = calculateSummary(allOrders, returns);

    // Get filter options
    const products = await productSchema.find({ isBlocked: false }, 'productName').sort({ productName: 1 });
    const categories = await categorySchema.find({ isListed: true }, 'name').sort({ name: 1 });

    res.render('admin/salesReport', {
      orders,
      summary,
      type: type || 'weekly',
      fromDate: fromDate || '',
      toDate: toDate || '',
      product: product || 'all',
      category: category || 'all',
      paymentMethod: paymentMethod || 'all',
      products,
      categories,
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      startRecord: skip + 1,
      endRecord: Math.min(skip + limit, totalOrders),
    });
  } catch (error) {
    logger.error('Sales report error:', error);
    next(error);
  }
};

const calculateSummary = (orders, returns) => {
  const summary = {
    totalOrders: orders.length,
    totalProductsSold: 0,
    grossSales: 0,
    totalDiscounts: 0,
    couponDiscounts: 0,
    refunds: 0,
    netRevenue: 0,
  };

 
  orders.forEach((order) => {
    order.items.forEach((item) => {
      if (item.status !== 'Cancelled') {
        const quantity = item.quantity || 0;
        const unitPrice = item.price || item.pricingSnapshot?.regularPrice || 0;
        const itemDiscount = item.discount || 0;
        const discountShare = item.discountShare || 0;
        
       
        let finalPrice = item.paidPrice || 0;
        if (!finalPrice) {
          finalPrice = item.pricingSnapshot?.finalPrice || 0;
        }
        if (!finalPrice && unitPrice > 0) {
      
          finalPrice = unitPrice - itemDiscount - discountShare;
          finalPrice = Math.max(0, finalPrice); 
        }

     
        summary.totalProductsSold += quantity;
        summary.grossSales += unitPrice * quantity;
        summary.totalDiscounts += (itemDiscount + discountShare) * quantity;
        summary.netRevenue += finalPrice * quantity;
      }
    });


    const couponDiscount = order.coupon?.discountAmount || 0;
    summary.couponDiscounts += couponDiscount;
  });


  returns.forEach((returnRecord) => {
    if (returnRecord.status === 'Approved' || returnRecord.status === 'Refunded') {
      summary.refunds += returnRecord.totalRefundAmount || 0;
    }
  });


  summary.netRevenue -= summary.refunds;

  return summary;
};

const getDateRange = (type, fromDate, toDate) => {
  let startDate, endDate;
  const now = new Date();

  switch (type) {
    case 'daily':
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'weekly':
      const currentDay = now.getDay();
      const diff = currentDay === 0 ? 6 : currentDay - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), 11, 31);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'custom':
      if (fromDate && toDate) {
        startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      }
      break;

    default:
      const defaultCurrentDay = now.getDay();
      const defaultDiff = defaultCurrentDay === 0 ? 6 : defaultCurrentDay - 1;
      startDate = new Date(now);
      startDate.setDate(now.getDate() - defaultDiff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

const exportSalesReportPDF = async (req, res, next) => {
  try {
    const { 
      type, 
      fromDate, 
      toDate, 
      product, 
      category, 
      paymentMethod 
    } = req.query;
    
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

    
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    };

    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    let orders = await orderSchema
      .find(filter)
      .populate('user', 'fullname email')
      .populate('items.product', 'productName brand model')
      .sort({ createdAt: -1 });

    
    if (product && product !== 'all') {
      orders = orders.filter(order => 
        order.items.some(item => 
          item.product && item.product._id.toString() === product
        )
      );
    }

    if (category && category !== 'all') {
      orders = orders.filter(order => 
        order.items.some(item => 
          item.productSnapshot && item.productSnapshot.categoryId && 
          item.productSnapshot.categoryId.toString() === category
        )
      );
    }

    
    const returnFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['Approved', 'Refunded'] }
    };
    const returns = await returnSchema.find(returnFilter);

    
    const summary = calculateSummary(orders, returns);

    const productDetails = [];

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.status !== 'Cancelled') {
          const itemDiscount = item.discount || 0;
          const itemDiscountShare = item.discountShare || 0;
          const unitPrice = item.price || item.pricingSnapshot?.regularPrice || 0;
          const quantity = item.quantity || 0;

          
          let finalPrice = item.paidPrice || 0;
          if (!finalPrice) {
            finalPrice = item.pricingSnapshot?.finalPrice || 0;
          }
          if (!finalPrice && unitPrice > 0) {
            finalPrice = unitPrice - itemDiscount - itemDiscountShare;
            finalPrice = Math.max(0, finalPrice);
          }

          const totalItemDiscount = itemDiscount + itemDiscountShare;

          productDetails.push({
            orderId: '#' + order._id.toString().slice(-6).toUpperCase(),
            customerName: order.user?.fullname || 'N/A',
            customerEmail: order.user?.email || 'N/A',
            productName: item.productSnapshot?.name || item.product?.productName || 'N/A',
            quantity: quantity,
            originalPrice: unitPrice,
            discountAmount: totalItemDiscount,
            salePrice: finalPrice,
            totalPrice: finalPrice * quantity,
            paymentMethod: order.paymentMethod || 'N/A',
            orderDate: order.createdAt,
          });
        }
      });
    });

    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape',
    });

    const filterInfo =
      type === 'custom' && fromDate && toDate
        ? `${fromDate}-to-${toDate}`
        : type;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ChronoX-Detailed-Sales-Report-${filterInfo}-${Date.now()}.pdf`
    );

    doc.pipe(res);

    doc.fontSize(24).fillColor('#111827').text('ChronoX', { align: 'center' });
    doc
      .fontSize(18)
      .fillColor('#3b82f6')
      .text('Detailed Sales Report', { align: 'center' });
    doc.moveDown(0.5);

    doc.fontSize(12).fillColor('#666666');
    doc.text(`Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`, {
      align: 'center',
    });
    doc.text(
      `Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`,
      { align: 'center' }
    );
    doc.text(
      `Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`,
      { align: 'center' }
    );
    doc.moveDown(1);

    doc.fontSize(16).fillColor('#111827').text('Summary', { underline: true });
    doc.moveDown(0.5);

    const summaryStartY = doc.y;
    doc.rect(30, summaryStartY, 780, 100).stroke('#e5e7eb');

    doc.fontSize(12).fillColor('#333333');
    const leftCol = 50;
    const rightCol = 420;
    let summaryY = summaryStartY + 15;

    doc.text(`Total Orders: ${summary.totalOrders}`, leftCol, summaryY);
    doc.text(
      `Total Products Sold: ${summary.totalProductsSold}`,
      rightCol,
      summaryY
    );
    summaryY += 20;

    doc.text(
      `Gross Sales: Rs.${Math.round(summary.grossSales).toLocaleString('en-IN')}`,
      leftCol,
      summaryY
    );
    doc.text(
      `Total Discounts: Rs.${Math.round(summary.totalDiscounts).toLocaleString('en-IN')}`,
      rightCol,
      summaryY
    );
    summaryY += 20;

    doc.text(
      `Coupon Discounts: Rs.${Math.round(summary.couponDiscounts).toLocaleString('en-IN')}`,
      leftCol,
      summaryY
    );
    doc.text(
      `Refunds: Rs.${Math.round(summary.refunds).toLocaleString('en-IN')}`,
      rightCol,
      summaryY
    );
    summaryY += 20;

    doc
      .fontSize(14)
      .fillColor('#111827')
      .text(
        `Net Revenue: Rs.${Math.round(summary.netRevenue).toLocaleString('en-IN')}`,
        leftCol,
        summaryY
      );

    doc.y = summaryStartY + 120;
    doc.moveDown(1);

    doc
      .fontSize(16)
      .fillColor('#111827')
      .text('Product Details', { underline: true });
    doc.moveDown(0.5);

    if (productDetails.length > 0) {
      const tableTop = doc.y;
      doc.rect(30, tableTop, 780, 25).fill('#f3f4f6').stroke('#e5e7eb');

      doc.fontSize(9).fillColor('#111827');
      const headerY = tableTop + 8;
      doc.text('Order ID', 35, headerY);
      doc.text('Customer', 95, headerY);
      doc.text('Product Name', 165, headerY);
      doc.text('Qty', 280, headerY);
      doc.text('Original Price', 310, headerY);
      doc.text('Discount', 380, headerY);
      doc.text('Sale Price', 430, headerY);
      doc.text('Total Price', 480, headerY);
      doc.text('Payment', 540, headerY);

      let currentY = tableTop + 35;

      productDetails.forEach((item, index) => {
        if (currentY > 520) {
          doc.addPage();
          currentY = 50;

          doc
            .rect(30, currentY - 25, 780, 25)
            .fill('#f3f4f6')
            .stroke('#e5e7eb');
          doc.fontSize(9).fillColor('#111827');
          const newHeaderY = currentY - 17;
          doc.text('Order ID', 35, newHeaderY);
          doc.text('Customer', 95, newHeaderY);
          doc.text('Product Name', 165, newHeaderY);
          doc.text('Qty', 280, newHeaderY);
          doc.text('Original Price', 310, newHeaderY);
          doc.text('Discount', 380, newHeaderY);
          doc.text('Sale Price', 430, newHeaderY);
          doc.text('Total Price', 480, newHeaderY);
          doc.text('Payment', 540, newHeaderY);
        }

        if (index % 2 === 0) {
          doc
            .rect(30, currentY - 5, 780, 20)
            .fill('#f9fafb')
            .stroke();
        }

        doc.fontSize(8).fillColor('#333333');
        doc.text(item.orderId, 35, currentY);
        doc.text(item.customerName.substring(0, 12), 95, currentY);
        doc.text(item.productName.substring(0, 18), 165, currentY);
        doc.text(item.quantity.toString(), 285, currentY);
        doc.text(
          `Rs.${Math.round(item.originalPrice).toLocaleString('en-IN')}`,
          310,
          currentY
        );
        doc.text(
          `Rs.${Math.round(item.discountAmount).toLocaleString('en-IN')}`,
          380,
          currentY
        );
        doc.text(`Rs.${Math.round(item.salePrice).toLocaleString('en-IN')}`, 430, currentY);
        doc.text(`Rs.${Math.round(item.totalPrice).toLocaleString('en-IN')}`, 480, currentY);
        doc.text(item.paymentMethod, 540, currentY);

        currentY += 25;
      });
    } else {
      doc
        .fontSize(14)
        .fillColor('#666666')
        .text('No products found for the selected period.', {
          align: 'center',
        });
    }

    doc.fontSize(8).fillColor('#999999');
    doc.text(
      `Report generated by ChronoX Admin Panel | ${new Date().toLocaleString('en-IN')}`,
      30,
      doc.page.height - 30,
      { align: 'center' }
    );

    doc.end();
  } catch (error) {
    logger.error('export sales report PDF error', error);
    next(error);
  }
};

const exportSalesReportExcel = async (req, res, next) => {
  try {
    const { 
      type, 
      fromDate, 
      toDate, 
      product, 
      category, 
      paymentMethod 
    } = req.query;
    
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

    
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' },
    };

    if (paymentMethod && paymentMethod !== 'all') {
      filter.paymentMethod = paymentMethod;
    }

    let orders = await orderSchema
      .find(filter)
      .populate('user', 'fullname email')
      .populate('items.product', 'productName brand model')
      .sort({ createdAt: -1 });

   
    if (product && product !== 'all') {
      orders = orders.filter(order => 
        order.items.some(item => 
          item.product && item.product._id.toString() === product
        )
      );
    }

    if (category && category !== 'all') {
      orders = orders.filter(order => 
        order.items.some(item => 
          item.productSnapshot && item.productSnapshot.categoryId && 
          item.productSnapshot.categoryId.toString() === category
        )
      );
    }

    
    const returnFilter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ['Approved', 'Refunded'] }
    };
    const returns = await returnSchema.find(returnFilter);

  
    const summary = calculateSummary(orders, returns);

    const productDetails = [];

    orders.forEach((order) => {
      order.items.forEach((item) => {
        if (item.status !== 'Cancelled') {
          const itemDiscount = item.discount || 0;
          const itemDiscountShare = item.discountShare || 0;
          const unitPrice = item.price || item.pricingSnapshot?.regularPrice || 0;
          const quantity = item.quantity || 0;

        
          let finalPrice = item.paidPrice || 0;
          if (!finalPrice) {
            finalPrice = item.pricingSnapshot?.finalPrice || 0;
          }
          if (!finalPrice && unitPrice > 0) {
            finalPrice = unitPrice - itemDiscount - itemDiscountShare;
            finalPrice = Math.max(0, finalPrice);
          }

          const totalItemDiscount = itemDiscount + itemDiscountShare;

          productDetails.push({
            orderId: '#' + order._id.toString().slice(-6).toUpperCase(),
            customerName: order.user?.fullname || 'N/A',
            customerEmail: order.user?.email || 'N/A',
            productName: item.productSnapshot?.name || item.product?.productName || 'N/A',
            quantity: quantity,
            originalPrice: unitPrice,
            discountAmount: totalItemDiscount,
            salePrice: finalPrice,
            totalPrice: finalPrice * quantity,
            paymentMethod: order.paymentMethod || 'N/A',
            orderDate: order.createdAt.toLocaleDateString('en-IN'),
          });
        }
      });
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detailed Sales Report');

    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Customer Email', key: 'customerEmail', width: 25 },
      { header: 'Product Name', key: 'productName', width: 30 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Original Price', key: 'originalPrice', width: 15 },
      { header: 'Discount Amount', key: 'discountAmount', width: 15 },
      { header: 'Sale Price', key: 'salePrice', width: 15 },
      { header: 'Total Price', key: 'totalPrice', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Order Date', key: 'orderDate', width: 15 },
    ];

    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'ChronoX Detailed Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value =
      `Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)} | Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.getCell('A4').font = { bold: true, size: 14 };

    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Products Sold', summary.totalProductsSold]);
    worksheet.addRow([
      'Gross Sales',
      `₹${summary.grossSales.toLocaleString('en-IN')}`,
    ]);
    worksheet.addRow([
      'Total Discounts',
      `₹${summary.totalDiscounts.toLocaleString('en-IN')}`,
    ]);
    worksheet.addRow([
      'Coupon Discounts',
      `₹${summary.couponDiscounts.toLocaleString('en-IN')}`,
    ]);
    worksheet.addRow([
      'Refunds',
      `₹${summary.refunds.toLocaleString('en-IN')}`,
    ]);
    worksheet.addRow([
      'Net Revenue',
      `₹${summary.netRevenue.toLocaleString('en-IN')}`,
    ]);

    worksheet.addRow([]);
    worksheet.addRow([]);

    worksheet.addRow(['PRODUCT DETAILS']);
    worksheet.getCell('A12').font = { bold: true, size: 14 };

    const headerRow = worksheet.addRow([
      'Order ID',
      'Customer Name',
      'Customer Email',
      'Product Name',
      'Quantity',
      'Original Price',
      'Discount Amount',
      'Sale Price',
      'Total Price',
      'Payment Method',
      'Order Date',
    ]);

    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' },
    };

    productDetails.forEach((item) => {
      worksheet.addRow([
        item.orderId,
        item.customerName,
        item.customerEmail,
        item.productName,
        item.quantity,
        `₹${item.originalPrice.toLocaleString('en-IN')}`,
        `₹${item.discountAmount.toLocaleString('en-IN')}`,
        `₹${item.salePrice.toLocaleString('en-IN')}`,
        `₹${item.totalPrice.toLocaleString('en-IN')}`,
        item.paymentMethod,
        item.orderDate,
      ]);
    });

    worksheet.columns.forEach((column) => {
      if (column.header) {
        column.width = Math.max(column.width || 10, column.header.length + 2);
      }
    });

    const filterInfo =
      type === 'custom' && fromDate && toDate
        ? `${fromDate}-to-${toDate}`
        : type;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=ChronoX-Detailed-Sales-Report-${filterInfo}-${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    logger.error('export sales report Excel error', error);
    next(error);
  }
};

module.exports = {
  getSalesReport,
  exportSalesReportPDF,
  exportSalesReportExcel,
};
