const errorMiddleware = require('../../middlewares/errorMiddleware');
const Admin = require('../../models/adminSchema');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const Product = require('../../models/productSchema');
const Category = require('../../models/categorySchema');
const Referral = require('../../models/referralSchema');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const productSchema = require('../../models/productSchema');


const getAdminLogin =async (req,res,next) => {
    try {
        
        if(req.session.admin){
          return res.redirect('/admin/dashboard')
        }

        const error = req.query.error
        return res.render('admin/login',{error})


    } catch (error) {
        console.log('this is adminlogin page error',error);
        next(error)
    }
    
}
const getDashBoard = async (req,res,next) => {
    try {

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        if(!req.session.admin){
            return res.redirect('/admin')
        }

        const metrics = await getDashboardMetrics();
       

        res.render('admin/dashboard', { metrics,cloudName })
    } catch (error) {
        console.log('this is dash board page error',error);
        next(error)
    }
}

const getDashboardMetrics = async () => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

        
        const totalCustomers = await User.countDocuments({ isBlocked: false });
        const lastMonthCustomers = await User.countDocuments({
            isBlocked: false,
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
        });
        const thisMonthCustomers = await User.countDocuments({
            isBlocked: false,
            createdAt: { $gte: startOfMonth }
        });
        const customerGrowth = lastMonthCustomers > 0 ?
            ((thisMonthCustomers - lastMonthCustomers) / lastMonthCustomers * 100).toFixed(1) : 0;

       
        const totalOrders = await Order.countDocuments({
            status: { $nin: ['Cancelled'] },
            paymentStatus: 'Paid'
        });

       
        const salesAggregation = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid'
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totalAmount' },
                    count: { $sum: 1 }
                }
            }
        ]);

        const totalSales = salesAggregation.length > 0 ? salesAggregation[0].totalSales : 0;

        
        const thisMonthSales = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid',
                    createdAt: { $gte: startOfMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totalAmount' }
                }
            }
        ]);

        const lastMonthSales = await Order.aggregate([
            {
                $match: {
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid',
                    createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth }
                }
            },
            {
                $group: {
                    _id: null,
                    totalSales: { $sum: '$totalAmount' }
                }
            }
        ]);

        const thisMonthSalesAmount = thisMonthSales.length > 0 ? thisMonthSales[0].totalSales : 0;
        const lastMonthSalesAmount = lastMonthSales.length > 0 ? lastMonthSales[0].totalSales : 0;
        const salesGrowth = lastMonthSalesAmount > 0 ?
            ((thisMonthSalesAmount - lastMonthSalesAmount) / lastMonthSalesAmount * 100).toFixed(1) : 0;

        
        const totalProducts = await Product.countDocuments({
            isDeleted: false,
            isActive: false 
        });

       
        const referralStats = await Referral.getReferralStats();
        const thisMonthReferrals = await Referral.countDocuments({
            createdAt: { $gte: startOfMonth },
            status: 'Completed'
        });
        const lastMonthReferrals = await Referral.countDocuments({
            createdAt: { $gte: startOfLastMonth, $lte: endOfLastMonth },
            status: 'Completed'
        });
        const referralGrowth = lastMonthReferrals > 0 ?
            ((thisMonthReferrals - lastMonthReferrals) / lastMonthReferrals * 100).toFixed(1) : 0;

        return {
            totalCustomers,
            customerGrowth,
            totalOrders,
            totalSales,
            salesGrowth,
            totalProducts,
            totalReferrals: referralStats.totalReferrals,
            totalReferralRewards: referralStats.totalRewardsGiven,
            referralGrowth
        };
    } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        return {
            totalCustomers: 0,
            customerGrowth: 0,
            totalOrders: 0,
            totalSales: 0,
            salesGrowth: 0,
            totalProducts: 0
        };
    }
};

const getChartData = async (req, res, next) => {
    try {
        const { period, year, month, week } = req.query;
        let chartData = [];
        let labels = [];

        const now = new Date();

        switch (period) {
            case 'yearly':
                
                const selectedYear = year ? parseInt(year) : now.getFullYear();
                const startOfYear = new Date(selectedYear, 0, 1);
                const endOfYear = new Date(selectedYear, 11, 31, 23, 59, 59);

                const yearlyData = await Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startOfYear, $lte: endOfYear },
                            status: { $nin: ['Cancelled'] },
                            paymentStatus: 'Paid'
                        }
                    },
                    {
                        $group: {
                            _id: { $month: '$createdAt' },
                            totalSales: { $sum: '$totalAmount' },
                            orderCount: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

                for (let i = 1; i <= 12; i++) {
                    const monthData = yearlyData.find(d => d._id === i);
                    labels.push(monthNames[i - 1]);
                    chartData.push(monthData ? monthData.totalSales : 0);
                }
                break;

            case 'monthly':
                
                const selectedMonth = month ? parseInt(month) - 1 : now.getMonth();
                const selectedYearForMonth = year ? parseInt(year) : now.getFullYear();
                const startOfMonth = new Date(selectedYearForMonth, selectedMonth, 1);
                const endOfMonth = new Date(selectedYearForMonth, selectedMonth + 1, 0, 23, 59, 59);

                const monthlyData = await Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startOfMonth, $lte: endOfMonth },
                            status: { $nin: ['Cancelled'] },
                            paymentStatus: 'Paid'
                        }
                    },
                    {
                        $group: {
                            _id: { $dayOfMonth: '$createdAt' },
                            totalSales: { $sum: '$totalAmount' },
                            orderCount: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                const daysInMonth = new Date(selectedYearForMonth, selectedMonth + 1, 0).getDate();
                for (let i = 1; i <= daysInMonth; i++) {
                    const dayData = monthlyData.find(d => d._id === i);
                    labels.push(i.toString());
                    chartData.push(dayData ? dayData.totalSales : 0);
                }
                break;

            case 'weekly':
                
                const weekStart = week ? new Date(week) : new Date(now.setDate(now.getDate() - now.getDay()));
                const weekEnd = new Date(weekStart);
                weekEnd.setDate(weekStart.getDate() + 6);
                weekEnd.setHours(23, 59, 59);

                const weeklyData = await Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: weekStart, $lte: weekEnd },
                            status: { $nin: ['Cancelled'] },
                            paymentStatus: 'Paid'
                        }
                    },
                    {
                        $group: {
                            _id: { $dayOfWeek: '$createdAt' },
                            totalSales: { $sum: '$totalAmount' },
                            orderCount: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                for (let i = 1; i <= 7; i++) {
                    const dayData = weeklyData.find(d => d._id === i);
                    labels.push(dayNames[i - 1]);
                    chartData.push(dayData ? dayData.totalSales : 0);
                }
                break;

            case 'daily':
                
                const selectedDate = req.query.date ? new Date(req.query.date) : new Date();
                const startOfDay = new Date(selectedDate);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(selectedDate);
                endOfDay.setHours(23, 59, 59, 999);

                const dailyData = await Order.aggregate([
                    {
                        $match: {
                            createdAt: { $gte: startOfDay, $lte: endOfDay },
                            status: { $nin: ['Cancelled'] },
                            paymentStatus: 'Paid'
                        }
                    },
                    {
                        $group: {
                            _id: { $hour: '$createdAt' },
                            totalSales: { $sum: '$totalAmount' },
                            orderCount: { $sum: 1 }
                        }
                    },
                    { $sort: { '_id': 1 } }
                ]);

                for (let i = 0; i < 24; i++) {
                    const hourData = dailyData.find(d => d._id === i);
                    labels.push(`${i}:00`);
                    chartData.push(hourData ? hourData.totalSales : 0);
                }
                break;

            default:
                
                const defaultWeekStart = new Date(now.setDate(now.getDate() - now.getDay()));
                const defaultWeekEnd = new Date(defaultWeekStart);
                defaultWeekEnd.setDate(defaultWeekStart.getDate() + 6);

                
                labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
                chartData = [0, 0, 0, 0, 0, 0, 0]; 
        }

        res.json({
            success: true,
            data: {
                labels,
                datasets: [{
                    label: 'Sales (₹)',
                    data: chartData,
                    backgroundColor: '#4f46e5',
                    borderColor: '#4f46e5',
                    borderWidth: 2,
                    fill: false
                }]
            }
        });
    } catch (error) {
        console.error('Error fetching chart data:', error);
        res.status(500).json({ success: false, message: 'Error fetching chart data' });
    }
};

const getTopProducts = async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.query;
        let dateFilter = {};

        if (fromDate && toDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate + 'T23:59:59.999Z')
                }
            };
        }

        const topProducts = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid'
                }
            },
            { $unwind: '$items' },
            {
                $group: {
                    _id: '$items.product',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: {
                        $sum: {
                            $ifNull: ['$items.paidPrice', '$items.price']
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $match: {
                    'product.isDeleted': false,
                    'product.isActive': false 
                }
            },
            {
                $project: {
                    _id: 1,
                    name: '$product.name',
                    image: { $arrayElemAt: ['$product.images', 0] },
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, data: topProducts });
    } catch (error) {
        console.error('Error fetching top products:', error);
        res.status(500).json({ success: false, message: 'Error fetching top products' });
    }
};

const getTopCategories = async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.query;
        let dateFilter = {};

        if (fromDate && toDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate + 'T23:59:59.999Z')
                }
            };
        }

        const topCategories = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid'
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $match: {
                    'product.isDeleted': false,
                    'product.isActive': false 
                }
            },
            {
                $group: {
                    _id: '$product.categoryId',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: {
                        $sum: {
                            $ifNull: ['$items.paidPrice', '$items.price']
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'categories',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'category'
                }
            },
            { $unwind: '$category' },
            {
                $match: {
                    'category.isDeleted': false,
                    'category.isListed': true
                }
            },
            {
                $project: {
                    _id: 1,
                    name: '$category.name',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, data: topCategories });
    } catch (error) {
        console.error('Error fetching top categories:', error);
        res.status(500).json({ success: false, message: 'Error fetching top categories' });
    }
};

const getTopBrands = async (req, res, next) => {
    try {
        const { fromDate, toDate } = req.query;
        let dateFilter = {};

        if (fromDate && toDate) {
            dateFilter = {
                createdAt: {
                    $gte: new Date(fromDate),
                    $lte: new Date(toDate + 'T23:59:59.999Z')
                }
            };
        }

        const topBrands = await Order.aggregate([
            {
                $match: {
                    ...dateFilter,
                    status: { $nin: ['Cancelled'] },
                    paymentStatus: 'Paid'
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'product'
                }
            },
            { $unwind: '$product' },
            {
                $match: {
                    'product.isDeleted': false,
                    'product.isActive': false, 
                    'product.brand': { $exists: true, $ne: null, $ne: '' }
                }
            },
            {
                $group: {
                    _id: '$product.brand',
                    totalQuantity: { $sum: '$items.quantity' },
                    totalRevenue: {
                        $sum: {
                            $ifNull: ['$items.paidPrice', '$items.price']
                        }
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    name: '$_id',
                    totalQuantity: 1,
                    totalRevenue: 1
                }
            },
            { $sort: { totalRevenue: -1 } },
            { $limit: 10 }
        ]);

        res.json({ success: true, data: topBrands });
    } catch (error) {
        console.error('Error fetching top brands:', error);
        res.status(500).json({ success: false, message: 'Error fetching top brands' });
    }
};

const adminLogin =async (req,res,next) => {
   try {
    const {email,password} = req.body;
    if(!email || !password)return res.redirect('/admin?error=email and password is required');
    
    const admin = await Admin.findOne({email})
    
    if(!admin)return res.redirect('/admin?error=Admin not found')

    const isMatch = await bcrypt.compare(password,admin.password)
    if(!isMatch)return res.redirect('/admin?error=Invalid Password');


    req.session.admin = {id:admin._id,email:admin.email};

    if(process.env.AUTH_METHOD === "JWT"){
            const token = jwt.sign({id:admin._id, email:admin.email},process.env.JWT_SECRET,{expiresIn:'1h'})
            res.cookie("token",token,{httpOnly:true});
    }

    res.redirect('/admin/dashboard');

   }catch (error) {
    console.log('this is admin login error',error);
        next(error)

   }
    
}

const logout = async (req,res)=>{
    req.session.destroy((err)=>{
        if(err){
            
            return res.redirect('/page-404');
        }
    }) 
    
    res.clearCookie('connect.sid');
    return res.redirect('/admin');
}






module.exports = {
    getAdminLogin,
    getDashBoard,
    adminLogin,
    logout,
    getDashboardMetrics,
    getChartData,
    getTopProducts,
    getTopCategories,
    getTopBrands
};

