const passport = require("passport");
const LocalStrategy = require("passport-local");
const createUserUtil = require("@utils/create-user");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const httpStatus = require("http-status");
const Validator = require("validator");
const UserModel = require("@models/User");
const AccessTokenModel = require("@models/AccessToken");
const constants = require("@config/constants");
const winstonLogger = require("@utils/log-winston");
const { logElement, logText, logObject } = require("@utils/log");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const AuthTokenStrategy = require("passport-auth-token");
const jwt = require("jsonwebtoken");
const accessCodeGenerator = require("generate-password");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- passport-middleware`
);

const setLocalOptions = (req, res, next) => {
  try {
    if (Validator.isEmpty(req.body.userName)) {
      next(
        new HttpError("the userName field is missing", httpStatus.BAD_REQUEST)
      );
      return;
    }

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

    return {
      success: true,
      message: "the auth fields have been set",
      authenticationFields,
    };
  } catch (e) {
    next(new HttpError(e.message, httpStatus.BAD_REQUEST));
    return;
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
  let localOptions = setLocalOptions(req, res, next);
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
          req.auth.status = httpStatus.BAD_REQUEST;
          next(
            new HttpError(
              `username or password does not exist in this organisation (${tenant})`,
              httpStatus.BAD_REQUEST
            )
          );
          return;
        } else if (!user.authenticateUser(password)) {
          req.auth.success = false;
          req.auth.message = "incorrect username or password";
          req.auth.status = httpStatus.BAD_REQUEST;
          next(
            new HttpError(
              "incorrect username or password",
              httpStatus.BAD_REQUEST
            )
          );
          return;
        } else if (user.analyticsVersion === 3 && user.verified === false) {
          const verificationRequest = {
            tenant: "airqo",
            email: user.email,
          };
          try {
            const verificationEmailResponse =
              await createUserUtil.verificationReminder(verificationRequest);
            if (verificationEmailResponse.success === false) {
              logger.error(
                `Internal Server Error --- ${JSON.stringify(
                  verificationEmailResponse
                )}`
              );
            }
          } catch (error) {
            logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
          }
          req.auth.success = false;
          req.auth.message =
            "account not verified, verification email has been sent to your email";
          req.auth.status = httpStatus.FORBIDDEN;
          next(
            new HttpError(
              "account not verified, verification email has been sent to your email",
              httpStatus.FORBIDDEN
            )
          );
          return;
        }
        req.auth.success = true;
        req.auth.message = "successful login";
        req.auth.status = httpStatus.OK;
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
        req.auth.status = httpStatus.INTERNAL_SERVER_ERROR;
        next(new HttpError(e.message, httpStatus.INTERNAL_SERVER_ERROR));
        return;
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
          req.auth.status = httpStatus.BAD_REQUEST;

          next(
            new HttpError(
              `username or password does not exist in this organisation (${tenant})`,
              httpStatus.BAD_REQUEST
            )
          );
          return;
        } else if (!user.authenticateUser(password)) {
          req.auth.success = false;
          req.auth.message = "incorrect username or password";
          req.auth.status = httpStatus.BAD_REQUEST;
          next(
            new HttpError(
              "incorrect username or password",
              httpStatus.BAD_REQUEST
            )
          );
          return;
        } else if (user.analyticsVersion === 3 && user.verified === false) {
          try {
            const verificationEmailResponse =
              await createUserUtil.verificationReminder(verificationRequest);
            if (verificationEmailResponse.success === false) {
              logger.error(
                `Internal Server Error --- ${JSON.stringify(
                  verificationEmailResponse
                )}`
              );
            }
          } catch (error) {
            logger.error(`Internal Server Error --- ${JSON.stringify(error)}`);
          }
          req.auth.success = false;
          req.auth.message =
            "account not verified, verification email has been sent to your email";
          req.auth.status = httpStatus.FORBIDDEN;
          next(
            new HttpError(
              "account not verified, verification email has been sent to your email",
              httpStatus.FORBIDDEN
            )
          );
          return;
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
        req.auth.message = "Internal Server Error";
        req.auth.error = e.message;
        req.auth.status = httpStatus.INTERNAL_SERVER_ERROR;
        next(new HttpError(e.message, httpStatus.INTERNAL_SERVER_ERROR));
        return;
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
            req.auth.status =
              responseFromRegisterUser.status ||
              httpStatus.INTERNAL_SERVER_ERROR;
            cb(responseFromRegisterUser.errors, false);

            next(
              new HttpError(
                "unable to create user",
                responseFromRegisterUser.status ||
                  httpStatus.INTERNAL_SERVER_ERROR
              )
            );
            return;
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

        next(new HttpError(error.message, httpStatus.INTERNAL_SERVER_ERROR));
        return;
      }
    }
  );
const useJWTStrategy = (tenant, req, res, next) =>
  new JwtStrategy(jwtOpts, async (payload, done) => {
    try {
      logObject("req.headers[x-original-uri]", req.headers["x-original-uri"]);
      logObject(
        "req.headers[x-original-method]",
        req.headers["x-original-method"]
      );

      logObject("req.headers['x-host-name']", req.headers["x-host-name"]);
      logObject("req.headers['x-client-ip']", req.headers["x-client-ip"]);
      logObject(
        "req.headers['x-client-original-ip']",
        req.headers["x-client-original-ip"]
      );

      const clientIp = req.headers["x-client-ip"];
      const hostName = req.headers["x-host-name"];
      const endpoint = req.headers["x-original-uri"];
      const clientOriginalIp = req.headers["x-client-original-ip"];

      let service = req.headers["service"];
      let userAction = "Unknown Action";

      const specificRoutes = [
        {
          uri: ["/api/v2/devices/events"],
          service: "events-registry",
          action: "Events API Access via JWT",
        },
        {
          uri: ["/api/v2/devices/measurements"],
          service: "measurements-registry",
          action: "Measurements API Access via JWT",
        },
        {
          uri: ["/api/v1/devices"],
          service: "device-registry",
          action: "deprecated-version-number",
        },
      ];

      specificRoutes.forEach((route) => {
        const uri = req.headers["x-original-uri"];
        if (uri && route.uri.some((routeUri) => uri.includes(routeUri))) {
          service = route.service;
          userAction = route.action;
          return done(null, false);
        }
      });

      const routesWithService = [
        {
          method: "POST",
          uriIncludes: [
            "api/v2/analytics/data-download",
            "api/v1/analytics/data-download",
          ],
          service: "data-export-download",
          action: "Export Data",
        },
        {
          method: "POST",
          uriIncludes: [
            "api/v1/analytics/data-export",
            "api/v2/analytics/data-export",
          ],
          service: "data-export-scheduling",
          action: "Schedule Data Download",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/sites"],
          service: "site-registry",
          action: "Site Creation",
        },
        {
          method: "PUT",
          uriIncludes: ["/api/v2/devices/sites"],
          service: "site-registry",
          action: "Site Update",
        },
        {
          method: "DELETE",
          uriIncludes: ["/api/v2/devices/sites"],
          service: "site-registry",
          action: "Site Deletion",
        },
        {
          method: "DELETE",
          uriIncludes: ["/api/v2/devices?"],
          service: "device-registry",
          action: "Device Deletion",
        },
        {
          method: "DELETE",
          uriIncludes: ["/api/v2/devices/soft?"],
          service: "device-registry",
          action: "Device SOFT Deletion",
        },
        {
          method: "PUT",
          uriIncludes: ["/api/v2/devices?"],
          service: "device-registry",
          action: "Device Update",
        },
        {
          method: "PUT",
          uriIncludes: ["/api/v2/devices/soft?"],
          service: "device-registry",
          action: "Device SOFT Update",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices?"],
          service: "device-registry",
          action: "Device Creation",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/soft?"],
          service: "device-registry",
          action: "Device SOFT Creation",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/airqlouds"],
          service: "airqlouds-registry",
          action: "AirQloud Creation",
        },
        {
          method: "PUT",
          uriIncludes: ["/api/v2/devices/airqlouds"],
          service: "airqlouds-registry",
          action: "AirQloud Update",
        },
        {
          method: "DELETE",
          uriIncludes: ["/api/v2/devices/airqlouds"],
          service: "airqlouds-registry",
          action: "AirQloud Deletion",
        },

        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/activities/maintain"],
          service: "device-maintenance",
          action: "Maintain Device",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/activities/recall"],
          service: "device-recall",
          action: "Recall Device",
        },
        {
          method: "POST",
          uriIncludes: ["/api/v2/devices/activities/deploy"],
          service: "device-deployment",
          action: "Deploy Device",
        },

        {
          method: "POST",
          uriIncludes: ["api/v2/users", "api/v1/users"],
          service: "auth",
          action: "Create User",
        },
        {
          method: "PUT",
          uriIncludes: ["api/v2/users", "api/v1/users"],
          service: "auth",
          action: "Update User",
        },
        {
          method: "DELETE",
          uriIncludes: ["api/v2/users", "api/v1/users"],
          service: "auth",
          action: "Delete User",
        },

        {
          method: "POST",
          uriIncludes: [
            "api/v1/incentives/transactions/accounts/payments",
            "api/v2/incentives/transactions/accounts/payments",
          ],
          service: "incentives",
          action: "Add Money to Organizational Account",
        },
        {
          method: "POST",
          uriIncludes: [
            "api/v1/incentives/transactions/hosts",
            "api/v2/incentives/transactions/hosts",
          ],
          service: "incentives",
          action: "Send Money to Host",
        },

        {
          method: "POST",
          uriIncludes: ["/api/v1/calibrate", "/api/v2/calibrate"],
          service: "calibrate",
          action: "calibrate device",
        },

        {
          method: "POST",
          uriIncludes: ["/api/v1/locate", "/api/v2/locate"],
          service: "locate",
          action: "Identify Suitable Device Locations",
        },

        {
          method: "POST",
          uriIncludes: ["/api/v1/predict-faults", "/api/v2/predict-faults"],
          service: "fault-detection",
          action: "Detect Faults",
        },
      ];

      routesWithService.forEach((route) => {
        const uri = req.headers["x-original-uri"];
        const method = req.headers["x-original-method"];

        if (
          method &&
          route.method === method &&
          uri &&
          (!route.uriEndsWith ||
            route.uriEndsWith.some((suffix) => uri.endsWith(suffix))) &&
          (!route.uriIncludes ||
            route.uriIncludes.some((substring) => uri.includes(substring)))
        ) {
          service = route.service;
          userAction = route.action;
        }
      });

      // ... other route checks
      logObject("Service", service);
      const user = await UserModel(tenant.toLowerCase())
        .findOne({ _id: payload._id })
        .exec();

      if (!user) {
        return done(null, false);
      }

      const currentDate = new Date();

      await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
        user._id,
        {
          lastLogin: currentDate,
          isActive: true,
          ...(user.analyticsVersion !== 3 && user.verified === false
            ? { $set: { verified: true } }
            : {}),
        },
        { new: true }
      );

      winstonLogger.info(userAction, {
        username: user.userName,
        email: user.email,
        service: service ? service : "unknown",
        clientIp: clientIp ? clientIp : "unknown",
        hostName: hostName ? hostName : "unknown",
        endpoint: endpoint ? endpoint : "unknown",
        clientOriginalIp: clientOriginalIp ? clientOriginalIp : "unknown",
      });

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
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }
    setLocalStrategy("airqo", req, res, next);
    next();
  } catch (e) {
    logger.error(`the error in setLocalAuth is: ${e.message}`);
    logObject("the error in setLocalAuth is", e);
  }
}
function setGoogleAuth(req, res, next) {
  try {
    logText("we are setting the Google Auth");
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setGoogleStrategy(tenant, req, res, next);
    next();
  } catch (e) {
    logObject("e", e);
    logger.error(`the error in setLocalAuth is: ${e.message}`);
    logObject("the error in setLocalAuth is", e);
  }
}
function setJWTAuth(req, res, next) {
  try {
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(
        new HttpError(
          "bad request errors",
          httpStatus.INTERNAL_SERVER_ERROR,
          errors
        )
      );
      return;
    }
    setJWTStrategy("airqo", req, res, next);
    next();
  } catch (e) {
    logger.error(`the error in setLocalAuth is: ${e.message}`);
    logObject("the error in setLocalAuth is", e);
    next(new HttpError(e.message, httpStatus.INTERNAL_SERVER_ERROR));
    return;
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
