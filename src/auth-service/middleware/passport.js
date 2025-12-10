const passport = require("passport");
const LocalStrategy = require("passport-local");
const userUtil = require("@utils/user.util");
const { AbstractTokenFactory } = require("@services/atf.service");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const httpStatus = require("http-status");
const Validator = require("validator");
const UserModel = require("@models/User");
const AccessTokenModel = require("@models/AccessToken");
const constants = require("@config/constants");
const PermissionModel = require("@models/Permission");
const { mailer, stringify, winstonLogger } = require("@utils/common");
const { Strategy: JwtStrategy, ExtractJwt } = require("passport-jwt");
const AuthTokenStrategy = require("passport-auth-token");
const jwt = require("jsonwebtoken");
const accessCodeGenerator = require("generate-password");
const analyticsService = require("@services/analytics.service");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- passport-middleware`
);

// --- Token Lifecycle Configuration ---
const TOKEN_LIFE_SECONDS = constants.JWT_EXPIRES_IN_SECONDS;
const REFRESH_WINDOW_SECONDS = constants.JWT_REFRESH_WINDOW_SECONDS;
const GRACE_PERIOD_SECONDS = constants.JWT_GRACE_PERIOD_SECONDS;

const setLocalOptions = (req, res, next) => {
  try {
    const rawUserName = req.body && req.body.userName;
    const userName =
      typeof rawUserName === "string" ? rawUserName.trim() : rawUserName;
    if (typeof userName === "string") {
      // normalize for downstream consumers
      req.body.userName = userName;
    }

    // The validator library expects a string.
    // We check for existence first, then validate.
    if (
      !userName ||
      typeof userName !== "string" ||
      Validator.isEmpty(userName)
    ) {
      throw new HttpError(
        "the userName field is missing or empty",
        httpStatus.BAD_REQUEST
      );
    }

    const authenticationFields = {};
    // Use the trimmed value for validation
    if (Validator.isEmail(userName)) {
      authenticationFields.usernameField = "email";
      authenticationFields.passwordField = "password";
    } else {
      authenticationFields.usernameField = "userName";
      authenticationFields.passwordField = "password";
    }

    return {
      success: true,
      message: "all the auth fields have been set",
      authenticationFields,
    };
  } catch (error) {
    // Handle errors appropriately, including HttpErrors
    if (error instanceof HttpError) {
      return next(error);
    }
    logger.error(`Error in setLocalOptions: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
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
  try {
    const localOptions = setLocalOptions(req, res, next);
    logObject("the localOptions", localOptions);

    // If setLocalOptions calls next(error), it returns undefined.
    // The error is already passed to the express error handler, so we just stop.
    if (!localOptions) {
      return;
    }

    if (localOptions.success === true) {
      logText("success state is true");
      const { usernameField } = localOptions.authenticationFields;
      logElement("the username field", usernameField);
      if (usernameField === "email") {
        req.body.email = String(req.body.userName).trim();
        logText("we are using email");
        return useEmailWithLocalStrategy(tenant, req, res, next);
      } else if (usernameField === "userName") {
        logText("we are using username");
        req.body.userName = String(req.body.userName).trim();
        return useUsernameWithLocalStrategy(tenant, req, res, next);
      }
    }
  } catch (error) {
    logger.error(`Critical error in useLocalStrategy: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
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
        }

        // Centralized verification check
        const verificationResult = userUtil._handleVerification(user);
        if (!verificationResult.shouldProceed) {
          try {
            if (verificationResult.requiresV3Reminder) {
              await userUtil.verificationReminder(
                { tenant: tenant.toLowerCase(), email: user.email },
                next
              );
            } else if (verificationResult.requiresV4Reminder) {
              await userUtil.mobileVerificationReminder(
                { tenant: tenant.toLowerCase(), email: user.email },
                next
              );
            }
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error --- ${stringify(error)}`);
          }
          next(new HttpError(verificationResult.message, httpStatus.FORBIDDEN));
          return;
        }
        req.auth.success = true;
        req.auth.message = "successful login";
        req.auth.status = httpStatus.OK;

        if (user && user.email !== user.email.toLowerCase()) {
          try {
            const conflictUser = await UserModel(tenant.toLowerCase()).findOne({
              email: user.email.toLowerCase(),
              _id: { $ne: user._id },
            });

            if (!conflictUser) {
              // Safe to migrate this user's email
              await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
                user._id,
                { email: user.email.toLowerCase() },
                { new: true }
              );
            }
          } catch (error) {
            logger.warn(
              `Could not migrate email case for user ${user._id}: ${error.message}`
            );
          }
        }

        // Fire-and-forget permission update
        (async () => {
          try {
            const DEFAULT_PERMISSIONS = constants.DEFAULTS.DEFAULT_USER;
            const existingPermissions = await PermissionModel(
              tenant.toLowerCase()
            )
              .find({ permission: { $in: DEFAULT_PERMISSIONS } })
              .select("_id")
              .lean();

            if (existingPermissions.length > 0) {
              const permissionIds = existingPermissions.map((p) => p._id);
              await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
                user._id,
                {
                  $addToSet: { permissions: { $each: permissionIds } },
                }
              );
            }
          } catch (permError) {
            logger.error(
              `Error updating default permissions for user ${user.email}: ${permError.message}`
            );
          }
        })();

        try {
          // Decide if auto-verification should happen.
          const shouldAutoVerify =
            verificationResult.shouldProceed &&
            user.verified !== true &&
            user.analyticsVersion !== 3 &&
            user.analyticsVersion !== 4;

          const updatePayload = userUtil._constructLoginUpdate(user, null, {
            autoVerify: shouldAutoVerify,
          });
          await UserModel(tenant.toLowerCase())
            .findOneAndUpdate({ _id: user._id }, updatePayload, {
              new: true,
              upsert: false,
              runValidators: true,
            })
            .then(() => {})
            .catch((error) => {
              logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
            });
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
        }
        // Ensure user's default role is correctly assigned before proceeding
        await userUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());
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
        }

        // Centralized verification check
        const verificationResult = userUtil._handleVerification(user);
        if (!verificationResult.shouldProceed) {
          try {
            if (verificationResult.requiresV3Reminder) {
              await userUtil.verificationReminder(
                { tenant: tenant.toLowerCase(), email: user.email },
                next
              );
            } else if (verificationResult.requiresV4Reminder) {
              await userUtil.mobileVerificationReminder(
                { tenant: tenant.toLowerCase(), email: user.email },
                next
              );
            }
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error --- ${stringify(error)}`);
          }
          next(new HttpError(verificationResult.message, httpStatus.FORBIDDEN));
          return;
        }
        req.auth.success = true;
        req.auth.message = "successful login";

        if (user && user.email !== user.email.toLowerCase()) {
          try {
            const conflictUser = await UserModel(tenant.toLowerCase()).findOne({
              email: user.email.toLowerCase(),
              _id: { $ne: user._id },
            });

            if (!conflictUser) {
              // Safe to migrate this user's email
              await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
                user._id,
                { email: user.email.toLowerCase() },
                { new: true }
              );
            }
          } catch (error) {
            logger.warn(
              `Could not migrate email case for user ${user._id}: ${error.message}`
            );
          }
        }

        // Fire-and-forget permission update
        (async () => {
          try {
            const DEFAULT_PERMISSIONS = constants.DEFAULTS.DEFAULT_USER;
            const existingPermissions = await PermissionModel(
              tenant.toLowerCase()
            )
              .find({ permission: { $in: DEFAULT_PERMISSIONS } })
              .select("_id")
              .lean();

            if (existingPermissions.length > 0) {
              const permissionIds = existingPermissions.map((p) => p._id);
              await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
                user._id,
                {
                  $addToSet: { permissions: { $each: permissionIds } },
                }
              );
            }
          } catch (permError) {
            logger.error(
              `Error updating default permissions for user ${user.email}: ${permError.message}`
            );
          }
        })();

        try {
          // Decide if auto-verification should happen.
          const shouldAutoVerify =
            verificationResult.shouldProceed &&
            user.verified !== true &&
            user.analyticsVersion !== 3 &&
            user.analyticsVersion !== 4;

          const updatePayload = userUtil._constructLoginUpdate(user, null, {
            autoVerify: shouldAutoVerify,
          });
          await UserModel(tenant.toLowerCase())
            .findOneAndUpdate({ _id: user._id }, updatePayload, {
              new: true,
              upsert: false,
              runValidators: true,
            })
            .then(() => {})
            .catch((error) => {
              logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
            });
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
        }

        // Ensure user's default role is correctly assigned before proceeding
        await userUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());

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
      callbackURL: `${constants.PLATFORM_BASE_URL}/api/v2/users/auth/google/callback`,
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

          try {
            analyticsService.track(user._id.toString(), "user_logged_in", {
              method: "google",
            });
          } catch (analyticsError) {
            logger.error(
              `PostHog Google login track error: ${analyticsError.message}`
            );
          }

          if (user && user.email !== user.email.toLowerCase()) {
            try {
              const conflictUser = await UserModel(
                tenant.toLowerCase()
              ).findOne({
                email: user.email.toLowerCase(),
                _id: { $ne: user._id },
              });

              if (!conflictUser) {
                // Safe to migrate this user's email
                await UserModel(tenant.toLowerCase()).findByIdAndUpdate(
                  user._id,
                  { email: user.email.toLowerCase() },
                  { new: true }
                );
              }
            } catch (error) {
              logger.warn(
                `Could not migrate email case for user ${user._id}: ${error.message}`
              );
            }
          }

          // Role check and fix
          await userUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());

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
          // profilePicture: profile._json.picture,
          const responseFromRegisterUser = await UserModel(tenant).register(
            {
              google_id: profile._json.sub,
              firstName: profile._json.given_name,
              lastName: profile._json.family_name,
              email: profile._json.email,
              userName: profile._json.email,
              website: profile._json.hd,
              password: accessCodeGenerator.generate(
                constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
              ),
            },
            next
          );
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

            try {
              const userId = user._id.toString();
              const userProperties = {
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                createdAt: user.createdAt,
              };
              analyticsService.identify(userId, userProperties);
              analyticsService.track(userId, "user_registered", {
                method: "google",
              });
            } catch (analyticsError) {
              logger.error(
                `PostHog Google registration track error: ${analyticsError.message}`
              );
            }

            try {
              // New user from Google should be auto-verified.
              const updatePayload = userUtil._constructLoginUpdate(user, null, {
                autoVerify: true,
              });
              await UserModel(tenant.toLowerCase())
                .findOneAndUpdate({ _id: user._id }, updatePayload, {
                  new: true,
                  upsert: false,
                  runValidators: true,
                })
                .then(() => {})
                .catch((error) => {
                  logger.error(
                    `🐛🐛 Internal Server Error -- ${stringify(error)}`
                  );
                });
            } catch (error) {
              logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
            }
            cb(null, user);

            return next();
          }
        }
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
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

const specificRoutes = [
  // ============================================
  // EVENTS ENDPOINTS
  // ============================================
  {
    uri: ["/api/v2/devices/events"],
    service: "events-registry",
    action: "Events API Access via Query Token",
    description:
      "Blocks JWT for events endpoint - uses query token authentication",
  },

  // ============================================
  // MEASUREMENTS ENDPOINTS (V2)
  // ============================================
  {
    uri: [
      "/api/v2/devices/measurements",
      "/api/v2/devices/measurements/sites",
      "/api/v2/devices/measurements/devices",
      "/api/v2/devices/measurements/cohorts",
      "/api/v2/devices/measurements/grids",
    ],
    service: "events-registry",
    action: "Measurements API Access via Query Token",
    description:
      "Blocks JWT for all measurements endpoints - uses query token authentication",
  },

  // ============================================
  // READINGS ENDPOINTS
  // ============================================
  {
    uri: ["/api/v2/devices/readings"],
    service: "events-registry",
    action: "Readings API Access via Query Token",
    description:
      "Blocks JWT for readings endpoint - uses query token authentication",
  },

  // ============================================
  // RAW DATA ENDPOINTS (V2 & V3)
  // ============================================
  {
    uri: ["/api/v2/analytics/raw-data", "/api/v3/public/analytics/raw-data"],
    service: "analytics",
    action: "Raw Data API Access via Query Token",
    description:
      "Blocks JWT for raw data endpoints - uses query token authentication",
  },

  // ============================================
  // DATA DOWNLOAD ENDPOINTS (V2 & V3)
  // ============================================
  {
    uri: [
      "/api/v2/analytics/data-download",
      "/api/v3/public/analytics/data-download",
    ],
    service: "analytics",
    action: "Data Download API Access via Query Token",
    description:
      "Blocks JWT for data download endpoints - uses query token authentication",
  },

  // ============================================
  // DATA EXPORT ENDPOINTS
  // ============================================
  {
    uri: [
      "/api/v2/analytics/data-export",
      "/api/v3/public/analytics/data-export",
    ],
    service: "analytics",
    action: "Data Export API Access via Query Token",
    description:
      "Blocks JWT for data export endpoints - uses query token authentication",
  },

  // ============================================
  // FORECAST ENDPOINTS (PREMIUM TIER)
  // ============================================
  {
    uri: [
      "/api/v2/analytics/forecasts/hourly",
      "/api/v2/analytics/forecasts/daily",
      "/api/v3/public/analytics/forecasts/hourly",
      "/api/v3/public/analytics/forecasts/daily",
    ],
    service: "analytics",
    action: "Forecast API Access via Query Token",
    description:
      "Blocks JWT for forecast endpoints - uses query token authentication",
  },

  // ============================================
  // HEATMAP ENDPOINTS
  // ============================================
  {
    uri: [
      "/api/v2/devices/measurements/heatmaps",
      "/api/v2/analytics/heatmaps",
    ],
    service: "analytics",
    action: "Heatmap API Access via Query Token",
    description:
      "Blocks JWT for heatmap endpoints - uses query token authentication",
  },

  // ============================================
  // DEPRECATED ENDPOINTS
  // ============================================
  {
    uri: ["/api/v1/devices"],
    service: "device-registry",
    action: "Deprecated API Version - Query Token Required",
    description: "Blocks JWT for deprecated v1 devices endpoint",
  },

  // ============================================
  // PUBLIC METADATA ENDPOINTS (if using query tokens)
  // ============================================
  {
    uri: [
      "/api/v2/devices/grids",
      "/api/v2/metadata/sites",
      "/api/v2/metadata/devices",
      "/api/v2/metadata/grids",
    ],
    service: "metadata",
    action: "Public Metadata API Access via Query Token",
    description:
      "Blocks JWT for public metadata endpoints - uses query token authentication",
  },
];

const routesWithService = [
  /**** Sites */
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "Site Creation",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/sites"],
    service: "site-registry",
    action: "View Sites",
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

  /**** Devices */
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
    method: "GET",
    uriIncludes: ["/api/v2/devices?"],
    service: "device-registry",
    action: "View Devices",
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
  /**** Cohorts */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "View Cohorts",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Create Cohorts",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Update Cohort",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/cohorts"],
    service: "cohort-registry",
    action: "Delete Cohort",
  },

  /**** Grids */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "View Grids",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Update Grid",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Delete Grid",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/grids"],
    service: "grid-registry",
    action: "Create Grid",
  },

  /**** AirQlouds */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "View AirQlouds",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Creation",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Update",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/airqlouds"],
    service: "airqloud-registry",
    action: "AirQloud Deletion",
  },

  /**** Site Activities */

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

  /**** Users */
  {
    method: "POST",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "Create User",
  },
  {
    method: "GET",
    uriIncludes: ["api/v2/users", "api/v1/users"],
    service: "auth",
    action: "View Users",
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

  /****Incentives*/
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

  /**** Calibrate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/calibrate", "/api/v2/calibrate"],
    service: "calibrate",
    action: "calibrate device",
  },

  /**** Locate */
  {
    method: "POST",
    uriIncludes: ["/api/v1/locate", "/api/v2/locate"],
    service: "locate",
    action: "Identify Suitable Device Locations",
  },

  /**** Fault Detection */
  {
    method: "POST",
    uriIncludes: ["/api/v1/predict-faults", "/api/v2/predict-faults"],
    service: "fault-detection",
    action: "Detect Faults",
  },

  /**** Data Proxy */
  {
    method: "GET",
    uriIncludes: ["/api/v2/data"],
    service: "data-mgt",
    action: "Retrieve Data",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/data-proxy"],
    service: "data-proxy",
    action: "Retrieve Data",
  },

  /*****Analytics */
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/sites"],
    service: "analytics",
    action: "Retrieve Sites on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/historical/daily-averages"],
    service: "analytics",
    action: "Retrieve Daily Averages on Analytics Page",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/analytics/dashboard/exceedances-devices"],
    service: "analytics",
    action: "Retrieve Exceedances on Analytics Page",
  },

  /*****KYA lessons */

  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Retrieve KYA lessons",
  },
  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Create KYA lesson",
  },
  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Update KYA lesson",
  },
  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/lessons/users"],
    service: "kya",
    action: "Delete KYA lesson",
  },
  /*****KYA Quizzes */
  {
    method: "GET",
    uriIncludes: ["/api/v2/devices/kya/quizzes/users"],
    service: "kya",
    action: "Retrieve KYA quizzes",
  },

  {
    method: "POST",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Create KYA quizzes",
  },

  {
    method: "PUT",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Update KYA quiz",
  },

  {
    method: "DELETE",
    uriIncludes: ["/api/v2/devices/kya/quizzes"],
    service: "kya",
    action: "Delete KYA quiz",
  },

  /*****view */
  {
    method: "GET",
    uriIncludes: ["/api/v2/view/mobile-app/version-info"],
    service: "mobile-version",
    action: "View Mobile App Information",
  },

  /*****Predict */
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/daily-forecast"],
    service: "predict",
    action: "Retrieve Daily Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/hourly-forecast"],
    service: "predict",
    action: "Retrieve Hourly Forecasts",
  },
  {
    method: "GET",
    uriIncludes: ["/api/v2/predict/heatmap"],
    service: "predict",
    action: "Retrieve Heatmap",
  },

  /*****Device Monitoring */
  {
    method: "GET",
    uriIncludes: ["/api/v2/monitor"],
    service: "monitor",
    action: "Retrieve Network Statistics Data",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/meta-data"],
    service: "meta-data",
    action: "Retrieve Metadata",
  },

  {
    method: "GET",
    uriIncludes: ["/api/v2/network-uptime"],
    service: "network-uptime",
    action: "Retrieve Network Uptime Data",
  },
];

// ============================================
// IMPROVED ROUTE MATCHING LOGIC
// ============================================

/**
 * Enhanced route matching function that handles:
 * - Exact matches
 * - Prefix matches
 * - Path parameters (e.g., /api/v2/devices/measurements/sites/{site_id})
 * - Query parameters
 *
 * @param {string} requestUri - The incoming request URI
 * @param {Array<string>} routeUris - Array of route patterns to match against
 * @returns {boolean} - True if the request URI matches any route pattern
 */
function matchesRoute(requestUri, routeUris) {
  if (!requestUri) return false;

  // Remove query parameters from request URI for matching
  const cleanUri = requestUri.split("?")[0];

  return routeUris.some((routeUri) => {
    // Exact match
    if (cleanUri === routeUri) return true;

    // Prefix match - checks if the URI starts with the route pattern
    if (cleanUri.startsWith(routeUri)) {
      // Ensure it's a valid path boundary (not matching partial segments)
      const nextChar = cleanUri[routeUri.length];
      return !nextChar || nextChar === "/" || nextChar === "?";
    }

    return false;
  });
}

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
      const requestBody = req.body;
      logObject("Request Body", requestBody);

      let service = req.headers["service"] || "unknown";
      let userAction = "unknown";

      // Check if the route should be blocked from JWT authentication
      for (const route of specificRoutes) {
        if (matchesRoute(endpoint, route.uri)) {
          service = route.service;
          userAction = route.action;

          // Return false to indicate authentication should not proceed via JWT
          return done(null, false, {
            message: "This endpoint requires query token authentication",
            service: service,
            action: userAction,
          });
        }
      }

      const user = await UserModel(tenant.toLowerCase())
        .findOne({ _id: payload._id })
        .exec();

      if (!user) {
        return done(null, false);
      }

      routesWithService.forEach(async (route) => {
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
          logObject("Service", service);

          if (["device-deployment", "device-recall"].includes(service)) {
            try {
              const emailResponse = await mailer.siteActivity(
                {
                  email: user.email,
                  firstName: user.firstName,
                  lastName: user.lastName,
                  siteActivityDetails: {
                    service: service,
                    userAction: userAction,
                    actor: user.email,
                  },
                },
                next
              );

              if (emailResponse && emailResponse.success === false) {
                logger.error(
                  `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
                );
              }
            } catch (error) {
              logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
            }
          }
        }
      });

      try {
        // Only update login stats; do not flip verification state here.
        const updatePayload = userUtil._constructLoginUpdate(user, null, {
          autoVerify: false,
        });
        await UserModel(tenant.toLowerCase())
          .findOneAndUpdate({ _id: user._id }, updatePayload, {
            new: true,
            upsert: false,
            runValidators: true,
          })
          .then(() => {})
          .catch((error) => {
            logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
          });
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
      }

      // Ensure user's default role is correctly assigned before proceeding
      await userUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());

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
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(e)}`);
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
  const strategy = useLocalStrategy(tenant, req, res, next);
  if (strategy) {
    passport.use("user-local", strategy);
  }
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
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setLocalStrategy(tenant, req, res, next);
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
    if (req.body && req.body.user_id) {
      logText("Skipping setJWTAuth due to user_id in request body.");
      next();
      return;
    }
    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }
    let tenant = "airqo";
    if (req.query.tenant) {
      tenant = req.query.tenant;
    }
    setJWTStrategy(tenant, req, res, next);
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

function authJWT(req, res, next) {
  if (req.body && req.body.user_id) {
    logText("Skipping authJWT due to user_id in request body.");
    next();
    return;
  }
  // If user_id is not present, proceed with JWT authentication
  passport.authenticate("jwt", { session: false })(req, res, next);
}

const enhancedJWTAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return next(
        new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
          message: "Authorization header is missing",
        })
      );
    }

    const match = authHeader.match(/^(JWT|Bearer)\s+(.+)$/i);
    if (!match || !match[2]) {
      return next(
        new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
          message:
            "Invalid Authorization header format. Expected 'Bearer <token>' or 'JWT <token>'",
        })
      );
    }

    const token = match[2].trim();
    if (!token) {
      return next(
        new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
          message: "Token is missing from Authorization header",
        })
      );
    }

    // ========================================
    // ROUTE BLOCKING CHECK (BEFORE JWT VERIFICATION)
    // Critical security check: Block JWT tokens from query-token-only endpoints
    // ========================================
    const endpoint =
      req.headers["x-original-uri"] || req.originalUrl || req.url;

    // Check if this endpoint should be blocked from JWT authentication
    for (const route of specificRoutes) {
      if (matchesRoute(endpoint, route.uri)) {
        logger.warn(
          `JWT blocked for endpoint: ${endpoint} - requires query token`
        );

        return next(
          new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
            message:
              "This endpoint requires query token authentication, JWT is not allowed",
            route:
              route.description ||
              "JWT authentication not permitted for this endpoint",
          })
        );
      }
    }
    // ========================================
    // END ROUTE BLOCKING CHECK
    // ========================================

    jwt.verify(
      token,
      constants.JWT_SECRET,
      { ignoreExpiration: true },
      async (err, decoded) => {
        // This handles malformed tokens, but not expiration
        if (err) {
          return next(
            new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
              message: `Invalid token: ${err.message}`,
            })
          );
        }

        const now = Math.floor(Date.now() / 1000);

        // 1. Check if token is fully expired (past grace period)
        if (decoded.exp + GRACE_PERIOD_SECONDS < now) {
          return next(
            new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
              message: "Your session has expired. Please log in again.",
            })
          );
        }

        const tenantRaw =
          req.query.tenant ||
          req.body.tenant ||
          constants.DEFAULT_TENANT ||
          "airqo";
        const tenant = String(tenantRaw).toLowerCase();

        // 2. Check if a refresh is needed (proactive sliding window OR reactive grace period)
        if (decoded.exp < now + REFRESH_WINDOW_SECONDS) {
          try {
            const userIdForRefresh = decoded.id || decoded._id;
            const userForRefresh = await UserModel(tenant)
              .findById(userIdForRefresh)
              .lean();

            if (userForRefresh) {
              const tokenFactory = new AbstractTokenFactory(tenant);
              const strategy =
                userUtil._getEffectiveTokenStrategy(userForRefresh);
              const newToken = await tokenFactory.createToken(
                userForRefresh,
                strategy,
                { expiresIn: `${TOKEN_LIFE_SECONDS}s` }
              );

              res.set("X-Access-Token", `JWT ${newToken}`);
              res.set("Access-Control-Expose-Headers", "X-Access-Token");
            }
          } catch (refreshError) {
            logger.error(
              `Failed to refresh token for user ${decoded.id || decoded._id}: ${
                refreshError.message
              }`
            );
            // Do not fail the request, just log the error. The current token is still valid (or within grace).
          }
        }

        // 3. Attach user info to the request and proceed
        const userId = decoded.userId || decoded.id || decoded._id;
        const user = await UserModel(tenant).findById(userId).lean();

        const analyticsId =
          typeof userId === "string" ? userId : userId?.toString?.();
        if (analyticsId) {
          req.analyticsUserId = analyticsId;
        }

        if (!user) {
          return next(
            new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
              message: "User from token no longer exists",
            })
          );
        }

        // For compatibility, merge DB user data with token claims
        req.user = { ...user, ...decoded };
        next();
      }
    );
  } catch (error) {
    logger.error(`🐛🐛 Enhanced JWT Auth Error: ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

function authenticateJWT(req, res, next) {
  try {
    if (req.body && req.body.user_id) {
      logText("Skipping setJWTAuth due to user_id in request body.");
      next();
      return;
    }

    const errors = extractErrorsFromRequest(req);
    if (errors) {
      next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
      return;
    }

    setJWTStrategy("airqo", req, res, next);

    passport.authenticate("jwt", { session: false })(req, res, next); //Authenticate
  } catch (e) {
    logger.error(`the error in authenticateJWT is: ${e.message}`);
    next(new HttpError(e.message, httpStatus.INTERNAL_SERVER_ERROR));
  }
}

// ============================================
// ROUTE CONFIGURATION VALIDATION
// ============================================

/**
 * Validates the specificRoutes configuration on startup
 * Helps catch configuration errors early
 */
function validateRouteConfiguration() {
  const errors = [];
  const allUris = new Set();

  specificRoutes.forEach((route, index) => {
    // Check required fields
    if (!route.uri || !Array.isArray(route.uri)) {
      errors.push(`Route at index ${index} missing or invalid 'uri' array`);
    }
    if (!route.service) {
      errors.push(`Route at index ${index} missing 'service' field`);
    }
    if (!route.action) {
      errors.push(`Route at index ${index} missing 'action' field`);
    }

    // Check for duplicate URIs across routes
    if (route.uri && Array.isArray(route.uri)) {
      route.uri.forEach((uri) => {
        if (allUris.has(uri)) {
          errors.push(`Duplicate URI found: ${uri}`);
        }
        allUris.add(uri);
      });
    }
  });

  if (errors.length > 0) {
    logger.error("❌ Route configuration validation failed:");
    errors.forEach((error) => logger.error(`  - ${error}`));
    throw new Error("Invalid route configuration");
  }

  return true;
}

// Validate configuration on module load
try {
  validateRouteConfiguration();
} catch (error) {
  logger.error("Failed to validate route configuration:", error);
  // Crash the process to prevent startup with invalid configuration
}

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
  enhancedJWTAuth,
  authenticateJWT,
};
