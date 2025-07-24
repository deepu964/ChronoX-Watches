const orderSchema = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReport = async (req, res, next) => {
  try {
    const limit = 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { type, fromDate, toDate } = req.query;

    // Get date range for filtering
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);
    console.log("FILTER RANGE:", startDate, endDate);

    // Build filter object - ensure we're filtering correctly
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    };

    // Get total count for pagination
    const totalOrders = await orderSchema.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    // Get paginated orders - sorted by latest first (descending order by createdAt)
    const orders = await orderSchema.find(filter)
      .populate('user', 'fullname email')
      .sort({ createdAt: -1 }) // Latest orders first
      .skip(skip)
      .limit(limit);

    // Get all orders for summary calculation (not paginated)
    const allOrders = await orderSchema.find(filter)
      .sort({ createdAt: -1 }); // Consistent sorting

    const summary = {
      totalOrders,
      totalSales: 0,
      totalDiscount: 0,
      totalCouponDiscount: 0,
      totalAmount: 0
    };

    allOrders.forEach(order => {
      const originalAmount = order.totalAmount + (order.discount || 0);
      summary.totalSales += originalAmount;
      summary.totalDiscount += order.discount || 0;
      summary.totalCouponDiscount += order.couponDiscount || 0;
      summary.totalAmount += order.totalAmount;
    });

    res.render('admin/salesReport', {
      orders,
      summary,
      type: type || 'weekly',
      fromDate: fromDate || '',
      toDate: toDate || '',
      currentPage: page,
      totalPages,
      totalOrders,
      limit,
      startRecord: skip + 1,
      endRecord: Math.min(skip + limit, totalOrders)
    });
  } catch (error) {
    console.log("Sales report error:", error);
    next(error);
  }
};

const getDateRange = (type, fromDate, toDate) => {
  let startDate, endDate;
  const now = new Date();

  switch (type) {
    case 'daily':
      // Today's orders only
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'weekly':
      // Current week (Monday to Sunday)
      const currentDay = now.getDay(); 
      const diff = currentDay === 0 ? 6 : currentDay - 1; // Monday = 0, Sunday = 6
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'monthly':
      // Current month
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'yearly':
      // Current year
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
        // Default to last 7 days if custom dates not provided
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 6); // Last 7 days including today
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
      }
      break;

    default:
      // Default to weekly if no type specified
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
    const { type, fromDate, toDate } = req.query;
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

    // Get all filtered orders for export with product details
    const orders = await orderSchema.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    })
    .populate('user', 'fullname email')
    .populate('items.product', 'productName')
    .sort({ createdAt: -1 });

    // Calculate summary with proper discount handling
    const summary = {
      totalOrders: orders.length,
      totalSales: 0,
      totalDiscount: 0,
      totalCouponDiscount: 0,
      totalAmount: 0,
      totalProducts: 0
    };

    // Prepare detailed product data
    const productDetails = [];

    orders.forEach(order => {
      const couponDiscount = order.coupon?.discountAmount || 0;
      
      order.items.forEach(item => {
        const itemDiscount = item.discount || 0;
        const itemDiscountShare = item.discountShare || 0;
        const originalPrice = item.price || 0;
        const paidPrice = item.paidPrice || 0;
        const quantity = item.quantity || 0;
        
        // Calculate total discount for this item (item discount + share of coupon discount)
        const totalItemDiscount = itemDiscount + itemDiscountShare;
        
        productDetails.push({
          orderId: '#' + order._id.toString().slice(-6).toUpperCase(),
          customerName: order.user?.fullname || 'N/A',
          customerEmail: order.user?.email || 'N/A',
          productName: item.product?.productName || 'N/A',
          quantity: quantity,
          originalPrice: originalPrice,
          discountAmount: totalItemDiscount,
          salePrice: paidPrice,
          totalPrice: paidPrice * quantity,
          paymentMethod: order.paymentMethod || 'N/A',
          orderDate: order.createdAt
        });
        
        // Update summary
        summary.totalProducts += quantity;
        summary.totalSales += originalPrice * quantity;
        summary.totalDiscount += totalItemDiscount * quantity;
        summary.totalAmount += paidPrice * quantity;
      });
      
      summary.totalCouponDiscount += couponDiscount;
    });

    const doc = new PDFDocument({
      margin: 30,
      size: 'A4',
      layout: 'landscape'
    });

    const filterInfo = type === 'custom' && fromDate && toDate ?
      `${fromDate}-to-${toDate}` :
      type;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ChronoX-Detailed-Sales-Report-${filterInfo}-${Date.now()}.pdf`);

    doc.pipe(res);

    // Header
    doc.fontSize(24).fillColor('#111827').text('ChronoX', { align: 'center' });
    doc.fontSize(18).fillColor('#3b82f6').text('Detailed Sales Report', { align: 'center' });
    doc.moveDown(0.5);

    // Report info
    doc.fontSize(12).fillColor('#666666');
    doc.text(`Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`, { align: 'center' });
    doc.text(`Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, { align: 'center' });
    doc.moveDown(1);

    // Summary
    doc.fontSize(16).fillColor('#111827').text('Summary', { underline: true });
    doc.moveDown(0.5);

    const summaryStartY = doc.y;
    doc.rect(30, summaryStartY, 780, 100).stroke('#e5e7eb');

    doc.fontSize(12).fillColor('#333333');
    const leftCol = 50;
    const rightCol = 420;
    let summaryY = summaryStartY + 15;

    doc.text(`Total Orders: ${summary.totalOrders}`, leftCol, summaryY);
    doc.text(`Total Products Sold: ${summary.totalProducts}`, rightCol, summaryY);
    summaryY += 20;

    doc.text(`Total Sales Amount: ₹${summary.totalSales.toLocaleString('en-IN')}`, leftCol, summaryY);
    doc.text(`Total Discount: ₹${summary.totalDiscount.toLocaleString('en-IN')}`, rightCol, summaryY);
    summaryY += 20;

    doc.text(`Total Coupon Discount: ₹${summary.totalCouponDiscount.toLocaleString('en-IN')}`, leftCol, summaryY);
    doc.fontSize(14).fillColor('#111827').text(`Net Total Amount: ₹${summary.totalAmount.toLocaleString('en-IN')}`, rightCol, summaryY);

    doc.y = summaryStartY + 120;
    doc.moveDown(1);

    // Product Details Table
    doc.fontSize(16).fillColor('#111827').text('Product Details', { underline: true });
    doc.moveDown(0.5);

    if (productDetails.length > 0) {
      // Table header
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
        // Check if we need a new page
        if (currentY > 520) { 
          doc.addPage();
          currentY = 50;
          
          // Redraw header on new page
          doc.rect(30, currentY - 25, 780, 25).fill('#f3f4f6').stroke('#e5e7eb');
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

        // Alternate row colors
        if (index % 2 === 0) {
          doc.rect(30, currentY - 5, 780, 20).fill('#f9fafb').stroke();
        }

        doc.fontSize(8).fillColor('#333333');
        doc.text(item.orderId, 35, currentY);
        doc.text(item.customerName.substring(0, 12), 95, currentY);
        doc.text(item.productName.substring(0, 18), 165, currentY);
        doc.text(item.quantity.toString(), 285, currentY);
        doc.text(`₹${item.originalPrice.toLocaleString('en-IN')}`, 310, currentY);
        doc.text(`₹${item.discountAmount.toLocaleString('en-IN')}`, 380, currentY);
        doc.text(`₹${item.salePrice.toLocaleString('en-IN')}`, 430, currentY);
        doc.text(`₹${item.totalPrice.toLocaleString('en-IN')}`, 480, currentY);
        doc.text(item.paymentMethod, 540, currentY);

        currentY += 25;
      });
    } else {
      doc.fontSize(14).fillColor('#666666').text('No products found for the selected period.', { align: 'center' });
    }

    // Footer
    doc.fontSize(8).fillColor('#999999');
    doc.text(`Report generated by ChronoX Admin Panel | ${new Date().toLocaleString('en-IN')}`, 30, doc.page.height - 30, { align: 'center' });

    doc.end();

  } catch (error) {
    console.log("export sales report PDF error", error);
    next(error);
  }
};

const exportSalesReportExcel = async (req, res, next) => {
  try {
    const { type, fromDate, toDate } = req.query;
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

    // Get all filtered orders for export with product details
    const orders = await orderSchema.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    })
    .populate('user', 'fullname email')
    .populate('items.product', 'productName')
    .sort({ createdAt: -1 });

    // Calculate summary with proper discount handling
    const summary = {
      totalOrders: orders.length,
      totalSales: 0,
      totalDiscount: 0,
      totalCouponDiscount: 0,
      totalAmount: 0,
      totalProducts: 0
    };

    // Prepare detailed product data
    const productDetails = [];

    orders.forEach(order => {
      const couponDiscount = order.coupon?.discountAmount || 0;
      
      order.items.forEach(item => {
        const itemDiscount = item.discount || 0;
        const itemDiscountShare = item.discountShare || 0;
        const originalPrice = item.price || 0;
        const paidPrice = item.paidPrice || 0;
        const quantity = item.quantity || 0;
        
        // Calculate total discount for this item (item discount + share of coupon discount)
        const totalItemDiscount = itemDiscount + itemDiscountShare;
        
        productDetails.push({
          orderId: '#' + order._id.toString().slice(-6).toUpperCase(),
          customerName: order.user?.fullname || 'N/A',
          customerEmail: order.user?.email || 'N/A',
          productName: item.product?.productName || 'N/A',
          quantity: quantity,
          originalPrice: originalPrice,
          discountAmount: totalItemDiscount,
          salePrice: paidPrice,
          totalPrice: paidPrice * quantity,
          paymentMethod: order.paymentMethod || 'N/A',
          orderDate: order.createdAt.toLocaleDateString('en-IN')
        });
        
        // Update summary
        summary.totalProducts += quantity;
        summary.totalSales += originalPrice * quantity;
        summary.totalDiscount += totalItemDiscount * quantity;
        summary.totalAmount += paidPrice * quantity;
      });
      
      summary.totalCouponDiscount += couponDiscount;
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Detailed Sales Report');

    // Set column widths and headers
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
      { header: 'Order Date', key: 'orderDate', width: 15 }
    ];

    // Title
    worksheet.mergeCells('A1:K1');
    worksheet.getCell('A1').value = 'ChronoX Detailed Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    // Report info
    worksheet.mergeCells('A2:K2');
    worksheet.getCell('A2').value = `Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)} | Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    // Summary section
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.getCell('A4').font = { bold: true, size: 14 };

    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Products Sold', summary.totalProducts]);
    worksheet.addRow(['Total Sales Amount', `₹${summary.totalSales.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Total Discount', `₹${summary.totalDiscount.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Total Coupon Discount', `₹${summary.totalCouponDiscount.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Net Total Amount', `₹${summary.totalAmount.toLocaleString('en-IN')}`]);

    // Add spacing
    worksheet.addRow([]);
    worksheet.addRow([]);

    // Product details section
    worksheet.addRow(['PRODUCT DETAILS']);
    worksheet.getCell('A12').font = { bold: true, size: 14 };

    // Headers for product details
    const headerRow = worksheet.addRow([
      'Order ID', 'Customer Name', 'Customer Email', 'Product Name', 'Quantity',
      'Original Price', 'Discount Amount', 'Sale Price', 'Total Price', 'Payment Method', 'Order Date'
    ]);
    
    // Style the header row
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    // Add product data
    productDetails.forEach(item => {
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
        item.orderDate
      ]);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.header) {
        column.width = Math.max(column.width || 10, column.header.length + 2);
      }
    });

    // Set response headers
    const filterInfo = type === 'custom' && fromDate && toDate ?
      `${fromDate}-to-${toDate}` :
      type;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ChronoX-Detailed-Sales-Report-${filterInfo}-${Date.now()}.xlsx`);

    // Write and send the file
    await workbook.xlsx.write(res);
    res.end();

  } catch (error) {
    console.log("export sales report Excel error", error);
    next(error);
  }
};

module.exports = {
  getSalesReport,
  exportSalesReportPDF,
  exportSalesReportExcel
};
