const orderSchema = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');

const getSalesReport = async (req, res, next) => {
  try {
    const limit = 10;
    const page = parseInt(req.query.page) || 1;
    const skip = (page - 1) * limit;

    const { type, fromDate, toDate } = req.query;

    
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);
    console.log(" FILTER RANGE:", startDate, endDate);

    
    const filter = {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    };

    
    const totalOrders = await orderSchema.countDocuments(filter);
    const totalPages = Math.ceil(totalOrders / limit);

    const orders = await orderSchema.find(filter)
      .populate('user', 'fullname email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    
    const allOrders = await orderSchema.find(filter);
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
    console.log(" Sales report error:", error);
    next(error);
  }
};

const getDateRange = (type, fromDate, toDate) => {
  let startDate, endDate;
  const now = new Date();

  switch (type) {
    case 'daily':
      startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'weekly':
      const currentDay = now.getDay(); 
      const diff = currentDay === 0 ? 6 : currentDay - 1; 
      startDate = new Date(now);
      startDate.setDate(now.getDate() - diff);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
      break;

    case 'monthly':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      break;

    case 'yearly':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
      break;

    case 'custom':
      if (fromDate && toDate) {
        startDate = new Date(fromDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(toDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        
        startDate = new Date();
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date();
        endDate.setHours(23, 59, 59, 999);
      }
      break;

    default:
      
      startDate = new Date();
      startDate.setDate(now.getDate() - 7);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date();
      endDate.setHours(23, 59, 59, 999);
  }

  return { startDate, endDate };
};

const exportSalesReportPDF = async (req, res, next) => {
  try {
    const { type, fromDate, toDate } = req.query;
    const { startDate, endDate } = getDateRange(type, fromDate, toDate);

    
    const orders = await orderSchema.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

    
    const summary = {
      totalOrders: orders.length,
      totalSales: 0,
      totalDiscount: 0,
      totalCouponDiscount: 0,
      totalAmount: 0
    };

    orders.forEach(order => {
      const originalAmount = order.totalAmount + (order.discount || 0);
      summary.totalSales += originalAmount;
      summary.totalDiscount += order.discount || 0;
      summary.totalCouponDiscount += order.couponDiscount || 0;
      summary.totalAmount += order.totalAmount;
    });

    
    const doc = new PDFDocument({
      margin: 50,
      size: 'A4',
      layout: 'landscape'
    });

    
    const filterInfo = type === 'custom' && fromDate && toDate ?
      `${fromDate}-to-${toDate}` :
      type;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=ChronoX-Sales-Report-${filterInfo}-${Date.now()}.pdf`);

    
    doc.pipe(res);

    
    doc.fontSize(24).fillColor('#111827').text('ChronoX', { align: 'center' });
    doc.fontSize(18).fillColor('#3b82f6').text('Sales Report', { align: 'center' });
    doc.moveDown(0.5);

   
    doc.fontSize(12).fillColor('#666666');
    doc.text(`Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)}`, { align: 'center' });
    doc.text(`Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`, { align: 'center' });
    doc.text(`Generated on: ${new Date().toLocaleDateString('en-IN')} at ${new Date().toLocaleTimeString('en-IN')}`, { align: 'center' });
    doc.moveDown(1.5);

    
    doc.fontSize(16).fillColor('#111827').text('Summary', { underline: true });
    doc.moveDown(0.5);

    
    const summaryStartY = doc.y;
    doc.rect(50, summaryStartY, 750, 120).stroke('#e5e7eb');

  
    doc.fontSize(12).fillColor('#333333');
    const leftCol = 70;
    const rightCol = 420;
    let summaryY = summaryStartY + 20;

    doc.text(`Total Orders: ${summary.totalOrders}`, leftCol, summaryY);
    doc.text(`Total Sales Amount: ₹${summary.totalSales.toLocaleString('en-IN')}`, rightCol, summaryY);
    summaryY += 25;

    doc.text(`Total Discount: ₹${summary.totalDiscount.toLocaleString('en-IN')}`, leftCol, summaryY);
    doc.text(`Total Coupon Discount: ₹${summary.totalCouponDiscount.toLocaleString('en-IN')}`, rightCol, summaryY);
    summaryY += 25;

    doc.fontSize(14).fillColor('#111827').text(`Net Total Amount: ₹${summary.totalAmount.toLocaleString('en-IN')}`, leftCol, summaryY);

    doc.y = summaryStartY + 140;
    doc.moveDown(1);

   
    doc.fontSize(16).fillColor('#111827').text('Order Details', { underline: true });
    doc.moveDown(0.5);

    if (orders.length > 0) {
      
      const tableTop = doc.y;
      doc.rect(50, tableTop, 750, 25).fill('#f3f4f6').stroke('#e5e7eb');

      doc.fontSize(10).fillColor('#111827');
      const headerY = tableTop + 8;
      doc.text('Order ID', 60, headerY);
      doc.text('Customer', 140, headerY);
      doc.text('Email', 240, headerY);
      doc.text('Price', 360, headerY);
      doc.text('Category Offer', 420, headerY);
      doc.text('Payment', 510, headerY);
      doc.text('Discount', 580, headerY);
      doc.text('Coupon', 650, headerY);
      doc.text('Paid Amount', 720, headerY);

      let currentY = tableTop + 35;
      
      orders.forEach((order, index) => {
        if (currentY > 500) { 
          doc.addPage();
          currentY = 50;
        }

        
        if (index % 2 === 0) {
          doc.rect(50, currentY - 5, 750, 20).fill('#f9fafb').stroke();
        }

        const orderId = '#' + order._id.toString().slice(-6).toUpperCase();
        const customerName = order.user?.name || 'N/A';
        const email = order.user?.email || 'N/A';
        const originalPrice = order.totalAmount + (order.discount || 0);
        const categoryOffer = order.categoryDiscount || 0;
        const payment = order.paymentMethod;
        const discount = order.discount || 0;
        const coupon = order.couponDiscount || 0;
        const paid = order.totalAmount;

        doc.fontSize(9).fillColor('#333333');
        doc.text(orderId, 60, currentY);
        doc.text(customerName.substring(0, 15), 140, currentY);
        doc.text(email.substring(0, 20), 240, currentY);
        doc.text(`₹${originalPrice.toLocaleString('en-IN')}`, 360, currentY);
        doc.text(`₹${categoryOffer.toLocaleString('en-IN')}`, 420, currentY);
        doc.text(payment, 510, currentY);
        doc.text(`₹${discount.toLocaleString('en-IN')}`, 580, currentY);
        doc.text(`₹${coupon.toLocaleString('en-IN')}`, 650, currentY);
        doc.text(`₹${paid.toLocaleString('en-IN')}`, 720, currentY);

        currentY += 25;
      });
    } else {
      doc.fontSize(14).fillColor('#666666').text('No orders found for the selected period.', { align: 'center' });
    }

    
    doc.fontSize(8).fillColor('#999999');
    doc.text(`Report generated by ChronoX Admin Panel | ${new Date().toLocaleString('en-IN')}`, 50, doc.page.height - 50, { align: 'center' });

    
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

    
    const orders = await orderSchema.find({
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $ne: 'Cancelled' }
    })
    .populate('user', 'name email')
    .sort({ createdAt: -1 });

    
    const summary = {
      totalOrders: orders.length,
      totalSales: 0,
      totalDiscount: 0,
      totalCouponDiscount: 0,
      totalAmount: 0
    };

    orders.forEach(order => {
      const originalAmount = order.totalAmount + (order.discount || 0);
      summary.totalSales += originalAmount;
      summary.totalDiscount += order.discount || 0;
      summary.totalCouponDiscount += order.couponDiscount || 0;
      summary.totalAmount += order.totalAmount;
    });

    
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Sales Report');

    
    worksheet.columns = [
      { header: 'Order ID', key: 'orderId', width: 15 },
      { header: 'Customer Name', key: 'customerName', width: 20 },
      { header: 'Email', key: 'email', width: 25 },
      { header: 'Price', key: 'price', width: 12 },
      { header: 'Category Offer', key: 'categoryOffer', width: 15 },
      { header: 'Payment Method', key: 'paymentMethod', width: 15 },
      { header: 'Discount', key: 'discount', width: 12 },
      { header: 'Coupon', key: 'coupon', width: 12 },
      { header: 'Paid Amount', key: 'paidAmount', width: 15 }
    ];

    
    worksheet.mergeCells('A1:I1');
    worksheet.getCell('A1').value = 'ChronoX Sales Report';
    worksheet.getCell('A1').font = { size: 16, bold: true };
    worksheet.getCell('A1').alignment = { horizontal: 'center' };

    worksheet.mergeCells('A2:I2');
    worksheet.getCell('A2').value = `Report Type: ${type.charAt(0).toUpperCase() + type.slice(1)} | Period: ${startDate.toLocaleDateString('en-IN')} - ${endDate.toLocaleDateString('en-IN')}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center' };

    
    worksheet.addRow([]);
    worksheet.addRow(['SUMMARY']);
    worksheet.getCell('A4').font = { bold: true };

    worksheet.addRow(['Total Orders', summary.totalOrders]);
    worksheet.addRow(['Total Sales Amount', `₹${summary.totalSales.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Total Discount', `₹${summary.totalDiscount.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Total Coupon Discount', `₹${summary.totalCouponDiscount.toLocaleString('en-IN')}`]);
    worksheet.addRow(['Net Total Amount', `₹${summary.totalAmount.toLocaleString('en-IN')}`]);

    
    worksheet.addRow([]);
    worksheet.addRow([]);

    
    const headerRow = worksheet.addRow([
      'Order ID', 'Customer Name', 'Email', 'Price', 'Category Offer',
      'Payment Method', 'Discount', 'Coupon', 'Paid Amount'
    ]);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE5E7EB' }
    };

    
    orders.forEach(order => {
      const originalPrice = order.totalAmount + (order.discount || 0);
      worksheet.addRow([
        '#' + order._id.toString().slice(-6).toUpperCase(),
        order.user?.name || 'N/A',
        order.user?.email || 'N/A',
        `₹${originalPrice.toLocaleString('en-IN')}`,
        `₹${(order.categoryDiscount || 0).toLocaleString('en-IN')}`,
        order.paymentMethod,
        `₹${(order.discount || 0).toLocaleString('en-IN')}`,
        `₹${(order.couponDiscount || 0).toLocaleString('en-IN')}`,
        `₹${order.totalAmount.toLocaleString('en-IN')}`
      ]);
    });

    
    const filterInfo = type === 'custom' && fromDate && toDate ?
      `${fromDate}-to-${toDate}` :
      type;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=ChronoX-Sales-Report-${filterInfo}-${Date.now()}.xlsx`);

    
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
