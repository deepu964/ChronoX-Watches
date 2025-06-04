
const express = require("express");
const app = express();
const errorHandler = require('./middlewares/errorMiddleware');
const path = require('path');
require('dotenv').config();
const connectDB = require('./config/db')
const nodemon = require('nodemon');
const bcrypt = require('bcrypt');
const nocache = require('nocache');
const cors = require('cors');
const userRouter = require('./routers/userRouter');
const adminRouter = require('./routers/adminRouter');
const session = require("express-session");
const passport = require('./config/passport');
const ejsLayouts = require('express-ejs-layouts');
const fileUpload = require('express-fileupload');
const fs = require('fs');
const cookieParser = require('cookie-parser');
require('./utils/cloudinary');

const tempDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir);
}

connectDB();

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 60000 * 60 } 
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: tempDir
}));

app.use(cors());
app.use(nocache())
app.use(ejsLayouts);
app.use(express.static(path.join(__dirname,'public'))); 
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());
app.use(errorHandler);
app.use('/',userRouter);
app.use('/admin',adminRouter)



app.set('view engine','ejs');
app.set('views',path.join(__dirname,'views'));
app.set('layout', 'layout/main');


const port = process.env.PORT;
app.listen(port,()=>{
    console.log(`http://localhost:${port}`);
});




