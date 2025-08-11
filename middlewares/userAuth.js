const isAuth = (req, res, next) => {
  const user = req.session.user;

  if (!user) {
    return res.redirect('/login');
  }

  const User = require('../models/userSchema');
  User.findById(user._id)
    .then((dbUser) => {
      if (!dbUser || dbUser.isBlocked) {
        req.session.destroy(() => {
          return res.redirect('/login?blocked=admin blocked this user');
        });
      } else {
        next();
      }
    })
    .catch((err) => {
      console.error('Middleware error:', err);
      res.redirect('/login');
    });
};

module.exports = isAuth;
