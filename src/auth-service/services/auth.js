const passport = require('passport');
const LocalStrategy = require('passport-local');
const User = require('../models/User');
const constants = require('../config/constants');
const { Strategy: JWTStrategy, ExtractJwt } = require('passport-jwt');

const localOpts = {
    usernameField: 'userName',
};

const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"), secretOrKey: constants.JWT_SECRET,
}

const localStrategy = new LocalStrategy(localOpts, async (userName, password, done) => {
    try {
        const user = await User.findOne({
            userName
        });
        if (!user) {
            return done(null, false);
        }
        else if (!user.authenticateUser(password)) {
            return done(null, false)
        }
        return done(null, user);
    }
    catch (e) {
        return done(e, false)
    }
});

const jwtStrategy = new JWTStrategy(jwtOpts, async (payload, done) => {
    try {
        const user = await User.findById(payload._id);
        if (!user) {
            return done(null, false);
        }
        return done(null, user);
    }
    catch (e) {
        return done(e, false);
    }
});


passport.use(localStrategy);

passport.use(jwtStrategy);


const authLocal = passport.authenticate('local', {
    session: false
})

const authJWT = passport.authenticate('jwt', {
    session: false
})

module.exports = { authLocal: authLocal, authJWT: authJWT };