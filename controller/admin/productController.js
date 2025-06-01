const productSchema = require('../../models/productSchema');
const categorySchema = require('../../models/categorySchema');
const cloudinary = require('../../utils/cloudinary');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { nextTick } = require('process');

const product = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const search = req.query.search ? req.query.search.trim() : "";
        const category = req.query.category || 'all';
        // const priceOrder = req.query.price || 'none';

        
        let query = {};
        
        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

         if (category !== 'all') {
            const categoryDoc = await categorySchema.findOne({ name: category });
            if (categoryDoc) {
                query.categoryId = categoryDoc._id;
            } else {
                console.log("Category not found");
            }
        }
        
        
        const totalProducts = await productSchema.countDocuments(query);

        
        // let sortOption = {};
        // if (priceOrder === 'low') {
        //     sortOption.price = 1;
        // } else if (priceOrder === 'high') {
        //     sortOption.price = -1;
        // }

        const products = await productSchema.find(query)
            .populate('categoryId')
            .sort({createdAt:-1})
            .skip((page - 1) * limit)
            .limit(limit);
       
        const totalPage = Math.ceil(totalProducts / limit);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        const categories = await categorySchema.find({isListed:true})


        res.render('admin/product', {
            products,
            currentPage: page,
            totalPage,
            totalProducts,
            limit,
            search,
            cloudName,
            categories,
            selectedCategory: category,
            // categoryDoc
            // selectedPrice: priceOrder
        });

    } catch (error) {
        console.log("Product page error:", error);
        res.status(500).send("Internal Server Error");
    }
};


const getproductAdd = async (req, res) => {
    try {
        const categories = await categorySchema.find({isListed:true}) || [];
        res.render('admin/addproduct', { categories });
    } catch (error) {
        console.log("Product add page error:", error);
        res.render('admin/addproduct', { categories: [] });
    }
};

const addProduct = async (req, res) => {
    try {
        const {
            name, description, category, brand, offer, stock,
            model, regularPrice, salePrice, additionalInfo
        } = req.body;

        let images = [];

        const uploadToCloudinary = (buffer, originalFilename) => {
        return new Promise((resolve, reject) => {
           
            const sanitizedFilename = path.parse(originalFilename).name.replace(/[^a-zA-Z0-9-_]/g, '');
            const uniqueFilename = `${Date.now()}_${sanitizedFilename}`;
            

            const uploadStream = cloudinary.uploader.upload_stream(
                {
                    folder: 'products',
                    public_id: uniqueFilename,
                    
                    transformation: [
                        { width: 300, height: 300, crop: 'fill', quality: 'auto' }
                    ]
                },
                (error, result) => {
                    if (error) {
                        console.error('Cloudinary upload error:', error);
                        reject(error);
                    } else {
                        console.log('Cloudinary upload success:', {
                            public_id: result.public_id,
                            secure_url: result.secure_url
                        });
                        resolve(result);
                    }
                }
            );
            uploadStream.end(buffer);
        });
    };

        

      
        if (req.files && req.files.mainImage) {
            const mainImage = Array.isArray(req.files.mainImage)
                ? req.files.mainImage[0]
                : req.files.mainImage;

            if (!mainImage.tempFilePath) {
                
            }

            const processedFilename = `main-${uuidv4()}.jpg`;
            const processedBuffer = await sharp(mainImage.tempFilePath)
                .resize(800, 800, { fit: 'cover' })
                .toBuffer();

            const result = await uploadToCloudinary(processedBuffer, processedFilename);
            images.push({ public_id: result.public_id, isMain: true });
        } else {
            throw new Error("Main product image is required");
        }

        
        if (req.files && req.files.additionalImages) {
            const additionalImageFiles = Array.isArray(req.files.additionalImages)
                ? req.files.additionalImages
                : [req.files.additionalImages];

            for (let file of additionalImageFiles) {
                if (!file.tempFilePath) {
                    console.warn(`Skipping invalid additional image: Missing temp file path for ${file?.name || 'unknown'}`);
                    continue; 
                }

                const processedFilename = `additional-${uuidv4()}.jpg`;
                const processedBuffer = await sharp(file.tempFilePath)
                    .resize(800, 800, { fit: 'cover' })
                    .toBuffer();

                const result = await uploadToCloudinary(processedBuffer, processedFilename);
                images.push({ public_id: result.public_id, isMain: false });
            }
        }

        const newProduct = new productSchema({
            name,
            description,
            categoryId: category,
            brand,
            offer,
            images,
            model,
            additionalInfo,
            variants: [{
                regularPrice: regularPrice,
                salePrice: salePrice,
                quantity: stock
            }]
        });

        await newProduct.save();
            res.redirect('/admin/product');

        
    } catch (error) {
        console.error("Error adding product:", error.message, error.stack);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
};

const getEditProduct = async(req,res)=>{
     
  try {
    const productId = req.params.id;

    const product = await productSchema.findOne({_id:productId});
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const categories = await categorySchema.find()
    res.render('admin/editproduct',{product,categories,cloudName});
  } catch (error) {
    next(error);
  }
}

const editProduct =async(req,res)=>{
    try {
        
       const { name, description, category, brand, offer,model, regularPrice, salePrice, quantity,additionalInfo,mainImage,} = req.body;
       const editId = req.params.id;
       const existProduct = await productSchema.findOne({_id:editId});
       
       if(existProduct.name == name){
        return res.json({success:false, message:"Product name is alredy exist.use diffrent name"});
       }
       await productSchema.findByIdAndUpdate(editId,{
        $set:{
            name:name,
            description:description,
            categoryId:category,
            brand:brand,
            offer:offer,
            variants: [{
                regularPrice: regularPrice,
                salePrice: salePrice,
                quantity:quantity
            }],         
            model:model,
            additionalInfo:additionalInfo,
            images:mainImage,
            

        }
       })
       return res.json({success:true, message:"Product Updatedd successfull"});
       
    } catch (error) {
        console.log("updated error",error);

    }
}

const deleteProduct = async (req,res) => {
    try {
       const id = req.params.id;
       const product =await productSchema.findByIdAndDelete(id);
       if(!product){
        return res.json({success:false, message:"Product is not found"});
       }else{
        return res.json({success:true, message:"product Delete Successfull"});
       } 
    } catch (error) {
        next(error);

    }    
}

const blockedProduct = async (req,res) => {
    try {
        const productId = req.params.id;
        console.log(productId)
        const product = await productSchema.findOne({_id:productId});
        const newStatus = product.isActive ? false: true;
        console.log(newStatus,'thsdnkndk')
        
        await productSchema.findByIdAndUpdate(productId,{isActive:newStatus});
        if(newStatus){
            res.json({success:true, message:"product blocked"});
        }else{
            res.json({success:false, message:"Product unblocked"});
        }
    } catch (error) {
        console.log(error);
    }
    
}

        const getProductDetails = async (req, res) => {
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId).populate('reviews.user', 'name');
        res.render('productDetails', { product });
    } catch (error) {
        res.status(500).send('Error loading product details');
    }
};

const addReview = async (req, res) => {
    const productId = req.params.id;
    const userId = req.session.user;
    

    const { rating, comment } = req.body;

    try {
        const product = await productSchema.findById(productId);
        const newReview = {
            user: userId,
            rating: Number(rating),
            comment,
            createdAt: new Date()
        };
        product.reviews.push(newReview);
        await product.save();
        res.status(200).json({ message: 'Review saved' });
    } catch (error) {
        res.status(500).json({ error: 'Error saving review' });
    }
};


module.exports = {
    product,
    addProduct,
    getproductAdd,
    getEditProduct,
    editProduct,
    deleteProduct,
    blockedProduct,
    getProductDetails,
    addReview
};


