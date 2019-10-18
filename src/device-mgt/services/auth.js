const passport = require('passport');
const Manager = require('../models/Manager');
const constants = require('../config/constants');
const { Strategy: JWTStrategy, ExtractJwt } = require('passport-jwt');


const jwtOpts = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"), secretOrKey: constants.JWT_SECRET,
}

const jwtStrategy = new JWTStrategy(jwtOpts, async (payload, done) => {
    try {
        const manager = await Manager.findById(payload._id);
        if (!manager) {
            return done(null, false);
        }
        return done(null, manager);
    }
    catch (e) {
        return done(e, false);
    }
});

passport.use(jwtStrategy);


const authJWT = passport.authenticate('jwt', {
    session: false
})

module.exports = { authJWT: authJWT };