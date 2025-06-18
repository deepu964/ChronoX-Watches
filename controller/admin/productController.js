const productSchema = require('../../models/productSchema');
const categorySchema = require('../../models/categorySchema');
const cloudinary = require('../../utils/cloudinary');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const sharp = require('sharp');
const { nextTick } = require('process');

const product = async (req, res, next) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 3;
        const search = req.query.search ? req.query.search.trim() : "";
        const category = req.query.category || 'all';
        
        let query = {};

        if (search) {
            query.name = { $regex: search, $options: "i" };
        }

        if (category !== 'all') {
            const categoryDoc = await categorySchema.findOne({ name: category,isListed:true});
            if (categoryDoc) {
                query.categoryId = categoryDoc._id;
            } else {
                return res.redirect('/shop?category=all');
            }
        }


        const totalProducts = await productSchema.countDocuments(query);

        const products = await productSchema.find(query)
            .populate({
                path:'categoryId',
                match:{isListed:true}
            })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const totalPage = Math.ceil(totalProducts / limit);
        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

        const categories = await categorySchema.find({ isListed: true })


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

        });

    } catch (error) {
        console.log("product list page error");
        next(error);
    }
};

const getproductAdd = async (req, res) => {
    try {
        const categories = await categorySchema.find({ isListed: true }) || [];
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
        console.log(newProduct, 'thisi sjnfn dghbnx')
        await newProduct.save();
        res.redirect('/admin/product');


    } catch (error) {
        console.error("Error adding product:", error.message, error.stack);
        res.status(500).send(`Internal Server Error: ${error.message}`);
    }
};

const getEditProduct = async (req, res,next) => {

    try {
        const productId = req.params.id;

        const product = await productSchema.findOne({ _id: productId }).populate("categoryId");

         if (!product) {
            return res.status(404).render("admin/404", { message: "Product not found" });
        }

        if (!product.categoryId) {
            console.warn("⚠️ Category for product is missing or deleted");
        }

        const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
        const categories = await categorySchema.find()
        res.render('admin/editproduct', { product, categories, cloudName });
    } catch (error) {
        console.log('get edit product page error');
        next(error);
    }
}

const editProduct = async (req, res, next) => {
  try {
    const editId = req.params.id;
    const {
      name, description, category, brand, model, regularPrice, salePrice, quantity, additionalInfo
    } = req.body;

    const product = await productSchema.findById(editId);
    if (!product) return res.json({ success: false, message: "Product not found" });

    
    if (name && name !== product.name) {
      const existProduct = await productSchema.findOne({ name, _id: { $ne: editId } });
      if (existProduct) return res.json({ success: false, message: "Name already exists" });
    }

    let images = product.images || [];

   
    if (req.files && req.files.mainImage) {
      const mainImageFile = Array.isArray(req.files.mainImage) ? req.files.mainImage[0] : req.files.mainImage;
      const buffer = await sharp(mainImageFile.tempFilePath)
        .resize(800, 800)
        .toBuffer();

      const uploadResult = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({
          folder: 'products',
          transformation: [{ width: 300, height: 300, crop: 'fill', quality: 'auto' }]
        }, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
        stream.end(buffer);
      });

     
      images = images.filter(img => !img.isMain); 
      images.unshift({ public_id: uploadResult.public_id, isMain: true }); 
    }

    
    if (req.files && req.files.additionalImages) {
      const addImages = Array.isArray(req.files.additionalImages) ? req.files.additionalImages : [req.files.additionalImages];

      for (const file of addImages) {
        const buffer = await sharp(file.tempFilePath)
          .resize(800, 800)
          .toBuffer();

        const uploadResult = await new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream({
            folder: 'products',
            transformation: [{ width: 300, height: 300, crop: 'fill', quality: 'auto' }]
          }, (error, result) => {
            if (error) reject(error);
            else resolve(result);
          });
          stream.end(buffer);
        });

        images.push({ public_id: uploadResult.public_id, isMain: false });
      }
    }

   
    await productSchema.findByIdAndUpdate(editId, {
      $set: {
        name,
        description,
        categoryId: category,
        brand,
        model,
        additionalInfo,
        variants: [{ regularPrice, salePrice, quantity }],
        images
      }
    });

    res.json({ success: true, message: "Product updated successfully" });

  } catch (err) {
    console.log("edit product page error");
    next(err);
  }
};

const deleteProduct = async (req, res,next) => {
    try {
        const id = req.params.id;
        const product = await productSchema.findByIdAndDelete(id);
        if (!product) {
            return res.json({ success: false, message: "Product is not found" });
        } else {
            return res.json({ success: true, message: "product Delete Successfull" });
        }
    } catch (error) {
        console.log("delete product error");
        next(error);

    }
}

const blockedProduct = async (req, res, next) => {
    try {
        const productId = req.params.id;
        
        const product = await productSchema.findOne({ _id: productId });
        const newStatus = product.isActive ? false : true;
       

        await productSchema.findByIdAndUpdate(productId, { isActive: newStatus });
        if (newStatus) {
            res.json({ success: true, message: "product blocked" });
        } else {
            res.json({ success: false, message: "Product unblocked" });
        }
    } catch (error) {
        console.log("block porduct error")
        next(error);
    }

}

const getProductDetails = async (req, res, next) => {
    const productId = req.params.id;

    try {
        const product = await Product.findById(productId).populate('reviews.user', 'name');
        res.render('productDetails', { product });
    } catch (error) {
        console.log("details get error");
        next(error);
    }
};

const addReview = async (req, res, next) => {
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
        console.log("review add error")
        next(error);
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


