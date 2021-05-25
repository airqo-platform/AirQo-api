const passport = require("passport");
const LocalStrategy = require("passport-local");
const HTTPStatus = require("http-status");
const UserSchema = require("../models/User");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const expressJwt = require("express-jwt");
const privileges = require("../utils/privileges");
const {
  axiosError,
  tryCatchErrors,
  missingQueryParams,
  callbackErrors,
} = require("../utils/errors");

const chooseLocalOptions = () => {};

const localOptions = {
  usernameField: "email",
  passwordField: "password",
};

const { getModelByTenant } = require("../utils/multitenancy");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
  secretOrKey: constants.JWT_SECRET,
};

const useLocalStrategy = (tenant, req, res, next) =>
  new LocalStrategy(localOptions, async (email, password, done) => {
    try {
      const user = await UserModel(tenant.toLowerCase())
        .findOne({ email })
        .exec();
      if (!user) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: `username or password does not exist in this organisation (${tenant})`,
        });
      } else if (!user.authenticateUser(password)) {
        return res.status(HTTPStatus.BAD_REQUEST).json({
          success: false,
          message: "incorrect username or password",
        });
      }
      return done(null, user);
    } catch (e) {
      logElement("error in services/auth/useLocalStrategy", e.message);
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "Server Error",
        error: e.message,
      });
    }
  });

const useJWTStrategy = (tenant, req, res, next) =>
  new JwtStrategy(jwtOpts, async (payload, done) => {
    try {
      const user = await UserModel(tenant.toLowerCase())
        .findOne({ _id: payload._id })
        .exec();
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (e) {
      logElement("error in services/auth/useJWTStrategy", e.message);
      return done(e, false);
    }
  });

const setLocalStrategy = (tenant, req, res, next) => {
  passport.use("user-local", useLocalStrategy(tenant, req, res, next));
};

const setJWTStrategy = (tenant, req, res, next) => {
  passport.use("jwt", useJWTStrategy(tenant, req, res, next));
};

passport.serializeUser((user, cb) => {
  if (privileges.isUser(user)) {
    cb(null, user._id);
  } else if (privileges.isCollab(user)) {
    cb(null, user._id);
  }
});

passport.deserializeUser((id, cb) => {
  if (privileges.isUser(id)) {
    User.findById(id)
      .then((user) => cb(null, user))
      .catch((err) => cb(err));
  } else if (privileges.isCollab(user)) {
    Collaborator.findById(id)
      .then((user) => cb(null, user))
      .catch((err) => cb(err));
  }
});

function setLocalAuth(req, res, next) {
  try {
    if (req.query.tenant) {
      setLocalStrategy(req.query.tenant, req, res, next);
      next();
    } else {
      res.json({
        success: false,
        message:
          "the organization is missing in the query params, please check documentation",
      });
    }
  } catch (e) {
    console.log("the error in setLocalAuth is: ", e.message);
    res.json({ success: false, message: e.message });
  }
}

function setJWTAuth(req, res, next) {
  try {
    if (req.query.tenant) {
      setJWTStrategy(req.query.tenant, req, res, next);
      next();
    } else {
      res.status(HTTPStatus.BAD_REQUEST).json({
        success: false,
        message:
          "the organization is missing in the query params, please check documentation",
      });
    }
  } catch (e) {
    console.log("the error in setLocalAuth is: ", e.message);
    res
      .status(HTTPStatus.BAD_GATEWAY)
      .json({ success: false, message: e.message });
  }
}

const authLocal = passport.authenticate("user-local", {
  session: false,
  failureFlash: true,
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
    return res.redirect("/setLocalAuth");
  }
};

const requiresSignIn = expressJwt({
  secret: process.env.JWT_SECRET,
  userProperty: "auth",
});

module.exports = {
  setLocalAuth: setLocalAuth,
  authLocal: authLocal,
  authJWT: authJWT,
  setJWTAuth: setJWTAuth,
  authColabLocal: authColabLocal,
  isLoggedIn: isLoggedIn,
  requiresSignIn: requiresSignIn,
};
