const passport = require("passport");
const LocalStrategy = require("passport-local");
const LocalAPIKeyStrategy = require("passport-localapikey");
const HTTPStatus = require("http-status");
const Validator = require("validator");
const UserSchema = require("../models/User");
const constants = require("../config/constants");
const { logElement, logText, logObject } = require("../utils/log");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const { getModelByTenant } = require("../utils/multitenancy");
const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};
const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const { badRequest } = require("../utils/errors");

const setLocalOptions = (req) => {
  try {
    let authenticationFields = {};
    if (
      !Validator.isEmpty(req.body.userName) &&
      Validator.isEmail(req.body.userName)
    ) {
      authenticationFields.usernameField = "email";
      authenticationFields.passwordField = "password";
    }

    if (
      !Validator.isEmpty(req.body.userName) &&
      !Validator.isEmail(req.body.userName)
    ) {
      authenticationFields.usernameField = "userName";
      authenticationFields.passwordField = "password";
    }

    if (Validator.isEmpty(req.body.userName)) {
      return {
        success: false,
        message: "the userName field is missing",
      };
    }

    return {
      success: true,
      message: "the auth fields have been set",
      authenticationFields,
    };
  } catch (e) {
    return {
      success: false,
      message: e.message,
    };
  }
};

const authenticateWithEmailOptions = {
  usernameField: "email",
  passwordField: "password",
};

const authenticateWithUsernameOptions = {
  usernameField: "userName",
  passwordField: "password",
};

const jwtOpts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme("jwt"),
  secretOrKey: constants.JWT_SECRET,
};

const useLocalStrategy = (tenant, req, res, next) => {
  let localOptions = setLocalOptions(req);
  logObject("the localOptions", localOptions);
  if (localOptions.success === true) {
    logText("success state is true");
    let { usernameField } = localOptions.authenticationFields;
    logElement("the username field", usernameField);
    if (usernameField === "email") {
      req.body.email = req.body.userName;
      logText("we are using email");
      return useEmailWithLocalStrategy(tenant, req, res, next);
    } else if (usernameField === "userName") {
      logText("we are using username");
      return useUsernameWithLocalStrategy(tenant, req, res, next);
    }
  } else if (localOptions.success == false) {
    logText("success state is false");
    return localOptions;
  }
};
const useEmailWithLocalStrategy = (tenant, req, res, next) =>
  new LocalStrategy(
    authenticateWithEmailOptions,
    async (email, password, done) => {
      try {
        const user = await UserModel(tenant.toLowerCase())
          .findOne({ email })
          .exec();
        req.auth = {};
        if (!user) {
          req.auth.success = false;
          req.auth.message = `username or password does not exist in this organisation (${tenant})`;
          next();
        } else if (!user.authenticateUser(password)) {
          req.auth.success = false;
          req.auth.message = "incorrect username or password";
          next();
        }
        req.auth.success = true;
        req.auth.message = "successful login";
        return done(null, user);
      } catch (e) {
        req.auth.success = false;
        req.auth.message = "Server Error";
        req.auth.error = e.message;
        next();
      }
    }
  );

const useUsernameWithLocalStrategy = (tenant, req, res, next) =>
  new LocalStrategy(
    authenticateWithUsernameOptions,
    async (userName, password, done) => {
      try {
        const user = await UserModel(tenant.toLowerCase())
          .findOne({ userName })
          .exec();
        req.auth = {};
        if (!user) {
          req.auth.success = false;
          req.auth.message = `username or password does not exist in this organisation (${tenant})`;
          next();
        } else if (!user.authenticateUser(password)) {
          req.auth.success = false;
          req.auth.message = "incorrect username or password";
          next();
        }
        req.auth.success = true;
        req.auth.message = "successful login";
        return done(null, user);
      } catch (e) {
        req.auth.success = false;
        req.auth.message = "Server Error";
        req.auth.error = e.message;
        next();
      }
    }
  );

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

const useLocalAPIKeyStrategy = (tenant, req, res, next) => {
  new LocalAPIKeyStrategy(async (api_key, done) => {
    try {
      const apiKey = api_key;
      const user = await UserModel(tenant.toLowerCase())
        .findOne({ apiKey: apiKey })
        .exec();
      logObject("user", user);
      if (err) {
        return done(err);
      }
      if (!user) {
        return done(null, false);
      }
      return done(null, user);
    } catch (error) {
      logObject("error", error);
      logElement(
        "error for the local API key strategy instantiation",
        error.message
      );
      return done(error, false);
    }
  });
};

/***** setting strategies ***************************/
const setLocalStrategy = (tenant, req, res, next) => {
  passport.use("user-local", useLocalStrategy(tenant, req, res, next));
};
function setLocalAuth(req, res, next) {
  try {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setLocalStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    res.json({ success: false, message: e.message });
  }
}

const setJWTStrategy = (tenant, req, res, next) => {
  passport.use("jwt", useJWTStrategy(tenant, req, res, next));
};
function setJWTAuth(req, res, next) {
  try {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setJWTStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    res
      .status(HTTPStatus.BAD_GATEWAY)
      .json({ success: false, message: e.message });
  }
}

const setLocalAPIKeyStrategy = (tenant, req, res, next) => {
  passport.use("localapikey", useLocalAPIKeyStrategy(tenant, req, res, next));
};
function setLocalAPIKey(req, res, next) {
  try {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setLocalAPIKeyStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    logObject("error", e);
    res.json({ success: false, message: e.message });
  }
}

/** authenticating requests **********************/
const authLocal = passport.authenticate("user-local", {
  session: false,
  failureFlash: true,
});
const authJWT = passport.authenticate("jwt", {
  session: false,
});
const authAPIKey = passport.authenticate("localapikey", { session: false });

module.exports = {
  setLocalAuth: setLocalAuth,
  setJWTAuth: setJWTAuth,
  setLocalAPIKey: setLocalAPIKey,
  authLocal: authLocal,
  authJWT: authJWT,
  authAPIKey: authAPIKey,
};
