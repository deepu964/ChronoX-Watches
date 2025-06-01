const errorMiddleware = require('../../middlewares/errorMiddleware');
const Admin = require('../../models/adminSchema')
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken')


const getAdminLogin =async (req,res) => {
    try {
        if(req.session.admin){
          return res.redirect('/admin/dashboard')
        }
        const error = req.query.error
        return res.render('admin/login',{error})
    } catch (error) {
        res.status(500).send("admin login side",error);
    }
    
}

const getDashBoard = async (req,res) => {
    try {
        if(!req.session.admin){
            return res.redirect('/admin')
        }
        res.render('admin/dashboard')
    } catch (error) {
        res.status(500).send("dashboard not found");
    }
    
}

const adminLogin =async (req,res) => {
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
        console.log('ti is fkdkd ',error);

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

