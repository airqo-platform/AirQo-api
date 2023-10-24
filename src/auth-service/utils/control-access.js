const PermissionModel = require("@models/Permission");
const ScopeModel = require("@models/Scope");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const UserModel = require("@models/User");
const RoleModel = require("@models/Role");
const DepartmentModel = require("@models/Department");
const NetworkModel = require("@models/Network");
const GroupModel = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const accessCodeGenerator = require("generate-password");
const winstonLogger = require("@utils/log-winston");
const { logObject, logElement, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const moment = require("moment-timezone");
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- control-access-util`
);

const convertToUpperCaseWithUnderscore = (inputString) => {
  try {
    const uppercaseString = inputString.toUpperCase();
    const transformedString = uppercaseString.replace(/ /g, "_");
    return transformedString;
  } catch (error) {
    logger.error(`Internal Server Error --  ${JSON.stringify(error)}`);
  }
};

const isGroupRoleOrNetworkRole = (role) => {
  logObject("role", role);
  if (role && (role.group_id || role.network_id)) {
    if (role.group_id && !role.network_id) {
      return "group";
    } else if (!role.group_id && role.network_id) {
      return "network";
    } else {
      return "none";
    }
  }
  return "none";
};

const findAssociatedIdForRole = async ({
  role_id,
  tenant = "airqo",
  roles,
} = {}) => {
  for (const role of roles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      role.network &&
      role.network.toString() === RoleDetails.network_id.toString()
    ) {
      return role.network;
    } else if (
      role.group &&
      role.group.toString() === RoleDetails.group_id.toString()
    ) {
      return role.group;
    }
  }
  return null;
};

const findNetworkIdForRole = async ({
  role_id,
  tenant = "airqo",
  networkRoles,
} = {}) => {
  for (const networkRole of networkRoles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      networkRole.network &&
      networkRole.network.toString() === RoleDetails.network_id.toString()
    ) {
      return networkRole.network;
    }
  }
  return null;
};

const findGroupIdForRole = async ({
  role_id,
  tenant = "airqo",
  groupRoles,
} = {}) => {
  for (const groupRole of groupRoles) {
    const RoleDetails = await RoleModel(tenant).findById(role_id).lean();
    logObject("RoleDetails", RoleDetails);
    if (
      groupRole.group &&
      groupRole.group.toString() === RoleDetails.group_id.toString()
    ) {
      return groupRole.group;
    }
  }
  return null;
};

const isUserSuperAdmin = async ({
  networkId,
  groupId,
  networkRoles = [],
  groupRoles = [],
  tenant = "airqo",
}) => {
  for (const role of networkRoles) {
    if (role.network && role.network.toString() === networkId.toString()) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  for (const role of groupRoles) {
    if (role.group && role.group.toString() === groupId.toString()) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  return false;
};

const isAssignedUserSuperAdmin = async ({
  associatedId,
  roles = [],
  tenant = "airqo",
}) => {
  for (const role of roles) {
    if (
      (role.network && role.network.toString() === associatedId.toString()) ||
      (role.group && role.group.toString() === associatedId.toString())
    ) {
      const RoleDetails = await RoleModel(tenant)
        .findById(ObjectId(role.role))
        .lean();
      if (
        RoleDetails &&
        RoleDetails.role_name &&
        RoleDetails.role_name.endsWith("SUPER_ADMIN")
      ) {
        return true;
      }
    }
  }

  return false;
};

const isRoleAlreadyAssigned = (roles, role_id) => {
  if (isEmpty(roles) || !Array.isArray(roles)) {
    return false;
  } else {
    return roles.some((role) => {
      if (isEmpty(role.role)) {
        return false;
      }
      logObject("role.role.toString()", role.role.toString());
      logObject("role_id.toString()", role_id.toString());
      return role.role.toString() === role_id.toString();
    });
  }
};

const generateClientSecret = (length) => {
  if (length % 2 !== 0) {
    throw new Error("Length must be an even number");
  }
  const numBytes = length / 2;
  const clientSecret = crypto.randomBytes(numBytes).toString("hex");
  return clientSecret;
};

const routeDefinitions = [
  {
    uriIncludes: ["/api/v1/devices"],
    service: "deprecated-version-number",
  },
  { uriIncludes: ["/api/v2/devices/events"], service: "events-registry" },
  { uriIncludes: ["/api/v2/devices/measurements"], service: "events-registry" },
  { uriIncludes: ["/api/v2/devices/sites"], service: "site-registry" },
  {
    uriIncludes: ["/api/v2/devices?", "/api/v2/devices/soft?"],
    service: "device-registry",
  },
  { uriIncludes: ["/api/v2/devices/airqlouds"], service: "airqlouds-registry" },
  {
    uriIncludes: ["/api/v2/devices/activities/maintain"],
    service: "device-maintenance",
  },
  {
    uriIncludes: ["/api/v2/devices/activities/deploy"],
    service: "device-deployment",
  },
  {
    uriIncludes: ["/api/v2/devices/activities/recall"],
    service: "device-recall",
  },
  { uriIncludes: ["/api/v2/users"], service: "auth" },
  { uriIncludes: ["/api/v2/incentives"], service: "incentives" },
  {
    uriIncludes: ["/api/v2/calibrate", "/api/v1/calibrate"],
    service: "calibrate",
  },
  { uriIncludes: ["/api/v2/locate", "/api/v1/locate"], service: "locate" },
  {
    uriIncludes: ["/api/v2/predict-faults", "/api/v1/predict-faults"],
    service: "fault-detection",
  },
  {
    uriIncludes: [
      "/api/v2/analytics/data-download",
      "/api/v1/analytics/data-download",
    ],
    service: "data-export-download",
  },
  {
    uriIncludes: [
      "/api/v2/analytics/data-export",
      "/api/v1/analytics/data-export",
    ],
    service: "data-export-scheduling",
  },
];

const getService = (headers) => {
  const uri = headers["x-original-uri"];
  const serviceHeader = headers["service"];

  if (uri) {
    for (const route of routeDefinitions) {
      if (route.uri && uri.includes(route.uri)) {
        return route.service;
      } else if (
        route.uriEndsWith &&
        route.uriEndsWith.some((suffix) => uri.endsWith(suffix))
      ) {
        return route.service;
      } else if (
        route.uriIncludes &&
        route.uriIncludes.some((includes) => uri.includes(includes))
      ) {
        return route.service;
      }
    }
  } else if (serviceHeader) {
    return serviceHeader;
  }

  return "unknown";
};

const getUserAction = (headers) => {
  if (headers["x-original-method"]) {
    const method = headers["x-original-method"];
    const actionMap = {
      PUT: "update operation",
      DELETE: "delete operation",
      POST: "creation operation",
      GET: "viewing data",
    };
    return actionMap[method] || "Unknown Action";
  }
  return "Unknown Action";
};

const createUnauthorizedResponse = () => {
  return {
    success: false,
    message: "Unauthorized",
    status: httpStatus.UNAUTHORIZED,
    errors: { message: "Unauthorized" },
  };
};

const createValidTokenResponse = () => {
  return {
    success: true,
    message: "The token is valid",
    status: httpStatus.OK,
  };
};

const handleServerError = (error) => {
  const errorMessage = error.message || "Internal server error";
  return {
    success: false,
    message: errorMessage,
    status: httpStatus.INTERNAL_SERVER_ERROR,
    errors: { message: errorMessage },
  };
};

const controlAccess = {
  sample: async (request) => {
    try {
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  /******* hashing ******************************************/
  hash: (string) => {
    try {
      crypto.createHash("sha256").update(string).digest("base64");
    } catch (error) {}
  },
  hash_compare: (first_item, second_item) => {
    try {
      Object.is(first_item, second_item);
    } catch (error) {}
  },
  /******** access tokens ******************************************/
  verifyEmail: async (request) => {
    try {
      const { tenant, limit, skip } = request.query;
      const { user_id, token } = request.params;
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const userDetails = await UserModel(tenant)
        .find({
          _id: ObjectId(user_id),
        })
        .lean();

      logObject("userDetails", userDetails);

      if (isEmpty(userDetails)) {
        return {
          success: false,
          message: "Bad Reqest Error",
          errors: { message: "User does not exist" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAccessToken = await AccessTokenModel(tenant).list({
        skip,
        limit,
        filter,
      });

      logObject("responseFromListAccessToken", responseFromListAccessToken);

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          return {
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: "Invalid link",
            errors: { message: "incorrect user or token details provided" },
          };
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          let update = {
            verified: true,
          };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify({
            filter,
            update,
          });
          logObject("responseFromUpdateUser", responseFromUpdateUser);

          if (responseFromUpdateUser.success === true) {
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }

            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await AccessTokenModel(
              tenant
            ).remove({ filter });

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: userDetails[0].firstName,
                  username: userDetails[0].userName,
                  password,
                  email: userDetails[0].email,
                }
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              return {
                success: false,
                message: "unable to verify user",
                status: responseFromDeleteToken.status
                  ? responseFromDeleteToken.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                errors: responseFromDeleteToken.errors
                  ? responseFromDeleteToken.errors
                  : { message: "internal server errors" },
              };
            }
          } else if (responseFromUpdateUser.success === false) {
            return {
              success: false,
              message: "unable to verify user",
              status: responseFromUpdateUser.status
                ? responseFromUpdateUser.status
                : httpStatus.INTERNAL_SERVER_ERROR,
              errors: responseFromUpdateUser.errors
                ? responseFromUpdateUser.errors
                : { message: "internal server errors" },
            };
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("erroring in util", error);
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateAccessToken: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const token = request.params.token;
      const tokenDetails = await AccessTokenModel(tenant)
        .find({ token })
        .lean();

      if (isEmpty(tokenDetails)) {
        return {
          success: false,
          message: "Bad Request",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Bad request -- Token ${token} does not exist` },
        };
      } else {
        const tokenId = tokenDetails[0]._id;
        let update = Object.assign({}, body);
        if (update.token) {
          delete update.token;
        }
        if (update.expires) {
          delete update.expires;
        }
        if (update._id) {
          delete update._id;
        }
        const updatedToken = await AccessTokenModel(tenant)
          .findByIdAndUpdate(tokenId, update, { new: true })
          .lean();

        if (!isEmpty(updatedToken)) {
          return {
            success: true,
            message: "Successfully updated the token's metadata",
            data: updatedToken,
            status: httpStatus.OK,
          };
        } else {
          return {
            success: false,
            message: "Unable to update the token's metadata",
            errors: { message: "Unable to update the token's metadata" },
            status: httpStatus.CONFLICT,
          };
        }
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  regenerateAccessToken: async (request) => {
    try {
      return {
        success: false,
        message: "Service temporarily unavailable",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: {
          message: "Service temporarily unavailable",
        },
      };
      const { query, body } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.tokens(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }

      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      let update = Object.assign({}, body);
      update.token = token;

      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateToken;
    } catch (error) {
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteAccessToken: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.tokens(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }
      const responseFromDeleteToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).remove({ filter });

      if (responseFromDeleteToken.success === true) {
        return responseFromDeleteToken;
      } else if (responseFromDeleteToken.success == false) {
        return responseFromDeleteToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  verifyToken: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const filterResponse = generateFilter.tokens(request);
      const timeZone = moment.tz.guess();

      if (filterResponse.success === false) {
        return filterResponse;
      } else {
        filter = Object.assign({}, filterResponse);
        filter.expires = {
          $gt: moment().tz(timeZone).toDate(),
        };
      }

      const service = getService(request.headers);
      if (service === "deprecated-version-number") {
        return createUnauthorizedResponse();
      }
      const userAction = getUserAction(request.headers);

      const responseFromListAccessToken = await AccessTokenModel(tenant).list({
        skip,
        limit,
        filter,
      });

      logObject(
        "responseFromListAccessToken.data",
        responseFromListAccessToken.data
      );

      logObject(
        "responseFromListAccessToken.data[0]",
        responseFromListAccessToken.data[0]
      );
      logObject(
        "request.headers[x-original-uri]",
        request.headers["x-original-uri"]
      );
      logObject(
        "request.headers[x-original-method]",
        request.headers["x-original-method"]
      );

      logObject(
        "request.headers['x-host-name']",
        request.headers["x-host-name"]
      );
      logObject(
        "request.headers['x-client-ip']",
        request.headers["x-client-ip"]
      );

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          return createUnauthorizedResponse();
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          logObject("service", service);
          logObject("userAction", userAction);

          if (service && userAction) {
            const { user: { email = "", userName = "" } = {} } =
              responseFromListAccessToken.data[0];
            const clientIp = request.headers["x-client-ip"];
            const hostName = request.headers["x-host-name"];
            logObject("email", email);
            logObject("userName", userName);
            winstonLogger.info(userAction, {
              email,
              username: userName,
              service: service,
              clientIp,
              hostName,
            });

            return createValidTokenResponse();
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      return handleServerError(error);
    }
  },
  listAccessToken: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const responseFromGenerateFilter = generateFilter.tokens(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter;
      }
      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter });
      return responseFromListToken;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createAccessToken: async (request) => {
    try {
      const { tenant } = request.query;
      const { client_id } = request.body;

      const client = await ClientModel(tenant).findById(ObjectId(client_id));

      if (!client) {
        return {
          success: false,
          message: "Client not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `Invalid request, Client ${client_id} not found`,
          },
        };
      }

      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      let tokenCreationBody = Object.assign(
        { token, client_id: ObjectId(client_id) },
        request.body
      );
      tokenCreationBody.category = "api";
      const responseFromCreateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).register(tokenCreationBody);

      logObject("responseFromCreateToken", responseFromCreateToken);

      return responseFromCreateToken;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  generateVerificationToken: async (request) => {
    try {
      return {
        success: false,
        message: "Service Temporarily Disabled",
        errors: {
          message: "Service Temporarily Disabled",
        },
        status: httpStatus.SERVICE_UNAVAILABLE,
      };
      const { query, body } = request;
      const { email } = body;
      const { tenant } = query;

      const password = password
        ? password
        : accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );

      const newRequest = Object.assign({ userName: email, password }, request);

      const responseFromCreateUser = await UserModel(tenant).register(
        newRequest
      );
      if (responseFromCreateUser.success === true) {
        if (responseFromCreateUser.status === httpStatus.NO_CONTENT) {
          return responseFromCreateUser;
        }
        const token = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
          )
          .toUpperCase();

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const emailVerificationHours = parseInt(
          constants.EMAIL_VERIFICATION_HOURS
        );
        const emailVerificationMins = parseInt(
          constants.EMAIL_VERIFICATION_MIN
        );
        const emailVerificationSeconds = parseInt(
          constants.EMAIL_VERIFICATION_SEC
        );

        /***
         * We need to find a client ID associated with this user?
         */

        const responseFromSaveToken = await AccessTokenModel(tenant).register({
          token,
          client: {},
          user_id: responseFromCreateUser.data._id,
          expires:
            Date.now() +
            toMilliseconds(
              emailVerificationHours,
              emailVerificationMins,
              emailVerificationSeconds
            ),
        });

        if (responseFromSaveToken.success === true) {
          let createdUser = await responseFromCreateUser.data;
          logObject("created user in util", createdUser._doc);
          const user_id = createdUser._doc._id;

          const responseFromSendEmail = await mailer.verifyEmail({
            user_id,
            token,
            email,
            firstName,
          });

          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "An Email sent to your account please verify",
              data: createdUser._doc,
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromSaveToken.success === false) {
          return responseFromSaveToken;
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
      }
    } catch (error) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  verifyVerificationToken: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { user_id, token } = params;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const timeZone = moment.tz.guess();

      let filter = {
        token,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      const responseFromListAccessToken = await AccessTokenModel(tenant).list({
        skip,
        limit,
        filter,
      });

      logObject("responseFromListAccessToken", responseFromListAccessToken);

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          return {
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: "Invalid link",
            errors: { message: "incorrect user or token details provided" },
          };
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          const password = accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );
          let update = {
            verified: true,
            password,
            $pull: { tokens: { $in: [token] } },
          };
          filter = { _id: user_id };

          const responseFromUpdateUser = await UserModel(tenant).modify({
            filter,
            update,
          });
          logObject("responseFromUpdateUser", responseFromUpdateUser);

          if (responseFromUpdateUser.success === true) {
            if (responseFromUpdateUser.status === httpStatus.BAD_REQUEST) {
              return responseFromUpdateUser;
            }
            let user = responseFromUpdateUser.data;
            filter = { token };
            logObject("the deletion of the token filter", filter);
            const responseFromDeleteToken = await AccessTokenModel(
              tenant
            ).remove({ filter });

            logObject("responseFromDeleteToken", responseFromDeleteToken);

            if (responseFromDeleteToken.success === true) {
              const responseFromSendEmail = await mailer.afterEmailVerification(
                {
                  firstName: user.firstName,
                  username: user.userName,
                  password,
                  email: user.email,
                }
              );

              if (responseFromSendEmail.success === true) {
                return {
                  success: true,
                  message: "email verified sucessfully",
                  status: httpStatus.OK,
                };
              } else if (responseFromSendEmail.success === false) {
                return responseFromSendEmail;
              }
            } else if (responseFromDeleteToken.success === false) {
              return {
                success: false,
                message: "unable to verify user",
                status: responseFromDeleteToken.status
                  ? responseFromDeleteToken.status
                  : httpStatus.INTERNAL_SERVER_ERROR,
                errors: responseFromDeleteToken.errors
                  ? responseFromDeleteToken.errors
                  : { message: "internal server errors" },
              };
            }
          } else if (responseFromUpdateUser.success === false) {
            return {
              success: false,
              message: "unable to verify user",
              status: responseFromUpdateUser.status
                ? responseFromUpdateUser.status
                : httpStatus.INTERNAL_SERVER_ERROR,
              errors: responseFromUpdateUser.errors
                ? responseFromUpdateUser.errors
                : { message: "internal server errors" },
            };
          }
        }
      } else if (responseFromListAccessToken.success === false) {
        return responseFromListAccessToken;
      }
    } catch (error) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******** create clients ******************************************/
  updateClient: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.clients(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }

      let update = Object.assign({}, body);
      if (update.client_secret) {
        delete update.client_secret;
      }
      const responseFromUpdateClient = await ClientModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateClient;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteClient: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.clients(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }
      const responseFromDeleteClient = await ClientModel(
        tenant.toLowerCase()
      ).remove({ filter });
      return responseFromDeleteClient;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listClient: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const responseFromGenerateFilter = generateFilter.clients(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter;
      }
      const responseFromListClient = await ClientModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter });

      logObject("responseFromListClient", responseFromListClient);
      return responseFromListClient;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createClient: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      const { user_id } = body;
      const client_secret = generateClientSecret(100);
      const userExists = await UserModel(tenant).exists({ _id: user_id });
      if (!userExists) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `User ${user_id} does not exist` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      let modifiedBody = Object.assign({}, body);
      modifiedBody.client_secret = client_secret;

      const responseFromCreateClient = await ClientModel(
        tenant.toLowerCase()
      ).register(modifiedBody);
      return responseFromCreateClient;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateClientSecret: async (request) => {
    try {
      const { tenant } = request.query;
      const { client_id } = request.params;

      const clientExists = await ClientModel(tenant).exists({ _id: client_id });
      if (!clientExists) {
        logger.error(`Client with ID ${client_id} not found`);
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Client with ID ${client_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const client_secret = generateClientSecret(100);
      const updatedClient = await ClientModel(tenant)
        .findByIdAndUpdate(client_id, { client_secret }, { new: true })
        .exec();

      // logObject("updatedClient", updatedClient);
      if (isEmpty(updatedClient)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: { message: "unable to complete operation" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      } else {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: updatedClient.client_secret,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`Error updating client secret: ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: `Error updating client secret: ${error.message}` },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******** create scopes ******************************************/
  updateScope: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.scopes(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }

      let update = Object.assign({}, body);

      const responseFromUpdateToken = await ScopeModel(
        tenant.toLowerCase()
      ).modify({ filter, update });

      if (responseFromUpdateToken.success === true) {
        return responseFromUpdateToken;
      } else if (responseFromUpdateToken.success === false) {
        return responseFromUpdateToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteScope: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromFilter = generateFilter.scopes(request);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      } else {
        filter = responseFromFilter;
      }
      const responseFromDeleteToken = await ScopeModel(
        tenant.toLowerCase()
      ).remove({ filter });

      if (responseFromDeleteToken.success === true) {
        return responseFromDeleteToken;
      } else if (responseFromDeleteToken.success === false) {
        return responseFromDeleteToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listScope: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const responseFromGenerateFilter = generateFilter.scopes(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter;
      }
      const responseFromListToken = await ScopeModel(tenant.toLowerCase()).list(
        { skip, limit, filter }
      );
      if (responseFromListToken.success === true) {
        return responseFromListToken;
      } else if (responseFromListToken.success === false) {
        return responseFromListToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createScope: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreateToken = await ScopeModel(
        tenant.toLowerCase()
      ).register(body);

      if (responseFromCreateToken.success === true) {
        return responseFromCreateToken;
      } else if (responseFromCreateToken.success === false) {
        return responseFromCreateToken;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******* roles *******************************************/
  listRole: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list({
        filter,
      });
      return responseFromListRole;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  listRolesForNetwork: async (request) => {
    try {
      const { query, params } = request;
      const { net_id } = params;
      const { tenant } = query;

      const network = await NetworkModel(tenant).findById(net_id);
      if (!network) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Network ${net_id.toString()} Not Found`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            network_id: ObjectId(net_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Network",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listRolesForGroup: async (request) => {
    try {
      const { query, params } = request;
      const { grp_id } = params;
      const { tenant } = query;

      const group = await GroupModel(tenant).findById(grp_id);
      if (!group) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Group ${grp_id.toString()} Not Found`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const roleResponse = await RoleModel(tenant).aggregate([
        {
          $match: {
            group_id: ObjectId(grp_id),
          },
        },
        {
          $lookup: {
            from: "permissions",
            localField: "role_permissions",
            foreignField: "_id",
            as: "role_permissions",
          },
        },
        {
          $project: {
            _id: 1,
            role_name: 1,
            role_permissions: {
              $map: {
                input: "$role_permissions",
                as: "role_permission",
                in: {
                  _id: "$$role_permission._id",
                  permission: "$$role_permission.permission",
                },
              },
            },
          },
        },
      ]);

      if (!isEmpty(roleResponse)) {
        return {
          success: true,
          message: "Successful Operation",
          status: httpStatus.OK,
          data: roleResponse,
        };
      } else if (isEmpty(roleResponse)) {
        return {
          success: true,
          message: "No roles for this Group",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteRole: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request);
      if (filter.success === false) {
        return filter;
      }

      if (isEmpty(filter._id)) {
        return {
          success: false,
          message: "Bad Request",
          errors: {
            message:
              "the role ID is missing -- required when updating corresponding users",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const result = await UserModel(tenant).updateMany(
        {
          $or: [
            { "network_roles.role": filter._id },
            { "group_roles.role": filter._id },
          ],
        },
        { $set: { "network_roles.$.role": null, "group_roles.$.role": null } }
      );

      if (result.nModified > 0) {
        logger.info(
          `Removed role ${filter._id} from ${result.nModified} users.`
        );
      }

      if (result.n === 0) {
        logger.info(
          `Role ${filter._id} was not found in any users' network_roles or group_roles.`
        );
      }
      const responseFromDeleteRole = await RoleModel(
        tenant.toLowerCase()
      ).remove({ filter });
      logObject("responseFromDeleteRole", responseFromDeleteRole);
      return responseFromDeleteRole;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  updateRole: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request);
      if (filter.success === false) {
        return filter;
      }

      const update = Object.assign({}, body);

      const responseFromUpdateRole = await RoleModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateRole;
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  createRole: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      let newBody = Object.assign({}, body);
      let organizationName;

      if (body.network_id) {
        const network = await NetworkModel(tenant).findById(body.network_id);
        if (isEmpty(network)) {
          return {
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: "Bad Request Error",
            errors: {
              message: `Provided organization ${body.network_id} is invalid, please crosscheck`,
            },
          };
        }
        organizationName = network.net_name.toUpperCase();
      } else if (body.group_id) {
        const group = await GroupModel(tenant).findById(body.group_id);
        if (isEmpty(group)) {
          return {
            success: false,
            status: httpStatus.BAD_REQUEST,
            message: "Bad Request Error",
            errors: {
              message: `Provided group ${body.group_id} is invalid, please crosscheck`,
            },
          };
        }
        organizationName = group.grp_title.toUpperCase();
      } else {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: {
            message: "Either network_id or group_id must be provided",
          },
        };
      }

      const transformedRoleName = convertToUpperCaseWithUnderscore(
        body.role_name
      );
      const availableRoleCode = body.role_code
        ? body.role_code
        : body.role_name;
      const transformedRoleCode =
        convertToUpperCaseWithUnderscore(availableRoleCode);

      newBody.role_name = `${organizationName}_${transformedRoleName}`;
      newBody.role_code = `${organizationName}_${transformedRoleCode}`;

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody);

      return responseFromCreateRole;
    } catch (error) {
      logger.error(`internal server error -- ${JSON.stringify(error)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listAvailableUsersForRole: async (request) => {
    try {
      const { tenant } = request.query;
      const { role_id } = request.params;

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid role ID ${role_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const roleType = role.network_id ? "Network" : "Group";
      const query = roleType === "Network" ? "network_roles" : "group_roles";

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              [query]: {
                $not: {
                  $elemMatch: {
                    role: role_id,
                  },
                },
              },
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject(
        "responseFromListAvailableUsers",
        responseFromListAvailableUsers
      );

      return {
        success: true,
        message: `Retrieved all available users for the ${roleType} role ${role_id}`,
        data: responseFromListAvailableUsers,
      };
    } catch (error) {
      logElement("internal server error", error.message);
      logger.error(`Internal Server Error ${error.message}`);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  assignUserToRole: async (request) => {
    try {
      const { role_id, user_id } = request.params;
      const { tenant } = request.query;
      const { user } = request.body;
      const userIdFromBody = user;
      const userIdFromQuery = user_id;

      if (!isEmpty(userIdFromBody) && !isEmpty(userIdFromQuery)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message:
              "You cannot provide the user ID using query params and query body; choose one approach",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const userId = userIdFromQuery || userIdFromBody;
      logObject("userId", userId);

      const role = await RoleModel(tenant).findById(role_id).lean();

      const userExists = await UserModel(tenant).exists({ _id: userId });
      const roleExists = await RoleModel(tenant).exists({ _id: role_id });

      if (!userExists || !roleExists) {
        return {
          success: false,
          message: "User or Role not found",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `User ${userId} or Role ${role_id} not found` },
        };
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      if (roleType === "none") {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const isNetworkRole = roleType === "network";

      const userObject = await UserModel(tenant)
        .findById(userId)
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      const userRoles = isNetworkRole
        ? userObject.network_roles
        : userObject.group_roles;
      logObject("userRoles", userRoles);
      const roles = userRoles || [];
      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

      logObject("isRoleAssigned", isRoleAssigned);

      if (isRoleAssigned) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `User ${userObject._id.toString()} is already assigned to the role ${role_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      if (isEmpty(associatedId)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The ROLE ${role_id} is not associated with any of the ${
              isNetworkRole ? "networks" : "groups"
            } already assigned to USER ${userObject._id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles: userRoles,
        tenant,
      });

      if (isSuperAdmin) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `SUPER ADMIN user ${userObject._id} cannot be reassigned to a different role`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updateQuery = {
        $set: {
          [isNetworkRole ? "network_roles" : "group_roles"]: {
            [isNetworkRole ? "network" : "group"]: associatedId,
            role: role_id,
          },
        },
      };

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        { _id: userObject._id },
        updateQuery,
        { new: true }
      );

      if (updatedUser) {
        return {
          success: true,
          message: "User assigned to the Role",
          data: updatedUser,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: false,
          message: "Internal Server Error",
          status: httpStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "Failed to assign user" },
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignManyUsersToRole: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { user_ids } = body;

      const roleObject = await RoleModel(tenant).findById(role_id).lean();

      if (isEmpty(roleObject)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Role ${role_id.toString()} does not exist`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const roleType = isGroupRoleOrNetworkRole(roleObject);

      if (roleType === "none") {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const assignUserPromises = [];
      const isNetworkRole = roleType === "network";

      const users = await UserModel(tenant)
        .find({ _id: { $in: user_ids } })
        .populate(isNetworkRole ? "network_roles" : "group_roles")
        .lean();

      for (const user of users) {
        if (isEmpty(user)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: { message: `One of the Users does not exist` },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const userRoles = isNetworkRole ? user.network_roles : user.group_roles;

        const roles = userRoles || [];
        logObject("roles", roles);

        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (isRoleAssigned) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is already assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (isEmpty(associatedId)) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${
                isNetworkRole ? "networks" : "groups"
              } already assigned to USER ${user._id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles: userRoles,
          tenant,
        });

        if (isSuperAdmin) {
          assignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER ADMIN user ${user._id} can not be reassigned to a different role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: {
            [isNetworkRole ? "network_roles" : "group_roles"]: {
              [isNetworkRole ? "network" : "group"]: associatedId,
              role: role_id,
            },
          },
        };

        await UserModel(tenant).updateOne({ _id: user._id }, updateQuery);

        assignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(assignUserPromises);
      const successfulAssignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      let response;

      if (
        successfulAssignments.length > 0 &&
        unsuccessfulAssignments.length > 0
      ) {
        response = {
          success: true,
          message: "Some users were successfully assigned to the role.",
          data: { unsuccessfulAssignments },
          status: httpStatus.OK,
        };
      } else if (
        unsuccessfulAssignments.length > 0 &&
        successfulAssignments.length === 0
      ) {
        response = {
          success: false,
          message: "Bad Request Error",
          errors: {
            message:
              "None of the provided users could be assigned to the role.",
            unsuccessfulAssignments,
          },
          status: httpStatus.BAD_REQUEST,
        };
      } else {
        response = {
          success: true,
          message: "All provided users were successfully assigned to the role.",
          status: httpStatus.OK,
        };
      }

      return response;
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  listUsersWithRole: async (request) => {
    try {
      logText("listUsersWithRole...");
      const { query, params } = request;
      const { role_id } = params;
      const { tenant } = query;

      const role = await RoleModel(tenant).findById(role_id);

      if (!role) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid role ID ${role_id.toString()}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const networkRoleFilter = { "network_roles.role": ObjectId(role_id) };
      const groupRoleFilter = { "group_roles.role": ObjectId(role_id) };

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              $or: [networkRoleFilter, groupRoleFilter],
            },
          },
          {
            $project: {
              _id: 1,
              email: 1,
              firstName: 1,
              lastName: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
              userName: 1,
            },
          },
        ])
        .exec();

      logObject("responseFromListAssignedUsers", responseFromListAssignedUsers);

      return {
        success: true,
        message: `retrieved all assigned users for role ${role_id}`,
        data: responseFromListAssignedUsers,
      };
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignUserFromRole: async (request) => {
    try {
      const { query, params } = request;
      const { role_id, user_id } = params;
      const { tenant } = query;

      const [userObject, role, userExists, roleExists] = await Promise.all([
        UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean(),
        RoleModel(tenant).findById(role_id).lean(),
        UserModel(tenant).exists({ _id: user_id }),
        RoleModel(tenant).exists({ _id: role_id }),
      ]);

      logObject("userObject", userObject);

      if (!userExists || !roleExists) {
        return {
          success: false,
          message: "User or Role not found",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `User ${user_id} or Role ${role_id} not found`,
          },
        };
      }

      const roleType = isGroupRoleOrNetworkRole(role);

      logObject("roleType", roleType);

      if (roleType === "none") {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Role ${role_id.toString()} is not associated with any network or group`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const { network_roles, group_roles } = userObject;

      logObject("network_roles", network_roles);
      logObject("group_roles", group_roles);

      const roles = roleType === "network" ? network_roles : group_roles;

      logObject("roles", roles);

      const associatedId = await findAssociatedIdForRole({
        role_id,
        roles,
        tenant,
      });

      logObject("associatedId", associatedId);

      if (isEmpty(associatedId)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const isSuperAdmin = await isAssignedUserSuperAdmin({
        associatedId,
        roles,
        tenant,
      });

      if (isSuperAdmin) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);
      logObject("isRoleAssigned", isRoleAssigned);

      if (!isRoleAssigned) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const filter = {
        _id: user_id,
        [`${roleType}_roles.${roleType}`]: associatedId,
      };
      const update = {
        $set: { [`${roleType}_roles.$[elem].role`]: null },
      };

      logObject("filter", filter);
      logObject("update", update);

      const arrayFilters = [{ "elem.role": role_id }];

      const updatedUser = await UserModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true, arrayFilters }
      );

      logObject("updatedUser", updatedUser);

      if (isEmpty(updatedUser)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message:
              "User not found or not assigned to the specified Role in the Network or Group provided",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      return {
        success: true,
        message: "User unassigned from the role",
        data: updatedUser,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`Internal Server Error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignManyUsersFromRole: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { user_ids } = body;

      const roleObject = await RoleModel(tenant).findById(role_id).lean();

      if (isEmpty(roleObject)) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Role ${role_id} not found` },
        };
      }

      // Check if all provided users actually exist
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      const nonExistentUsers = user_ids.filter(
        (user_id) => !existingUsers.some((user) => user._id.equals(user_id))
      );

      if (nonExistentUsers.length > 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `The following users do not exist: ${nonExistentUsers.join(
              ", "
            )}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const unAssignUserPromises = [];

      for (const user_id of user_ids) {
        const userObject = await UserModel(tenant)
          .findById(user_id)
          .populate("network_roles group_roles")
          .lean();

        const { network_roles, group_roles } = userObject;
        logObject("roleObject", roleObject);
        const roleType = isGroupRoleOrNetworkRole(roleObject);
        logObject("roleType", roleType);

        if (roleType === "none") {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Role ${role_id.toString()} is not associated with any network or group`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const roles = roleType === "network" ? network_roles : group_roles;
        const isRoleAssigned = isRoleAlreadyAssigned(roles, role_id);

        if (!isRoleAssigned) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const associatedId = await findAssociatedIdForRole({
          role_id,
          roles,
          tenant,
        });

        if (!associatedId) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `The ROLE ${role_id} is not associated with any of the ${roleType.toUpperCase()}s already assigned to USER ${user_id}`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const isSuperAdmin = await isAssignedUserSuperAdmin({
          associatedId,
          roles,
          tenant,
        });

        if (isSuperAdmin) {
          unAssignUserPromises.push({
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
            },
            status: httpStatus.BAD_REQUEST,
          });
          continue;
        }

        const updateQuery = {
          $set: { [`${roleType}_roles.$[elem].role`]: null },
        };

        const updateResult = await UserModel(tenant).updateOne(
          { _id: user_id },
          updateQuery,
          { arrayFilters: [{ "elem.role": role_id }] }
        );

        if (updateResult.nModified !== 1) {
          unAssignUserPromises.push({
            success: false,
            message: "Could not unassign all users from the role.",
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
          continue;
        }

        unAssignUserPromises.push(null);
      }

      const assignUserResults = await Promise.all(unAssignUserPromises);

      const successfulUnassignments = assignUserResults.filter(
        (result) => result === null
      );
      const unsuccessfulUnAssignments = assignUserResults.filter(
        (result) => result !== null
      );

      let success, message, status;

      if (
        successfulUnassignments.length > 0 &&
        unsuccessfulUnAssignments.length > 0
      ) {
        success = true;
        message = "Some users were successfully unassigned from the role";
        status = httpStatus.OK;
      } else if (
        unsuccessfulUnAssignments.length > 0 &&
        successfulUnassignments.length === 0
      ) {
        success = false;
        message = "Bad Request Error";
        status = httpStatus.BAD_REQUEST;
      } else {
        success = true;
        message =
          "All provided users were successfully unassigned from the role.";
        status = httpStatus.OK;
      }

      const response = {
        success,
        message,
        status,
      };

      if (success) {
        response.data = { unsuccessfulUnAssignments };
      } else {
        response.errors = {
          message:
            "None of the provided users could be unassigned from the role.",
          unsuccessfulUnAssignments,
        };
      }
      return response;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /*********************roles and permissions....*/
  listPermissionsForRole: async (request) => {
    try {
      logText("listPermissionsForRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, params } = request;
      const { role_id } = params;
      const { tenant } = query;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;

      const responseFromlistPermissionsForRole = await PermissionModel(
        tenant
      ).list({
        skip,
        limit,
        filter,
      });

      if (responseFromlistPermissionsForRole.success === true) {
        if (responseFromlistPermissionsForRole.status === httpStatus.OK) {
          const permissionsArray = responseFromlistPermissionsForRole.data.map(
            (obj) => obj.permission
          );
          responseFromlistPermissionsForRole.data = permissionsArray;
          return responseFromlistPermissionsForRole;
        }
        return responseFromlistPermissionsForRole;
      } else if (responseFromlistPermissionsForRole.success === false) {
        return responseFromlistPermissionsForRole;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  listAvailablePermissionsForRole: async (request) => {
    try {
      logText("listAvailablePermissionsForRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, params } = request;
      const { role_id } = params;
      const { tenant } = query;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;

      const filterResponse = generateFilter.roles(newRequest);
      if (filterResponse.success === false) {
        return filter;
      } else {
        filter = filterResponse;
      }

      const responseFromListAvailablePermissionsForRole = await RoleModel(
        tenant
      ).list({
        skip,
        limit,
        filter,
      });

      logObject(
        "responseFromListAvailablePermissionsForRole",
        responseFromListAvailablePermissionsForRole
      );

      if (responseFromListAvailablePermissionsForRole.success === true) {
        if (
          responseFromListAvailablePermissionsForRole.message ===
            "roles not found for this operation" ||
          isEmpty(responseFromListAvailablePermissionsForRole.data)
        ) {
          return responseFromListAvailablePermissionsForRole;
        }

        const permissions =
          responseFromListAvailablePermissionsForRole.data[0].role_permissions;
        const permissionsArray = permissions.map((obj) => obj.permission);
        filter = { permission: { $nin: permissionsArray } };
        let responseFromListPermissions = await PermissionModel(tenant).list({
          skip,
          limit,
          filter,
        });
        return responseFromListPermissions;
      } else if (
        responseFromListAvailablePermissionsForRole.success === false
      ) {
        return responseFromListAvailablePermissionsForRole;
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  assignPermissionsToRole: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { permissions } = body;

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Role ${role_id.toString()} Not Found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const permissionsResponse = await PermissionModel(tenant).find({
        _id: { $in: permissions.map((id) => ObjectId(id)) },
      });

      if (permissionsResponse.length !== permissions.length) {
        return {
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: "not all provided permissions exist, please crosscheck",
          },
        };
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      logObject("assignedPermissions", assignedPermissions);

      const alreadyAssigned = permissions.filter((permission) =>
        assignedPermissions.includes(permission)
      );

      logObject("alreadyAssigned", alreadyAssigned);

      if (alreadyAssigned.length > 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some permissions already assigned to the Role ${role_id.toString()}, they include: ${alreadyAssigned.join(
              ","
            )}`,
          },
        };
      }
      const updatedRole = await RoleModel(tenant).findOneAndUpdate(
        { _id: role_id },
        { $addToSet: { role_permissions: { $each: permissions } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions added successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "unable to update Role" },
          status: httpStatus.BAD_REQUEST,
        };
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  unAssignPermissionFromRole: async (request) => {
    try {
      const { query, params } = request;
      const { role_id, permission_id } = params;
      const { tenant } = query;

      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: `Role ${role_id.toString()} Not Found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const filter = { _id: role_id };
      const update = { $pull: { role_permissions: permission_id } };

      const permission = await PermissionModel(tenant).findById(permission_id);
      if (!permission) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Permission ${permission_id.toString()} Not Found`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const roleResponse = await RoleModel(tenant).findOne({
        _id: role_id,
        role_permissions: permission_id,
      });

      if (!roleResponse) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Permission ${permission_id.toString()} is not assigned to the Role ${role_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromUnAssignPermissionFromRole = await RoleModel(
        tenant
      ).modify({
        filter,
        update,
      });

      if (responseFromUnAssignPermissionFromRole.success === true) {
        let modifiedResponse = Object.assign(
          {},
          responseFromUnAssignPermissionFromRole
        );
        if (
          responseFromUnAssignPermissionFromRole.message ===
          "successfully modified the Permission"
        ) {
          modifiedResponse.message = "permission has been unassigned from role";
        }
        return modifiedResponse;
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        return responseFromUnAssignPermissionFromRole;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  unAssignManyPermissionsFromRole: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { permission_ids } = body;

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: { message: `Role ${role_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const assignedPermissions = role.role_permissions.map((permission) =>
        permission.toString()
      );

      const notAssigned = permission_ids.filter(
        (permission) => !assignedPermissions.includes(permission)
      );

      if (notAssigned.length > 0) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided permissions are not assigned to the Role ${role_id.toString()}, they include: ${notAssigned.join(
              ", "
            )}`,
          },
        };
      }

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { $pull: { role_permissions: { $in: permission_ids } } },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions removed successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "unable to remove the permissions" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      return {
        success: true,
        message: `permissions successfully unassigned from the role.`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateRolePermissions: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { permission_ids } = body;

      // Check if role exists
      const role = await RoleModel(tenant).findById(role_id);
      if (!role) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: { message: `Role ${role_id} not found` },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if any of the provided permission IDs don't exist
      const permissions = await PermissionModel(tenant).find({
        _id: { $in: permission_ids },
      });
      const missingPermissions = permission_ids.filter((permission_id) => {
        return !permissions.some((permission) =>
          permission._id.equals(permission_id)
        );
      });
      if (missingPermissions.length > 0) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: {
            message: `Permissions not found: ${missingPermissions.join(", ")}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const uniquePermissions = [...new Set(permission_ids)];

      const updatedRole = await RoleModel(tenant).findByIdAndUpdate(
        role_id,
        { role_permissions: uniquePermissions },
        { new: true }
      );

      if (!isEmpty(updatedRole)) {
        return {
          success: true,
          message: "Permissions updated successfully",
          status: httpStatus.OK,
          data: updatedRole,
        };
      } else if (isEmpty(updatedRole)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "unable to update the permissions" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      return {
        success: true,
        message: `permissions successfully updated.`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /******* permissions *******************************************/
  listPermission: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).list({
        filter,
      });
      if (responseFromListPermissions.success === true) {
        return responseFromListPermissions;
      } else if (responseFromListPermissions.success === false) {
        return responseFromListPermissions;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deletePermission: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.permissions(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromDeletePermission = await PermissionModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      if (responseFromDeletePermission.success === true) {
        return responseFromDeletePermission;
      } else if (responseFromDeletePermission.success === false) {
        return responseFromDeletePermission;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updatePermission: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const update = body;
      const filter = generateFilter.permissions(request);
      if (filter.success === false) {
        return filter;
      }
      const responseFromUpdatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      if (responseFromUpdatePermission.success === true) {
        return responseFromUpdatePermission;
      } else if (responseFromUpdatePermission.success === false) {
        return responseFromUpdatePermission;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  createPermission: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const responseFromCreatePermission = await PermissionModel(
        tenant.toLowerCase()
      ).register(body);
      if (responseFromCreatePermission.success === true) {
        return responseFromCreatePermission;
      } else if (responseFromCreatePermission.success === false) {
        return responseFromCreatePermission;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /********* departments  ******************************************/
  createDepartment: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = Object.assign({}, body);
      const responseFromRegisterDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).register(modifiedBody);

      logObject(
        "responseFromRegisterDepartment",
        responseFromRegisterDepartment
      );

      if (responseFromRegisterDepartment.success === true) {
        return responseFromRegisterDepartment;
      } else if (responseFromRegisterNetwork.success === false) {
        return responseFromRegisterDepartment;
      }
    } catch (err) {
      logger.error(`internal server error -- ${err.message}`);
      return {
        success: false,
        message: "network util server errors",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  updateDepartment: async (request) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;

      let update = Object.assign({}, body);
      let filter = {};

      const responseFromGeneratefilter = generateFilter.departments(request);

      if (responseFromGeneratefilter.success === false) {
        return responseFromGeneratefilter;
      } else {
        filter = responseFromGeneratefilter.data;
      }

      const responseFromModifyDepartment = await DepartmentModel(
        tenant.toLowerCase()
      ).modify({ update, filter });

      if (responseFromModifyDepartment.success === true) {
        return responseFromModifyDepartment;
      } else if (responseFromModifyDepartment.success === false) {
        return responseFromModifyDepartment;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  deleteDepartment: async (request) => {
    try {
      logText("the delete operation.....");
      const { query } = request;
      const { tenant } = query;
      let filter = {};

      const responseFromGenerateFilter = generateFilter.departments(request);

      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
      }

      const responseFromRemoveNetwork = await DepartmentModel(
        tenant.toLowerCase()
      ).remove({ filter });

      logObject("responseFromRemoveNetwork", responseFromRemoveNetwork);

      if (responseFromRemoveNetwork.success === true) {
        return responseFromRemoveNetwork;
      } else if (responseFromRemoveNetwork.success === false) {
        return responseFromRemoveNetwork;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  listDepartment: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};

      const responseFromGenerateFilter = generateFilter.departments(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
      }

      const responseFromListDepartments = await DepartmentModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip });

      if (responseFromListDepartments.success === true) {
        return responseFromListDepartments;
      } else if (responseFromListDepartments.success === false) {
        return responseFromListDepartments;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logElement("internal server error", error.message);
      return {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
};

module.exports = controlAccess;
