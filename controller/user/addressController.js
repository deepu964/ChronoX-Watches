const User = require('../../models/userSchema');
const addressSchema = require('../../models/addressSchema');
const logger = require('../../utils/logger')

const getAddress = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return res.redirect('/login?message=Please login to view your address');
        }
        const userId = req.session.user._id;
        const user = await User.findById(userId);
        const addresses = await addressSchema.find({ userId: userId }).lean();
        res.render('user/address', { user, addresses });
    } catch (error){
        logger.error('address get error');
        next(error);
    }
};

const getAddAddress = async (req, res, next) => {
    try {
        const user = req.session.user._id;
        res.render('user/addAddress', { user });

    } catch (error) {
        logger.error('address add error');
        next(error);
    }
};

const addAddress = async (req, res, next) => {
    try {
        const userId = req.session.user._id;

        const { fullName, phone, pinCode, city, state, district, address, landmark, addressType } = req.body;

        const newAddress = new addressSchema({
            userId,
            fullName,
            phone,
            pinCode,
            city,
            state,
            district,
            address,
            landmark,
            addressType
        });
        await newAddress.save();
        return res.status(200).redirect('/address?message=Address added successfully');
    } catch (error) {
        logger.error('add address error');
        next(error);
    }
};

const getEditAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;
        const address = await addressSchema.findById(addressId);
        if (!address) return res.status(404).send('Address not found');
        res.render('user/editAddress', {
            user: req.session.user,
            address
        });
    } catch (err) {
        logger.error(' get edit address error');
        next(err);
    }
};

const editAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;

        const { fullName, phone, pinCode, city, state, district, address, landmark, addressType } = req.body;

        const currentAddress = await addressSchema.findById(addressId);
        if (!currentAddress) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        let existingAddress = null;
        if (fullName && fullName !== currentAddress.fullName) {
            existingAddress = await addressSchema.findOne({
                _id: { $ne: addressId },
                fullName: new RegExp(`^${fullName}$`, 'i')
            });
        }

        if (existingAddress) {
            return res.status(400).json({ success: false, message: 'Address with this name already exists' });
        }

        await addressSchema.findByIdAndUpdate(addressId, {
            fullName,
            phone,
            pinCode,
            city,
            state,
            district,
            address,
            landmark,
            addressType
        });
        return res.status(200).json({ success: true, message: 'Address updated successfully' });
    } catch (error) {
        logger.error(' edit address error');
        next(error);
    }
};

const deleteAddress = async (req, res, next) => {
    try {
        const addressId = req.params.id;

        const address = await addressSchema.findById(addressId);
        if (!address) {
            return res.status(404).json({ success: false, message: 'Address not found' });
        }
        await addressSchema.findByIdAndDelete(addressId);
        return res.status(200).json({ success: true, message: 'Address deleted successfully' });
    } catch (error) {
        logger.error(' delete address error');
        next(error);
    }
};

module.exports = {
    getAddress,
    getAddAddress,
    addAddress,
    getEditAddress,
    editAddress,
    deleteAddress
};
