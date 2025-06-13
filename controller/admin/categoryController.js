const { json } = require('express');
const  categorySchema = require('../../models/categorySchema');
const productSchema = require('../../models/productSchema');

const listCategories = async (req,res,next) => {
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
       console.log("category list error");
        next(error)
    
}
} 

const getAddCategory = async (req,res,next) => {
    try {
        res.render('admin/addcategory');
    } catch (error) {
      console.log(" get category error")
        next(error)
    }
    
}

const addCategory = async (req,res,next) => {
    
    const {categoryName,description,isListed} = req.body;
    
    try {
      const existingCategory = await categorySchema.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
      });

      if (existingCategory) {
        return res.json({ success: false, message: "Category already exists || Only first letter should be Capital" });
      }

      const newCategory = new categorySchema({
        name:categoryName,
        description:description,
        isListed:isListed,
        addedDate: new Date()

      });
      await newCategory.save();
      
      return res.json({ success:true, message:"Category added successfully"});
    } catch (error) {
      console.log("add category error")
        next(error);
    }
    
}

const toggleCategoryStatus = async (req, res,next) => {
  try {
    const { id } = req.params;
    const category = await categorySchema.findById(id)
    const currentStatus = category.isListed;
    const newStatus = !currentStatus;
    await categorySchema.findByIdAndUpdate(id,
        {isListed:newStatus}
    );
    
    res.json({ success: true, message:"Updated successfully" });
  } catch (err) {
    next(err)
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


const editCategory = async (req, res, next) => {
  try {
    const { categoryName, description } = req.body;
    const catId = req.params.id;

    const currentCategory = await categorySchema.findById(catId);
    if (!currentCategory) {
      return res.json({ success: false, message: "Category not found" });
    }

    if (categoryName && categoryName !== currentCategory.name) {
      const nameExists = await categorySchema.findOne({
        _id: { $ne: catId }, 
        name: { $regex: new RegExp(`^${categoryName}$`, "i") } 
      });

      if (nameExists) {
        return res.json({
          success: false,
          message: "Category name already exists. Use a different name"
        });
      }
    }

    await categorySchema.findByIdAndUpdate(catId, {
      $set: {
        name: categoryName,
        description: description
      }
    });

    return res.json({ success: true, message: "Updated Successfully" });
  } catch (error) {
    console.log(" edit category error")
    next(error);
  }
};

const deleteCategory = async (req,res,next) => {
    try {
        const id = req.params.id;
        const category = await categorySchema.findById(id);
        if(category.isListed){
          await categorySchema.findByIdAndUpdate(id,{isListed:false})
        }else{
          await categorySchema.findByIdAndUpdate(id,{isListed:true})
        }
        
        if(!category){
            return res.json({success:false,message:"Category not found"})
        }
        return res.json({success:true,message:"Successfully Deleted"})
    } catch (error) {
      console.log(" delete category error")
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