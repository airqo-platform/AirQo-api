const passport = require("passport");
const LocalStrategy = require("passport-local");
const UserSchema = require("../models/User");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");
const { Strategy: JWTStrategy, ExtractJwt } = require("passport-jwt");
const expressJwt = require("express-jwt");
const privileges = require("../utils/privileges");
const localOpts = {
  usernameField: "userName",
  passwordField: "password",
};
const isEmpty = require("is-empty");
const { getModelByTenant } = require("../utils/multitenancy");

let tenantSession;

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
  secretOrKey: constants.JWT_SECRET,
};

function createTenantSession(tenant) {
  tenantSession = tenant;
}

const userLocalStrategy = new LocalStrategy(
  localOpts,
  async (userName, password, done) => {
    try {
      const user = await UserModel(tenantSession)
        .findOne({
          userName,
        })
        .exec();
      if (!user) {
        return done(null, false);
      } else if (!user.authenticateUser(password)) {
        return done(null, false);
      }
      return done(null, user);
    } catch (e) {
      return done(e, false);
    }
  }
);

const jwtStrategy = new JWTStrategy(jwtOpts, async (payload, done) => {
  try {
    const user = await User.findById(payload._id);
    if (!user) {
      return done(null, false);
    }
    return done(null, user);
  } catch (e) {
    return done(e, false);
  }
});

passport.use("user-local", userLocalStrategy);
passport.use(jwtStrategy);

passport.serializeUser((user, cb) => {
  if (privileges.isUser(user)) {
    cb(null, user._id);
    // serialize user
  } else if (privileges.isCollab(user)) {
    // serialize collaborator
    cb(null, user._id);
  }
});

passport.deserializeUser((id, cb) => {
  if (privileges.isUser(id)) {
    User.findById(id)
      .then((user) => cb(null, user))
      .catch((err) => cb(err));
    // serialize user
  } else if (privileges.isCollab(user)) {
    // serialize collaborator
    Collaborator.findById(id)
      .then((user) => cb(null, user))
      .catch((err) => cb(err));
  }
});

function login(req, res, next) {
  try {
    if (req.query.tenant) {
      createTenantSession(req.query.tenant);
      next();
    } else {
      res.json({
        success: false,
        message:
          "the organization is missing in the request field, please check documentation",
      });
    }
  } catch (e) {
    console.log("the error in login is: ", e.message);
    res.json({ success: false, message: e.message });
  }
}

const authUserLocal = passport.authenticate("user-local", {
  session: false,
  // successFlash: "Welcome!",
  // failureFlash: "Invalid username or password.",
});

const authColabLocal = passport.authenticate("colab-local", {
  successFlash: "Welcome!",
  failureFlash: "Invalid username or password.",
});

const authJWT = passport.authenticate("jwt", {
  session: false,
});

const isLoggedIn = function isLoggedIn(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  } else {
    return res.redirect("/login");
  }
};

const requiresSignIn = expressJwt({
  secret: process.env.JWT_SECRET,
  userProperty: "auth",
});

module.exports = {
  login: login,
  authUserLocal: authUserLocal,
  authJWT: authJWT,
  authColabLocal: authColabLocal,
  isLoggedIn: isLoggedIn,
  requiresSignIn: requiresSignIn,
};
