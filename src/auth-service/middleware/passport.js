const passport = require("passport");
const LocalStrategy = require("passport-local");
const createUserUtil = require("@utils/user.util");
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
        } else if (user.analyticsVersion === 3 && user.verified === false) {
          const tenantValue = tenant || "airqo";
          const verificationRequest = {
            tenant: tenantValue,
            email: user.email,
          };
          try {
            const verificationEmailResponse =
              await createUserUtil.verificationReminder(
                verificationRequest,
                next
              );
            if (
              !verificationEmailResponse ||
              verificationEmailResponse.success === false
            ) {
              logger.error(
                `Internal Server Error --- ${stringify(
                  verificationEmailResponse || "No Response"
                )}`
              );
            }
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error --- ${stringify(error)}`);
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
        } else if (user.analyticsVersion === 4 && !user.verified) {
          await createUserUtil
            .mobileVerificationReminder({ tenant, email: user.email }, next)
            .then((verificationResponse) => {
              if (
                !verificationResponse ||
                verificationResponse.success === false
              ) {
                logger.error(
                  `Verification reminder failed: ${
                    verificationResponse
                      ? verificationResponse.message
                      : "No response"
                  }`
                );
              }
            })
            .catch((err) => {
              logger.error(
                `Error sending verification reminder: ${err.message}`
              );
            });

          req.auth.success = false;
          req.auth.message =
            "account not verified, verification email has been sent to your email";
          req.auth.status = httpStatus.FORBIDDEN;
          next(
            new HttpError(
              "account not verified, verification email has been sent to your email",
              httpStatus.FORBIDDEN,
              {
                message:
                  "account not verified, verification email has been sent to your email",
              }
            )
          );
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

              logger.info(`Migrated email case for user: ${user._id}`);
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
            const DEFAULT_PERMISSIONS = constants.DEFAULT_NEW_USER_PERMISSIONS;
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
              logger.info(`Updated default permissions for user ${user.email}`);
            }
          } catch (permError) {
            logger.error(
              `Error updating default permissions for user ${user.email}: ${permError.message}`
            );
          }
        })();
        const currentDate = new Date();

        try {
          await UserModel(tenant.toLowerCase())
            .findOneAndUpdate(
              { _id: user._id },
              {
                $set: { lastLogin: currentDate, isActive: true },
                $inc: { loginCount: 1 },
                ...(user.analyticsVersion !== 3 && user.verified === false
                  ? { $set: { verified: true } }
                  : {}),
              },
              {
                new: true,
                upsert: false,
                runValidators: true,
              }
            )
            .then(() => {})
            .catch((error) => {
              logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
            });
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
        }
        // Ensure user's default role is correctly assigned before proceeding
        await createUserUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());
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
            const tenantValue = tenant || "airqo";
            const verificationRequest = {
              tenant: tenantValue,
              email: user.email,
            };
            const verificationEmailResponse =
              await createUserUtil.verificationReminder(
                verificationRequest,
                next
              );
            if (
              !verificationEmailResponse ||
              verificationEmailResponse.success === false
            ) {
              logger.error(
                `Internal Server Error --- ${stringify(
                  verificationEmailResponse || "No Response"
                )}`
              );
            }
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error --- ${stringify(error)}`);
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
        } else if (user.analyticsVersion === 4 && !user.verified) {
          createUserUtil
            .mobileVerificationReminder({ tenant, email: user.email }, next)
            .then((verificationResponse) => {
              if (
                !verificationResponse ||
                verificationResponse.success === false
              ) {
                logger.error(
                  `Verification reminder failed: ${
                    verificationResponse
                      ? verificationResponse.message
                      : "No response"
                  }`
                );
              }
            })
            .catch((err) => {
              logger.error(
                `Error sending verification reminder: ${err.message}`
              );
            });

          req.auth.success = false;
          req.auth.message =
            "account not verified, verification email has been sent to your email";
          req.auth.status = httpStatus.FORBIDDEN;
          next(
            new HttpError(
              "account not verified, verification email has been sent to your email",
              httpStatus.FORBIDDEN,
              {
                message:
                  "account not verified, verification email has been sent to your email",
              }
            )
          );
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

              logger.info(`Migrated email case for user: ${user._id}`);
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
            const DEFAULT_PERMISSIONS = constants.DEFAULT_NEW_USER_PERMISSIONS;
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
              logger.info(`Updated default permissions for user ${user.email}`);
            }
          } catch (permError) {
            logger.error(
              `Error updating default permissions for user ${user.email}: ${permError.message}`
            );
          }
        })();

        const currentDate = new Date();

        try {
          await UserModel(tenant.toLowerCase())
            .findOneAndUpdate(
              { _id: user._id },
              {
                $set: { lastLogin: currentDate, isActive: true },
                $inc: { loginCount: 1 },
                ...(user.analyticsVersion !== 3 && user.verified === false
                  ? { $set: { verified: true } }
                  : {}),
              },
              {
                new: true,
                upsert: false,
                runValidators: true,
              }
            )
            .then(() => {})
            .catch((error) => {
              logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
            });
        } catch (error) {
          logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
        }

        // Ensure user's default role is correctly assigned before proceeding
        await createUserUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());

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

                logger.info(`Migrated email case for user: ${user._id}`);
              }
            } catch (error) {
              logger.warn(
                `Could not migrate email case for user ${user._id}: ${error.message}`
              );
            }
          }

          // Role check and fix
          await createUserUtil.ensureDefaultAirqoRole(
            user,
            tenant.toLowerCase()
          );

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
            const currentDate = new Date();
            try {
              await UserModel(tenant.toLowerCase())
                .findOneAndUpdate(
                  { _id: user._id },
                  {
                    $set: { lastLogin: currentDate, isActive: true },
                    $inc: { loginCount: 1 },
                    ...(user.analyticsVersion !== 3 && user.verified === false
                      ? { $set: { verified: true } }
                      : {}),
                  },
                  {
                    new: true,
                    upsert: false,
                    runValidators: true,
                  }
                )
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

      const specificRoutes = [
        {
          uri: ["/api/v2/devices/events"],
          service: "events-registry",
          action: "Events API Access via JWT",
        },
        {
          uri: ["/api/v2/devices/measurements"],
          service: "events-registry",
          action: "Measurements API Access via JWT",
        },
        {
          uri: ["/api/v2/devices/readings"],
          service: "events-registry",
          action: "Readings API Access via JWT",
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

        /**** Readings... */
        {
          method: "GET",
          uriIncludes: [
            "/api/v2/devices/measurements",
            "/api/v2/devices/events",
            "/api/v2/devices/readings",
          ],
          service: "events-registry",
          action: " Retrieve Measurements",
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
          uriIncludes: [
            "/api/v2/analytics/dashboard/historical/daily-averages",
          ],
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

      const currentDate = new Date();

      try {
        await UserModel(tenant.toLowerCase())
          .findOneAndUpdate(
            { _id: user._id },
            {
              $set: { lastLogin: currentDate, isActive: true },
              $inc: { loginCount: 1 },
              ...(user.analyticsVersion !== 3 && user.verified === false
                ? { $set: { verified: true } }
                : {}),
            },
            {
              new: true,
              upsert: false,
              runValidators: true,
            }
          )
          .then(() => {})
          .catch((error) => {
            logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
          });
      } catch (error) {
        logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
      }

      // Ensure user's default role is correctly assigned before proceeding
      await createUserUtil.ensureDefaultAirqoRole(user, tenant.toLowerCase());

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

const enhancedJWTAuth = async (req, res, next) => {
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

    const tenantRaw =
      req.query.tenant ||
      req.body.tenant ||
      constants.DEFAULT_TENANT ||
      "airqo";
    const tenant = String(tenantRaw).toLowerCase();

    const tokenFactory = new AbstractTokenFactory(tenant);
    const decodedUser = await tokenFactory.decodeToken(token);

    const userId = decodedUser.userId || decodedUser.id || decodedUser._id;
    if (!userId) {
      return next(
        new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
          message: "Invalid token: User identifier not found in token payload",
        })
      );
    }

    const user = await UserModel(tenant).findById(userId).lean();

    if (!user) {
      return next(
        new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
          message: "User no longer exists",
        })
      );
    }

    // Attach DB-backed user and token claims separately to avoid shadowing DB values
    req.user = {
      ...user,
      ...decodedUser,
    };

    next();
  } catch (error) {
    logger.error(`Enhanced JWT Auth Error: ${error.message}`);
    // Provide a more specific error message based on the JWT error type
    let errorMessage = "Invalid or expired token";
    if (error.name === "JsonWebTokenError") {
      errorMessage = `Invalid token: ${error.message}`;
    } else if (error.name === "TokenExpiredError") {
      errorMessage = "Token has expired";
    }
    return next(
      new HttpError("Unauthorized", httpStatus.UNAUTHORIZED, {
        message: errorMessage,
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
