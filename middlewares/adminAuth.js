// const isAdmin = (req,res,next)=>{
//     const admin = req.session.admin;
//     if(!admin)return res.redirect('/admin');
//     next();
// }

// module.exports = isAdmin;

const jwt = require('jsonwebtoken');

const authenticateJwt = (req, res, next) => {
  const token = req.cookies.token;

  if (!token) {
    res.redirect('/admin');
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, admin) => {
    if (err) {
      return res.redirect('/admin?error=Inavalid%20Token');
    }
    req.admin = admin;
    next();
  });
};

const authenticateSession = (req, res, next) => {
  if (!req.session.admin) {
    return res.redirect('/admin');
  }
  req.admin = req.session.admin;
  next();
};

const adminAuth = (req, res, next) => {
  if (req.session && req.session.admin) {
    next();
  } else {
    res.redirect('/admin');
  }
};

const authMiddleware =
  process.env.AUTH_METHOD === 'JWT' ? authenticateJwt : authenticateSession;
module.exports = { authMiddleware, adminAuth };
