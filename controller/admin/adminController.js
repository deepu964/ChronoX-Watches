const errorMiddleware = require('../../middlewares/errorMiddleware');
const Admin = require('../../models/adminSchema')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Order = require('../../models/orderSchema');
const User = require('../../models/userSchema');
const productSchema = require('../../models/productSchema');


const getAdminLogin =async (req,res,next) => {
    try {
        
        if(req.session.admin){
          return res.redirect('/admin/dashboard')
        }

        const error = req.query.error
        return res.render('admin/login',{error})


    } catch (error) {
        next(error)
    }
    
}

const getDashBoard = async (req,res,next) => {
    try {
        if(!req.session.admin){
            return res.redirect('/admin')
        }

        // Get dashboard statistics
        const totalCustomers = await User.countDocuments();
        const totalOrders = await Order.countDocuments();
        const totalProducts = await productSchema.countDocuments();
        const pendingOrders = await Order.countDocuments({ status: 'Placed' });

        // Calculate total sales
        const salesResult = await Order.aggregate([
            { $match: { status: { $ne: 'Cancelled' } } },
            { $group: { _id: null, totalSales: { $sum: '$totalAmount' } } }
        ]);
        const totalSales = salesResult.length > 0 ? salesResult[0].totalSales : 0;

        const stats = {
            totalCustomers,
            totalOrders,
            totalProducts,
            totalSales,
            pendingOrders
        };

        res.render('admin/dashboard', { stats })
    } catch (error) {
        console.error("Dashboard error:", error);
        next(error)
    }

}

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
        next(error)

   }
    
}


const logout = async (req,res)=>{
    req.session.destroy((err)=>{
        if(err){
            console.log(err);
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
    logout
};

