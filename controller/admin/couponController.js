const couponSchema =require('../../models/couponSchema');
const productSchema = require('../../models/productSchema');

const getCoupon = async (req,res,next) => {
    try {
      const limit = 3; 
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const query = {
        $or: [
            { name: { $regex: search, $options: 'i' } },
            { code: { $regex: search, $options: 'i' } }
        ]
    };
    
    const total = await couponSchema.countDocuments(query);
    const totalPage = Math.ceil(total / limit);
    const coupons = await couponSchema.find(query)
        .skip((page - 1) * limit)
        .limit(limit)
        .sort({ createdAt: -1 });

    res.render('admin/coupon', {
        coupons,
        currentPage: page,
        totalPage,
        search,
        limit,
        total

    });
    } catch (error) {
       
        next(error)
    
}
} 


const getAddCoupon = async (req,res,next) => {
    try {
        res.render('admin/addCoupon');
    } catch (error) {
        next(error)
    }
    
}

const addCoupon = async (req,res,next) => {
   try {
    const {name,discount,expiryDate,minPurchase} = req.body;
    console.log(req.body,'this is couponnnnn')

    const existsCoupon = await couponSchema.findOne({name:name});
    if(existsCoupon ){
         return res.status(400).json({success:false,message:"Coupon is already exists"});
    }

    const newCoupon = new couponSchema({
        name,
        discount,
        expiryDate,
        minPurchase
    });

    await newCoupon.save()

    res.status(200).json({success:true, message:"Coupon Add Successfull"})
   
   } catch (error) {
    next(error)
   } 
}


const deleteCoupon = async (req,res,next) => {
    try {
        const id = req.params.id;
        const coupon = await couponSchema.findById(id);
        if(!coupon){
          return  res.status(400).json({success:false, message:"coupon is not found"});
        }

        await couponSchema.findByIdAndDelete(id);

        res.status(200).json({success:true,message:"Coupon deleted successfull"});

    } catch (error) {
       next(error); 
    }
    
}


module.exports = {
    getCoupon,
    getAddCoupon,
    addCoupon,
    deleteCoupon
}