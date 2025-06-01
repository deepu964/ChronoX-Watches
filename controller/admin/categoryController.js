const { json } = require('express');
const  categorySchema = require('../../models/categorySchema');
const productSchema = require('../../models/productSchema');

const listCategories = async (req,res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 3;

        const query=
                {name:{$regex:search , $options:"i"}}
            
        const total = await categorySchema.countDocuments(query);
        const totalPage = Math.ceil(total / limit);
         const skip = ((page-1)*limit);
        const category = await categorySchema.find(query)
        .sort({addedDate:-1})
        .skip(skip)
        .limit(limit);

       res.render('admin/category',{
           category,
           currentPage:page,
           totalPage,
           search,
           total,
           limit


    });
    } catch (error) {
        console.log("this is category render error");
        res.status(500).send("server error");
    }
    
}

const getAddCategory = async (req,res) => {
    try {
        res.render('admin/addcategory');
    } catch (error) {
        
    }
    
}

const addCategory = async (req,res) => {
    console.log(req.body);
    const {categoryName,description,maxRedeemable,categoryOffer,isListed} = req.body;
    console.log("here")
    try {
      const existingCategory =  await categorySchema.findOne({categoryName});
      if(existingCategory){
        return res.json({success:false, message:"Category already exists"});
      } 

      const newCategory = new categorySchema({
        name:categoryName,
        description:description,
        MaxPrice:maxRedeemable,
        offer:categoryOffer,
        isListed:isListed,
        addedDate: new Date()

      });
      await newCategory.save();
      return res.json({ success:true, message:"Category added successfully"});
    } catch (error) {
        console.log(error,'something happen addcategory');
    }
    
}

const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const category = await categorySchema.findById(id)
    const currentStatus = category.isListed;
    const newStatus = !currentStatus;
    await categorySchema.findByIdAndUpdate(id,
        {isListed:newStatus}
    );
    console.log(newStatus)
    res.json({ success: true, message:"Updated successfully" });
  } catch (err) {
    console.error('Toggle status error:', err);
    res.status(500).json({ success: false });
  }
};
const getEditCategory = async (req,res) => {
    try {
       
        const categoryId = req.params.id;
        const category = await categorySchema.findById(categoryId);

        res.render('admin/editcategory',{category});
    } catch (error) {
        console.log("this is edit category error",error);
        res.status(500).redirect('admin/page-404');
    }
}

const editCategory = async (req,res) => {
    try {
        const {categoryName,description,} = req.body;
        const catId = req.params.id
        const existCategory = await categorySchema.findOne({_id:catId})
        if(existCategory.name == categoryName){
            return res.json({success:false,message:"Category name already Exist. Use different name"})
        }
        await categorySchema.findByIdAndUpdate(catId,{
            $set:{
                name:categoryName,
                description:description,
           
            }
        })
        return res.json({success:true,message:"Updated Successfully"})
    } catch (error) {
        console.log("edit category side",error)
    }
    
}



const deleteCategory = async (req,res) => {
    try {
        const id = req.params.id;
        const category = await categorySchema.findByIdAndDelete(id);
        const product = await productSchema.findOne({}).populate()
        console.log(product, "this is product");
    

        if(!category){
            return res.json({success:false,message:"Category not found"})
        }
        return res.json({success:true,message:"Successfully Deleted"})
    } catch (error) {
        next(error);
    }
    
}


module.exports ={
    listCategories,
    addCategory,
    editCategory,
    deleteCategory,
    getAddCategory,
    toggleCategoryStatus,
    getEditCategory

} 