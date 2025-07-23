// 


require('dotenv').config();
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema');

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_AUTH_URL
},

// ✅ START GOOGLE CALLBACK
async (accessToken, refreshToken, profile, done) => {
    try {
        // ✅ 1. Check if user with this googleId already exists
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
            if (user.isBlocked) {
                return done(null, false, { message: 'Your account has been blocked by admin.' });
            }
            return done(null, user); // ✅ Existing Google user, done
        }

        // ✅ 2. If not found by googleId, check by email
        user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
            if (user.isBlocked) {
                return done(null, false, { message: 'Your account has been blocked by admin.' });
            }

            // ✅ Update existing user with Google ID if not set
            if (!user.googleId) {
                user.googleId = profile.id;
            }

            // ✅ Update name only if not already set
            if (!user.fullname) {
                user.fullname = profile.displayName;
            }

            await user.save();
            return done(null, user);
        }

        // ✅ 3. If user not found at all, create new one
        user = new User({
            fullname: profile.displayName,
            email: profile.emails[0].value,
            googleId: profile.id
        });

        await user.save();
        return done(null, user);

    } catch (error) {
        return done(error, null);
    }
}

));

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser((id, done) => {
    User.findById(id)
        .then(user => {
            done(null, user);
        })
        .catch(err => {
            done(err, null);
        });
});

module.exports = passport;
