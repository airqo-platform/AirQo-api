const passport = require("passport");
const DeviceSchema = require("../models/Device");
const constants = require("../config/constants");
const { Strategy: JWTStrategy, ExtractJwt } = require("passport-jwt");

const DeviceModel = (tenant) => {
  getModelByTenant(tenant, "device", DeviceSchema);
};

const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
  secretOrKey: constants.JWT_SECRET,
};

const jwtStrategy = new JWTStrategy(jwtOpts, async (payload, done) => {
  try {
    const device = await DeviceModel(payload.tenant).findById(payload._id);
    if (!device) {
      return done(null, false);
    }
    return done(null, device);
  } catch (e) {
    return done(e, false);
  }
});

passport.use(jwtStrategy);

const authJWT = passport.authenticate("jwt", {
  session: false,
});

module.exports = { authJWT: authJWT };
