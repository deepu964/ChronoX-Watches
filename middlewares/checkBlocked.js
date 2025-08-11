const User = require('../models/userSchema');

const checkBlocked = async (req, res, next) => {
  try {
    if (req.session.userId) {
      const user = await User.findById(req.session.userId);
      console.log(User, 'this isuseere');
      if (!user || user.isBlocked) {
        req.session.destroy(() => {
          res.clearCookie('connect.sid');
          res.status(403).json({
            success: false,
            blocked: true,
            message: 'Admin blocked you',
          });
        });
        return;
      }
    }
    next();
  } catch (err) {
    next(err);
  }
};

module.exports = checkBlocked;
