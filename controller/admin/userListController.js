const User = require('../../models/userSchema')

const userList = async (req,res,next) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const query = {
            $or:[
               {fullname:{$regex:search , $options:"i"}},
               {email:{$regex:search, $options:"i"}}
            ]}
        const totalUser = await User.countDocuments(query);

        const totalPage = Math.ceil(totalUser/limit);

        const skip = ((page-1)*limit);

        const user = await User.find(query)
            .sort({createdAt:-1})
            .skip(skip)
            .limit(limit);

            res.render('admin/userlist',{
                 user,
                 currentPage: page,
                 totalPage,
                 search,
                 totalUser,
                 limit
                 
            })
    } catch (error) {
        console.log('this is userlist page error ',error);
        // res.redirect('/admin/dashboard');
        next(error)
    }
    
}

const blockUser = async (req,res,next) => {
    try {
        const userId = req.params.id;
       
        const user = await User.findById(userId);
        const newStatus = user.isBlocked ? false : true;

        await User.findByIdAndUpdate(userId,{isBlocked:newStatus});
        if(newStatus){
            res.json({success:true,message:"User Blocked"})
        } else{
            res.json({success:true,message:"User Unblocked"})
        }

    } catch (error) {
        console.log("userblock is error",error);
        next(error)
    }
    
}


module.exports = {
    userList,
    blockUser,
   
    
}