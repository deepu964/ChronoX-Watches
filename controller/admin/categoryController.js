const  categorySchema = require('../../models/categorySchema');
const categoryOfferSchema = require('../../models/categoryOfferSchema');
const logger = require('../../utils/logger')

const listCategories = async (req,res,next) => {
    try {
        const search = req.query.search || '';
        const page = parseInt(req.query.page) || 1;
        const limit = 3;

        const query=
                {name:{$regex:search , $options:'i'}};
            
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
       logger.error('category list error');
        next(error);
    
}
}; 

const getAddCategory = async (req,res,next) => {
    try {
        res.render('admin/addcategory');
    } catch (error) {
      logger.error(' get category error');
        next(error);
    }
    
};

const addCategory = async (req,res,next) => {
    
    const {categoryName,description,isListed} = req.body;
    
    try {
      const existingCategory = await categorySchema.findOne({
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
      });

      if (existingCategory) {
        return res.json({ success: false, message: 'Category already exists || Only first letter should be Capital' });
      }

      const newCategory = new categorySchema({
        name:categoryName,
        description:description,
        isListed:isListed,
        addedDate: new Date()

      });
      await newCategory.save();
      
      return res.json({ success:true, message:'Category added successfully'});
    } catch (error) {
      logger.error('add category error',error);
        next(error);
    }
    
};

const toggleCategoryStatus = async (req, res,next) => {
  try {
    const { id } = req.params;
    const category = await categorySchema.findById(id);
    const currentStatus = category.isListed;
    const newStatus = !currentStatus;
    await categorySchema.findByIdAndUpdate(id,
        {isListed:newStatus}
    );
    
    res.json({ success: true, message:'Updated successfully' });
  } catch (err) {
    logger.error('this is toggle page error',err);
    next(err);
    res.status(500).json({ success: false });
  }
};

const getEditCategory = async (req,res) => {
    try {
       
        const categoryId = req.params.id;
        const category = await categorySchema.findById(categoryId);

        res.render('admin/editcategory',{category});
    } catch (error) {
        logger.error('this is edit category error',error);
        res.status(500).redirect('admin/page-404');
    }
};

const editCategory = async (req, res, next) => {
  try {
    const { categoryName, description } = req.body;
    const catId = req.params.id;

    const currentCategory = await categorySchema.findById(catId);
    if (!currentCategory) {
      return res.json({ success: false, message: 'Category not found' });
    }

    if (categoryName && categoryName !== currentCategory.name) {
      const nameExists = await categorySchema.findOne({
        _id: { $ne: catId }, 
        name: { $regex: new RegExp(`^${categoryName}$`, 'i') } 
      });

      if (nameExists) {
        return res.json({
          success: false,
          message: 'Category name already exists. Use a different name'
        });
      }
    }

    await categorySchema.findByIdAndUpdate(catId, {
      $set: {
        name: categoryName,
        description: description
      }
    });

    return res.json({ success: true, message: 'Updated Successfully' });
  } catch (error) {
    logger.error(' edit category error',error);
    next(error);
  }
};

const deleteCategory = async (req,res,next) => {
    try {
        const id = req.params.id;
        const category = await categorySchema.findById(id);
        if(category.isListed){
          await categorySchema.findByIdAndUpdate(id,{isListed:false});
        }else{
          await categorySchema.findByIdAndUpdate(id,{isListed:true});
        }
        
        if(!category){
            return res.json({success:false,message:'Category not found'});
        }
        return res.json({success:true,message:'Successfully Deleted'});
    } catch (error) {
      logger.error(' delete category error',error);
        next(error);
    }
    
};

const getCategoryOffers = async (req, res, next) => {
  try {
    const search = req.query.search || '';
    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const query = search ? {
      $or: [
        { offerName: { $regex: search, $options: 'i' } }
      ],
      isDeleted: false
    } : { isDeleted: false };

    const total = await categoryOfferSchema.countDocuments(query);
    const totalPage = Math.ceil(total / limit);
    const skip = (page - 1) * limit;

    const categoryOffers = await categoryOfferSchema.find(query)
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.render('admin/categoryOffer', {
      categoryOffers,
      currentPage: page,
      totalPage,
      search,
      total,
      limit
    });
  } catch (error) {
    logger.error('get category offer error', error);
    next(error);
  }
};

const getAddCategoryOffer = async (req, res, next) => {
  try {
    const categories = await categorySchema.find({ isListed: true, isDeleted: false })
      .sort({ name: 1 });

    res.render('admin/addCategoryOffer', { categories });
  } catch (error) {
    logger.error('get add category offer error', error);
    next(error);
  }
};

const addCategoryOffer = async (req, res, next) => {
  try {
    const { category, offerName, discount, startDate, endDate } = req.body;

    
    const existingOffer = await categoryOfferSchema.findOne({
      category: category,
      status: 'Active',
      isDeleted: false,
      endDate: { $gte: new Date() }
    });

    if (existingOffer) {
      return res.json({
        success: false,
        message: 'This category already has an active offer'
      });
    }

    
    const start = new Date(startDate);
    const end = new Date(endDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (start < today) {
      return res.json({
        success: false,
        message: 'Start date cannot be in the past'
      });
    }

    if (end <= start) {
      return res.json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    const newCategoryOffer = new categoryOfferSchema({
      category,
      offerName: offerName.trim(),
      discount: parseInt(discount),
      startDate: start,
      endDate: end,
      status: 'Active'
    });

    await newCategoryOffer.save();

    return res.json({
      success: true,
      message: 'Category offer added successfully'
    });
  } catch (error) {
    logger.error('add category offer error', error);
    next(error);
  }
};

const toggleCategoryOfferStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.json({ success: false, message: 'Invalid offer ID' });
    }

    const offer = await categoryOfferSchema.findById(id);
    if (!offer) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    await categoryOfferSchema.findByIdAndUpdate(id, { status });

    res.json({
      success: true,
      message: `Offer ${status.toLowerCase()} successfully`
    });
  } catch (error) {
    logger.error('toggle category offer status error', error);
    next(error);
  }
};

const deleteCategoryOffer = async (req, res, next) => {
  try {
    const { id } = req.params;

    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.json({ success: false, message: 'Invalid offer ID' });
    }

    const offer = await categoryOfferSchema.findById(id);
    if (!offer) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    await categoryOfferSchema.findByIdAndUpdate(id, { isDeleted: true });

    res.json({
      success: true,
      message: 'Offer deleted successfully'
    });
  } catch (error) {
    logger.error('delete category offer error', error);
    next(error);
  }
};

const getEditCategoryOffer = async (req, res, next) => {
  try {
    const { id } = req.params;

    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.redirect('/admin/category-offers');
    }

    const offer = await categoryOfferSchema.findById(id).populate('category');
    const categories = await categorySchema.find({ isListed: true, isDeleted: false })
      .sort({ name: 1 });

    if (!offer) {
      return res.redirect('/admin/category-offers');
    }

    res.render('admin/editCategoryOffer', { offer, categories });
  } catch (error) {
    logger.error('get edit category offer error', error);
    next(error);
  }
};

const editCategoryOffer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { category, offerName, discount, startDate, endDate } = req.body;

    
    if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.json({ success: false, message: 'Invalid offer ID' });
    }

    const currentOffer = await categoryOfferSchema.findById(id);
    if (!currentOffer) {
      return res.json({ success: false, message: 'Offer not found' });
    }

    
    const existingOffer = await categoryOfferSchema.findOne({
      _id: { $ne: id },
      category: category,
      status: 'Active',
      isDeleted: false,
      endDate: { $gte: new Date() }
    });

    if (existingOffer) {
      return res.json({
        success: false,
        message: 'This category already has another active offer'
      });
    }

    
    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end <= start) {
      return res.json({
        success: false,
        message: 'End date must be after start date'
      });
    }

    await categoryOfferSchema.findByIdAndUpdate(id, {
      category,
      offerName: offerName.trim(),
      discount: parseInt(discount),
      startDate: start,
      endDate: end
    });

    return res.json({
      success: true,
      message: 'Category offer updated successfully'
    });
  } catch (error) {
    logger.error('edit category offer error', error);
    next(error);
  }
};

module.exports ={
    listCategories,
    addCategory,
    editCategory,
    deleteCategory,
    getAddCategory,
    toggleCategoryStatus,
    getEditCategory,
    getCategoryOffers,
    getAddCategoryOffer,
    addCategoryOffer,
    toggleCategoryOfferStatus,
    deleteCategoryOffer,
    getEditCategoryOffer,
    editCategoryOffer
};