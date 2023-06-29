const passport = require("passport");
const FirebaseStrategy = require("passport-firebase-auth").Strategy;
const LocalStrategy = require("passport-local");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const httpStatus = require("http-status");
const Validator = require("validator");
const UserSchema = require("@models/User");
const AccessTokenSchema = require("@models/AccessToken");
const constants = require("@config/constants");
const { logElement, logText, logObject, winstonLogger } = require("@utils/log");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const AuthTokenStrategy = require("passport-auth-token");
const jwt = require("jsonwebtoken");
const accessCodeGenerator = require("generate-password");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;

const { getModelByTenant } = require("@config/dbConnection");

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
 * configuring the different strategies
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
        logObject("Service", service);
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
        // logger.info(`successful login`, {
        //   username: user.userName,
        //   email: user.email,
        // });
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
        // logger.info(`successful login`, {
        //   username: user.userName,
        //   email: user.email,
        // });
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
        // let user = result.toJSON();
        req.auth = {};
        if (user) {
          // logObject("the user", user);
          /**
           * we shall also have to update this User from here
           */
          const filter = {
            _id: ObjectId(user._id),
          };
          const update = {
            google_id: profile._json.sub,
            firstName: profile._json.given_name,
            lastName: profile._json.family_name,
            email: profile._json.email,
            userName: profile._json.email,
            profilePicture: profile._json.picture,
            website: profile._json.hd,
          };
          const responseFromUpdateUser = await UserModel(tenant).modify({
            filter,
            update,
          });
          if (responseFromUpdateUser.success === false) {
            const error = responseFromUpdateUser.errors
              ? responseFromUpdateUser.errors
              : {};
            cb(error, user);
            return next();
          } else if (responseFromUpdateUser.success === true) {
            req.auth.success = true;
            req.auth.message = "successful login";
            winstonLogger.info(
              `successful login through ${
                service ? service : "unknown"
              } service`,
              {
                username: user.userName,
                email: user.email,
                service: service ? service : "none",
              }
            );
            cb(null, user);
            return next();
            // return cb(null, user);
          }
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
            /**
             * we might want to send an email at this point in time
             * with the user details...just a simple welcome email
             */
            logObject("the newly created user", responseFromRegisterUser.data);
            const user = responseFromRegisterUser.data;
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
      const service = req.headers["service"];
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

const useFirebaseStrategy = (tenant) => {
  logObject("FIREBASE_PROJECT_ID", constants.FIREBASE_PROJECT_ID);
  return new FirebaseStrategy(
    {
      apiKey: constants.FIREBASE_API_KEY,
      authDomain: constants.FIREBASE_AUTH_DOMAIN,
      authorizationURL: constants.FIREBASE_AUTHORIZATION_URL,
      projectId: constants.FIREBASE_PROJECT_ID,
    },
    async (accessToken, refreshToken, decodedToken, user, done) => {
      try {
        // Check if the user exists in your local system
        const localUser = await UserModel(tenant)
          .findOne({
            email: user.email,
          })
          .exec();

        if (localUser) {
          const update = {
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            profilePicture: user.photoURL,
            firebaseId: user.uid,
            verified: user.emailVerified,
            phoneNumber: user.phoneNumber,
          };

          const filter = {
            _id: ObjectId(user._id),
          };

          const responseFromUpdateUser = await UserModel(tenant).modify({
            filter,
            update,
          });

          if (responseFromUpdateUser.success === false) {
            const error = responseFromUpdateUser.errors
              ? responseFromUpdateUser.errors
              : {};
            done(error, user);
            return next();
          } else if (responseFromUpdateUser.success === true) {
            req.auth.success = true;
            req.auth.message = "successful login";
            winstonLogger.info(
              `successful login through ${
                service ? service : "unknown"
              } service`,
              {
                username: user.userName,
                email: user.email,
                service: service ? service : "none",
              }
            );
            done(null, user);
            return next();
            // return cb(null, user);
          }
        } else {
          const responseFromRegisterUser = await UserModel(tenant).register({
            firstName: user.firstName,
            lastName: user.lastName,
            phoneNumber: user.phoneNumber,
            profilePicture: user.photoURL,
            firebaseId: user.uid,
            verified: user.emailVerified,
            phoneNumber: user.phoneNumber,
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
            done(null, user);
            return next();
          }
        }
      } catch (error) {
        // Handle database or other errors
        return done(error);
      }
    }
  );
};

/**
 * calling the different strategy configurations
 * @param {*} tenant
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */

const setFirebaseStrategy = (tenant, req, res, next) => {
  const strategy = useFirebaseStrategy(tenant);
  passport.use(strategy);
  // passport.use(useFirebaseStrategy(tenant, req, res, next));
};

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

function setFirebaseAuth(req, res, next) {
  try {
    logText("setFirebaseAuth........");
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
    setFirebaseStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    logObject("e", e);
    console.log("the error in setLocalAuth is: ", e.message);
    res.json({
      success: false,
      message: e.message,
      errors: { message: e.message },
    });
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
 * defining the authentication middleware
 */
const authLocal = passport.authenticate("user-local", {
  session: false,
  failureFlash: true,
});
const authGoogle = passport.authenticate("google", {
  scope: ["profile", "email"],
});
const authFirebase = (req, res, next) => {
  passport.authenticate("firebase", { session: false }, (error, user) => {
    if (error) {
      // Handle authentication error
      return res.status(httpStatus.UNAUTHORIZED).json({
        success: false,
        message: "Authentication failed",
        errors: { message: "Authentication failed" },
      });
    }

    if (!user) {
      // User does not exist in Firebase
      return res.status(httpStatus.NOT_FOUND).json({
        success: false,
        message: "User does not exist",
        errors: { message: "User does not exist" },
      });
    }
    logObject("the req", req);
    // Store the Firebase user details temporarily on the request object
    req.firebaseUser = user;

    // Proceed to the next middleware
    next();
  });
};
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
  setFirebaseAuth,
  setGuestToken,
  authLocal,
  authJWT,
  authGoogle,
  authFirebase,
  authGoogleCallback,
  authGuest,
};
