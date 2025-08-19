const couponSchema = require('../../models/couponSchema');
const logger = require('../../utils/logger');

const getCoupon = async (req, res, next) => {
  try {
    const user = req.session.user;
    const limit = 3;
    const page = parseInt(req.query.page) || 1;
    const search = req.query.search || '';

    const query = {
      $or: [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ],
    };

    const total = await couponSchema.countDocuments(query);
    const totalPage = Math.ceil(total / limit);
    const coupons = await couponSchema
      .find(query)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.render('admin/coupon', {
      coupons,
      currentPage: page,
      totalPage,
      search,
      limit,
      total,
      user,
    });
  } catch (error) {
    logger.error('get coupon error');
    next(error);
  }
};

const getAddCoupon = async (req, res, next) => {
  try {
    res.render('admin/addCoupon');
  } catch (error) {
    logger.error(' add coupon error');
    next(error);
  }
};

const addCoupon = async (req, res, next) => {
  try {
    const { name, discount, expiryDate, minPurchase } = req.body;

    const existsCoupon = await couponSchema.findOne({ name: name });
    if (existsCoupon) {
      return res
        .status(400)
        .json({ success: false, message: 'Coupon is already exists' });
    }
    if (discount <= 0 || discount > 80) {
      return res
        .status(400)
        .json({ success: false, message: 'Discount limit 1 to 80' });
    }
    const newCoupon = new couponSchema({
      name,
      discount,
      expiryDate,
      minPurchase,
    });

    await newCoupon.save();

    res.status(200).json({ success: true, message: 'Coupon Add Successfull' });
  } catch (error) {
    logger.error('add coupon error', error);
    next(error);
  }
};

const getEditCoupon = async (req, res, next) => {
  try {
    const couponId = req.params.id;
    const coupon = await couponSchema.findById(couponId);
    if (!coupon) {
      return res
        .status(404)
        .render('admin/404', { message: 'Coupon not found' });
    }
    
    res.render('admin/editCoupon', { coupon });
  } catch (error) {
    logger.error('get edit coupon error', error);
    next(error);
  }
};

const editCoupon = async (req, res, next) => {
  try {
    let { name, discount, expiryDate, minPurchase } = req.body;
    const couponId = req.params.id;
    console.log(couponId,'is id')

    const coupon = await couponSchema.findById(couponId);
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: 'Coupon not found' });
    }
console.log(coupon,'is coup')
    name = name.trim();

    if (!/^[A-Za-z][A-Za-z0-9\s-]{2,49}$/.test(name)) {
      return res.json({
        success: false,
        message:
          'Invalid coupon name. Must start with a letter and be 3–50 characters long.',
      });
    }

    if (name.toLowerCase() !== coupon.name.toLowerCase()) {
      const nameExists = await couponSchema.findOne({
        _id: { $ne: couponId },
        name: { $regex: new RegExp(`^${name}$`, 'i') },
      });

      if (nameExists) {
        return res.json({
          success: false,
          message: 'Coupon name already exists. Use a different name.',
        });
      }
    }

    discount = parseFloat(discount);
    if (isNaN(discount) || discount <= 0 || discount > 80) {
      return res.json({
        success: false,
        message: 'Discount must be a number between 1 and 80.',
      });
    }

    const expiry = new Date(expiryDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(expiry.getTime()) || expiry < today) {
      return res.json({
        success: false,
        message: 'Expiry date must be a valid future date.',
      });
    }

    minPurchase = parseFloat(minPurchase);
    if (isNaN(minPurchase) || minPurchase < 0) {
      return res.json({
        success: false,
        message: 'Minimum purchase must be 0 or more.',
      });
    }

    await couponSchema.findByIdAndUpdate(couponId, {
      $set: {
        name,
        discount,
        expiryDate: expiry,
        minPurchase,
      },
    });
    console.log(await couponSchema.findByIdAndUpdate(couponId, {
      $set: {
        name,
        discount,
        expiryDate: expiry,
        minPurchase,
      },
    }))


    return res.json({ success: true, message: 'Coupon updated successfully' });
  } catch (error) {
    logger.error('editCoupon error:', error);
    next(error);
  }
};

const toggleCouponStatus = async (req, res, next) => {
  try {
    const couponId = req.params.id;

    const { active } = req.body;

    const coupon = await couponSchema.findById(couponId);
    if (!coupon) {
      return res
        .status(404)
        .json({ success: false, message: 'Coupon not found' });
    }

    coupon.isActive = active;
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${active ? 'activated' : 'deactivated'} successfully`,
    });
  } catch (error) {
    logger.error('toggleCouponStatus error:', error);
    next(error);
  }
};

const deleteCoupon = async (req, res, next) => {
  try {
    const id = req.params.id;
    const coupon = await couponSchema.findById(id);
    if (!coupon) {
      return res
        .status(400)
        .json({ success: false, message: 'coupon is not found' });
    }

    await couponSchema.findByIdAndDelete(id);

    res
      .status(200)
      .json({ success: true, message: 'Coupon deleted successfull' });
  } catch (error) {
    logger.error(' delete coupon error');
    next(error);
  }
};

module.exports = {
  getCoupon,
  getAddCoupon,
  addCoupon,
  deleteCoupon,
  getEditCoupon,
  editCoupon,
  toggleCouponStatus,
};
