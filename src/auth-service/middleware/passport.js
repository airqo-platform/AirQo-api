const passport = require("passport");
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const httpStatus = require("http-status");
const Validator = require("validator");
const UserSchema = require("@models/User");
const AccessTokenSchema = require("@models/AccessToken");
const constants = require("@config/constants");
const winstonLogger = require("@utils/log-winston");
const { logElement, logText, logObject } = require("@utils/log");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const AuthTokenStrategy = require("passport-auth-token");
const jwt = require("jsonwebtoken");
const accessCodeGenerator = require("generate-password");

const { getModelByTenant } = require("@config/database");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const AccessTokenModel = (tenant) => {
  return getModelByTenant(tenant, "token", AccessTokenSchema);
};

const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- auth-service`);

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

/**
 * using the strategies
 * @param {*} tenant
 * @param {*} req
 * @param {*} res
 * @param {*} next
 * @returns
 */
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
  } else if (localOptions.success === false) {
    logText("success state is false");
    return localOptions;
  }
};
const useEmailWithLocalStrategy = (tenant, req, res, next) =>
  new LocalStrategy(
    authenticateWithEmailOptions,
    async (email, password, done) => {
      try {
        const service = req.headers["service"];
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
        winstonLogger.info(
          `successful login through ${service ? service : "unknown"} service`,
          {
            username: user.userName,
            email: user.email,
            service: service ? service : "none",
          }
        );

        return done(null, user);
      } catch (e) {
        req.auth = {};
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
        const service = req.headers["service"];
        logObject("Service", service);
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

        winstonLogger.info(
          `successful login through ${service ? service : "unknown"} service`,
          {
            username: user.userName,
            email: user.email,
            service: service ? service : "none",
          }
        );
        return done(null, user);
      } catch (e) {
        req.auth = {};
        req.auth.success = false;
        req.auth.message = "Server Error";
        req.auth.error = e.message;
        next();
      }
    }
  );
const useGoogleStrategy = (tenant, req, res, next) =>
  new GoogleStrategy(
    {
      clientID: constants.GOOGLE_CLIENT_ID,
      clientSecret: constants.GOOGLE_CLIENT_SECRET,
      callbackURL: `${constants.PLATFORM_BASE_URL}/api/v1/users/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, cb) => {
      logObject("Google profile Object", profile._json);

      try {
        const service = req.headers["service"];
        let user = await UserModel(tenant.toLowerCase())
          .findOne({
            email: profile._json.email,
          })
          .exec();

        req.auth = {};
        if (user) {
          req.auth.success = true;
          req.auth.message = "successful login";

          winstonLogger.info(
            `successful login through ${service ? service : "unknown"} service`,
            {
              username: user.userName,
              email: user.email,
              service: service ? service : "none",
            }
          );
          cb(null, user);
          return next();
        } else {
          const responseFromRegisterUser = await UserModel(tenant).register({
            google_id: profile._json.sub,
            firstName: profile._json.given_name,
            lastName: profile._json.family_name,
            email: profile._json.email,
            userName: profile._json.email,
            profilePicture: profile._json.picture,
            website: profile._json.hd,
            password: accessCodeGenerator.generate(
              constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
            ),
          });
          if (responseFromRegisterUser.success === false) {
            req.auth.success = false;
            req.auth.message = "unable to create user";
            cb(responseFromRegisterUser.errors, false);
            next();
          } else {
            logObject("the newly created user", responseFromRegisterUser.data);
            user = responseFromRegisterUser.data;
            cb(null, user);

            return next();
          }
        }
      } catch (error) {
        logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
        logObject("error", error);
        req.auth = {};
        req.auth.success = false;
        req.auth.message = "Server Error";
        req.auth.error = error.message;
        next();
      }
    }
  );
const useJWTStrategy = (tenant, req, res, next) =>
  new JwtStrategy(jwtOpts, async (payload, done) => {
    try {
      logObject("the baseURL accessing API", req.headers["x-original-uri"]);
      logObject("the req object accessing our system using JWTs", req);
      logObject("req.headers", req.headers);
      logObject("req.headers[x-original-uri]", req.headers["x-original-uri"]);
      logObject(
        "req.headers[x-original-method]",
        req.headers["x-original-method"]
      );

      let service = req.headers["service"];

      if (
        req.headers["x-original-uri"].includes("/api/v2/devices/events") ||
        req.headers["x-original-uri"].includes("/api/v1/devices/events")
      ) {
        service = "api";
        return done(null, false);
        /**
         * NEXT VERSION:
         * We shall crosscheck the CLIENT_SECRET, CLIENT_ID and TOKEN_ID
         * of the user if they ALL exist and are valid.
         * We shall be using the Client's connection
         */
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith("/api/v2/devices/sites") ||
          req.headers["x-original-uri"].endsWith("/api/v1/devices/sites"))
      ) {
        service = "site-registry";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith("/api/v2/devices") ||
          req.headers["x-original-uri"].endsWith("/api/v1/devices") ||
          req.headers["x-original-uri"].endsWith("/api/v1/devices/soft") ||
          req.headers["x-original-uri"].endsWith("/api/v2/devices/soft"))
      ) {
        service = "device-registry";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith("/api/v2/devices/airqlouds") ||
          req.headers["x-original-uri"].endsWith("/api/v1/devices/airqlouds"))
      ) {
        service = "airqlouds-registry";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith(
          "/api/v2/devices/activities/maintain"
        ) ||
          req.headers["x-original-uri"].endsWith(
            "/api/v1/devices/activities/maintain"
          ))
      ) {
        service = "device-maintenance";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith(
          "/api/v2/devices/activities/deploy"
        ) ||
          req.headers["x-original-uri"].endsWith(
            "/api/v1/devices/activities/deploy"
          ))
      ) {
        service = "device-deployment";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith(
          "/api/v2/devices/activities/recall"
        ) ||
          req.headers["x-original-uri"].endsWith(
            "/api/v1/devices/activities/recall"
          ))
      ) {
        service = "device-recall";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].endsWith("/api/v2/users") ||
          req.headers["x-original-uri"].endsWith("/api/v1/users"))
      ) {
        service = "auth";
      }
      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].includes("/api/v2/incentives") ||
          req.headers["x-original-uri"].includes("/api/v1/incentives"))
      ) {
        service = "incentives";
      }
      if (
        req.headers["x-original-uri"].includes("/api/v2/calibrate") ||
        req.headers["x-original-uri"].includes("/api/v1/calibrate")
      ) {
        service = "calibrate";
      }

      if (
        req.headers["x-original-uri"].includes("/api/v2/locate") ||
        req.headers["x-original-uri"].includes("/api/v1/locate")
      ) {
        service = "locate";
      }

      if (
        req.headers["x-original-uri"].includes("/api/v2/predict-faults") ||
        req.headers["x-original-uri"].includes("/api/v1/predict-faults")
      ) {
        service = "fault-detection";
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].includes(
          "/api/v2/analytics/data/download"
        ) ||
          req.headers["x-original-uri"].includes(
            "/api/v1/analytics/data/download"
          ))
      ) {
        service = "data-export-download";
        return done(null, false);
      }

      if (
        (req.headers["x-original-method"] === "POST" ||
          req.headers["x-original-method"] === "PUT" ||
          req.headers["x-original-method"] === "DELETE") &&
        (req.headers["x-original-uri"].includes(
          "/api/v2/analytics/data-export"
        ) ||
          req.headers["x-original-uri"].includes(
            "/api/v1/analytics/data-export"
          ))
      ) {
        service = "data-export-scheduling";
        return done(null, false);
      }

      logObject("Service", service);
      const user = await UserModel(tenant.toLowerCase())
        .findOne({ _id: payload._id })
        .exec();
      if (!user) {
        return done(null, false);
      }

      winstonLogger.info(
        `successful login through ${service ? service : "unknown"} service`,
        {
          username: user.userName,
          email: user.email,
          service: service ? service : "unknown",
        }
      );
      return done(null, user);
    } catch (e) {
      logger.error(`Internal Server Error -- ${JSON.stringify(e)}`);
      return done(e, false);
    }
  });
const useAuthTokenStrategy = (tenant, req, res, next) =>
  new AuthTokenStrategy(async function (token, done) {
    const service = req.headers["service"];
    logObject("Service", service);
    await AccessTokenModel(tenant.toLowerCase()).findOne(
      {
        id: token,
      },
      function (error, accessToken) {
        if (error) {
          return done(error);
        }

        if (accessToken) {
          if (!token.isValid(accessToken)) {
            return done(null, false);
          }

          UserModel(tenant.toLowerCase()).findOne(
            {
              id: accessToken.user_id,
            },
            function (error, user) {
              if (error) {
                return done(error);
              }

              if (!user) {
                return done(null, false);
              }
              winstonLogger.info(
                `successful login through ${
                  service ? service : "unknown"
                } service`,
                {
                  username: user.userName,
                  email: user.email,
                  service: service ? service : "unknown",
                }
              );
              return done(null, user);
            }
          );
        } else {
          return done(null);
        }
      }
    );
  });

/**
 * setting the strategies
 * @param {*} tenant
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
const setLocalStrategy = (tenant, req, res, next) => {
  passport.use("user-local", useLocalStrategy(tenant, req, res, next));
};

const setGoogleStrategy = (tenant, req, res, next) => {
  passport.use(useGoogleStrategy(tenant, req, res, next));
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser(async (user, done) => {
    await UserModel(tenant.toLowerCase())
      .findById(id)
      .then((user) => {
        done(null, user);
      });
  });
};

const setJWTStrategy = (tenant, req, res, next) => {
  passport.use("jwt", useJWTStrategy(tenant, req, res, next));
};

const setAuthTokenStrategy = (tenant, req, res, next) => {
  passport.use("authtoken", useAuthTokenStrategy(tenant, req, res, next));
};

function setLocalAuth(req, res, next) {
  try {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setLocalStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    console.log("the error in setLocalAuth is: ", e.message);
    res.json({ success: false, message: e.message });
  }
}

function setGoogleAuth(req, res, next) {
  try {
    /**
     * do input validations and then just call the set
     * set local strategy afterwards -- the function is called from here
     */

    logText("we are setting the Google Auth");
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setGoogleStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    logObject("e", e);
    console.log("the error in setLocalAuth is: ", e.message);
    res.json({ success: false, message: e.message });
  }
}
function setJWTAuth(req, res, next) {
  try {
    const hasErrors = !validationResult(req).isEmpty();
    if (hasErrors) {
      let nestedErrors = validationResult(req).errors[0].nestedErrors;
      return badRequest(
        res,
        "bad request errors",
        convertErrorArrayToObject(nestedErrors)
      );
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    logElement("the tenant for the job", tenant);
    setJWTStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    console.log("the error in setLocalAuth is: ", e.message);
    res
      .status(httpStatus.BAD_GATEWAY)
      .json({ success: false, message: e.message });
  }
}
const setGuestToken = (req, res) => {
  const guest = { guest: true, role: "guest" };
  const token = jwt.sign(guest, constants.JWT_SECRET);
  res.json({ token });
};

/**
 * utilising the strategies after setting them in the routes
 */
const authLocal = passport.authenticate("user-local", {
  session: false,
  failureFlash: true,
});

const authGoogle = passport.authenticate("google", {
  scope: ["profile", "email"],
});

const authGoogleCallback = passport.authenticate("google", {
  failureRedirect: `${constants.GMAIL_VERIFICATION_FAILURE_REDIRECT}`,
});

const authGuest = (req, res, next) => {
  try {
    const user = jwt.verify(req.headers.authorization, constants.JWT_SECRET);
    if (user.role === "guest" || user.role === "authenticated") {
      req.user = user;
      return next();
    } else {
      return res.status(401).json({ message: "Unauthorized" });
    }
  } catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};

const authJWT = passport.authenticate("jwt", {
  session: false,
});

module.exports = {
  setLocalAuth,
  setJWTAuth,
  setGoogleAuth,
  setGuestToken,
  authLocal,
  authJWT,
  authGoogle,
  authGoogleCallback,
  authGuest,
};
