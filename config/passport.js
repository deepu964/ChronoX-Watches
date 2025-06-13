require('dotenv').config();
const passport = require('passport');
const GoogleStrategy =require('passport-google-oauth20').Strategy
const User = require('../models/userSchema');


passport.use(new GoogleStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret:process.env.GOOGLE_CLIENT_SECRET,
    callbackURL:process.env.GOOGLE_AUTH_URL
},


async (accessToken, refreshToken, profile, done) => {
    
    try {
        let user = await User.findOne({googleId:profile.id})
        
        if (user && user.isBlocked) {
            return done(null, false, { message: 'Your account has been blocked by admin.' });
        }

        user = await User.findOne({email:profile.emails[0].value});
       
        if(user){
            user.googleId = profile.id;

             if (!user.name) {
                user.name = profile.displayName;
            }


            await user.save();
            return done(null,user);

        }else{
            user = new User({
                fullname:profile.displayName,
                email:profile.emails[0].value,
                googleId:profile.id,

            });
            await user.save();
            return done (null,user);
        }
    } catch (error) {
        return done (error,null);
    }
}
));

passport.serializeUser((user,done)=>{
   done(null,user.id);
});

passport.deserializeUser((id,done)=>{
    User.findById(id)
    .then(user=>{
        done(null,user)
    })
    .catch(err=>{
        done(err,null);
    });
});

module.exports = passport;
