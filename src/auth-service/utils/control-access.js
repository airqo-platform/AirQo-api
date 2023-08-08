const PermissionSchema = require("@models/Permission");
const ScopeSchema = require("@models/Scope");
const ClientSchema = require("@models/Client");
const AccessTokenSchema = require("@models/AccessToken");
const UserSchema = require("@models/User");
const RoleSchema = require("@models/Role");
const DepartmentSchema = require("@models/Department");
const NetworkSchema = require("@models/Network");
const GroupSchema = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const accessCodeGenerator = require("generate-password");
const { getModelByTenant } = require("@config/database");
const winstonLogger = require("@utils/log-winston");
const { logObject, logElement, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const moment = require("moment-timezone");
const ObjectId = mongoose.Types.ObjectId;

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- control-access-util`
);

const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
};

const UserModel = (tenant) => {
  try {
    let users = mongoose.model("users");
    return users;
  } catch (error) {
    let users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const AccessTokenModel = (tenant) => {
  try {
    let tokens = mongoose.model("access_tokens");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "access_token", AccessTokenSchema);
    return tokens;
  }
};

const PermissionModel = (tenant) => {
  try {
    let permissions = mongoose.model("permissions");
    return permissions;
  } catch (error) {
    let permissions = getModelByTenant(tenant, "permission", PermissionSchema);
    return permissions;
  }
};

const ClientModel = (tenant) => {
  try {
    let clients = mongoose.model("clients");
    return clients;
  } catch (error) {
    let clients = getModelByTenant(tenant, "client", ClientSchema);
    return clients;
  }
};

const ScopeModel = (tenant) => {
  try {
    let scopes = mongoose.model("scopes");
    return scopes;
  } catch (error) {
    let scopes = getModelByTenant(tenant, "scope", ScopeSchema);
    return scopes;
  }
};

const RoleModel = (tenant) => {
  try {
    let roles = mongoose.model("roles");
    return roles;
  } catch (error) {
    let roles = getModelByTenant(tenant, "role", RoleSchema);
    return roles;
  }
};

const DepartmentModel = (tenant) => {
  try {
    let departments = mongoose.model("departments");
    return departments;
  } catch (error) {
    let departments = getModelByTenant(tenant, "department", DepartmentSchema);
    return departments;
  }
};

const GroupModel = (tenant) => {
  try {
    let groups = mongoose.model("groups");
    return groups;
  } catch (error) {
    let groups = getModelByTenant(tenant, "group", GroupSchema);
    return groups;
  }
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
      const { query, params } = request;
      const { tenant } = query;
      const { user_id, token } = params;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        user_id,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      // expires: { $gt: new Date().toISOString() },

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
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
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
      update["token"] = token;

      const responseFromUpdateToken = await AccessTokenModel(
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

      if (filterResponse.success === false) {
        return filterResponse;
      } else {
        filter = Object.assign({}, filterResponse);
        // filter.expires = { $gt: new Date().toISOString() };
      }

      const responseFromListAccessToken = await AccessTokenModel(tenant).list({
        skip,
        limit,
        filter,
      });

      logObject("responseFromListAccessToken", responseFromListAccessToken);

      if (responseFromListAccessToken.success === true) {
        if (responseFromListAccessToken.status === httpStatus.NOT_FOUND) {
          let newResponse = Object.assign({}, responseFromListAccessToken);
          newResponse.message = "Unauthorized";
          newResponse.status = httpStatus.UNAUTHORIZED;
          newResponse.errors = { message: "Unauthorized" };
          return newResponse;
        } else if (responseFromListAccessToken.status === httpStatus.OK) {
          let newResponse = Object.assign({}, responseFromListAccessToken);
          newResponse.message = "the token is valid";
          newResponse.data = newResponse.data[0];
          try {
            let service = request.headers
              ? request.headers["service"]
              : "unknown";

            logObject(
              "the req object accessing our system using ACCESS TOKENS",
              req
            );

            if (
              request.baseUrl.includes("/api/v2/devices/events") ||
              request.baseUrl.includes("/api/v1/devices/events")
            ) {
              service = "api";
              /**
               * NEXT VERSION:
               * We shall crosscheck the CLIENT_SECRET, CLIENT_ID and TOKEN_ID
               * of the user if they ALL exist and are valid.
               * We shall be using the Client's connection
               */
            }
            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/devices/sites") ||
                request.baseUrl.endsWith("/api/v1/devices/sites"))
            ) {
              service = "site-registry";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/devices") ||
                request.baseUrl.endsWith("/api/v1/devices") ||
                request.baseUrl.endsWith("/api/v1/devices/soft") ||
                request.baseUrl.endsWith("/api/v2/devices/soft"))
            ) {
              service = "device-registry";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/devices/airqlouds") ||
                request.baseUrl.endsWith("/api/v1/devices/airqlouds"))
            ) {
              service = "airqlouds-registry";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith(
                "/api/v2/devices/activities/maintain"
              ) ||
                request.baseUrl.endsWith("/api/v1/devices/activities/maintain"))
            ) {
              service = "device-maintenance";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/devices/activities/deploy") ||
                request.baseUrl.endsWith("/api/v1/devices/activities/deploy"))
            ) {
              service = "device-deployment";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/devices/activities/recall") ||
                request.baseUrl.endsWith("/api/v1/devices/activities/recall"))
            ) {
              service = "device-recall";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.endsWith("/api/v2/users") ||
                request.baseUrl.endsWith("/api/v1/users"))
            ) {
              service = "auth";
            }
            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.includes("/api/v2/incentives") ||
                request.baseUrl.includes("/api/v1/incentives"))
            ) {
              service = "incentives";
            }
            if (
              request.baseUrl.includes("/api/v2/calibrate") ||
              request.baseUrl.includes("/api/v1/calibrate")
            ) {
              service = "calibrate";
            }

            if (
              request.baseUrl.includes("/api/v2/locate") ||
              request.baseUrl.includes("/api/v1/locate")
            ) {
              service = "locate";
            }

            if (
              request.baseUrl.includes("/api/v2/predict-faults") ||
              request.baseUrl.includes("/api/v1/predict-faults")
            ) {
              service = "fault-detection";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.includes("/api/v2/analytics/data/download") ||
                request.baseUrl.includes("/api/v1/analytics/data/download"))
            ) {
              service = "data-export-download";
            }

            if (
              (request.method === "POST" ||
                request.method === "PUT" ||
                request.method === "DELETE") &&
              (request.baseUrl.includes("/api/v2/analytics/data-export") ||
                request.baseUrl.includes("/api/v1/analytics/data-export"))
            ) {
              service = "data-export-scheduling";
            }

            const user = newResponse.data.user;
            winstonLogger.info(`successful login through ${service} service`, {
              username: user.email,
              email: user.email,
              service: service ? service : "none",
            });
          } catch (error) {
            logObject("error", error);
            logger.error(`Internal Server Error -- ${error.message}`);
          }
          return newResponse;
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

  listAccessToken: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      // const { token } = params;
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
      if (responseFromListToken.success === true) {
        // if (!isEmpty(token)) {
        //   const returnedToken = responseFromListToken.data[0];
        //   if (!compareSync(token, returnedToken.token)) {
        //     return {
        //       success: false,
        //       message: "either token or user do not exist",
        //       status: httpStatus.BAD_REQUEST,
        //       errors: { message: "either token or user do not exist" },
        //     };
        //   }
        // }
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

  createAccessToken: async (request) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      let { user_id } = body;

      const token = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.TOKEN_LENGTH)
        )
        .toUpperCase();

      /**
       * Does the User ID actually exist?
       */

      const userExists = await UserModel(tenant).exists({ _id: user_id });
      if (!userExists) {
        return {
          success: false,
          message: "User not found",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Invalid request, User ${user_id} not found` },
        };
      }

      /**
       * Does the client ID actually exist?
       * We shall not just create random access IDs from here.
       */

      // if (!isEmpty(client_id)) {
      //   const clientExists = await ClientModel(tenant).exists({
      //     _id: client_id,
      //   });
      //   if (!clientExists) {
      //     return {
      //       success: false,
      //       message: "Client not found",
      //       status: httpStatus.BAD_REQUEST,
      //       errors: {
      //         message: `Invalid request, Client ${client_id} not found`,
      //       },
      //     };
      //   }
      // }

      /**
       * just create the client from here?
       */

      const client_id = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .toUpperCase();

      const client_secret = accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_SECRET_LENGTH)
      );
      const clientName = request.user ? request.user.email : "no_email";
      let clientRequestBody = {};
      clientRequestBody["client_secret"] = client_secret;
      clientRequestBody["client_id"] = client_id;
      clientRequestBody["name"] = `client_${clientName}`;

      const responseFromCreateClient = await ClientModel(
        tenant.toLowerCase()
      ).register(clientRequestBody);

      if (responseFromCreateClient.success === true) {
        let modifiedBody = Object.assign({}, body);
        modifiedBody["token"] = token;
        modifiedBody["client_secret"] = client_secret;
        modifiedBody["client_id"] = client_id;

        const responseFromCreateToken = await AccessTokenModel(
          tenant.toLowerCase()
        ).register(modifiedBody);

        if (responseFromCreateToken.success === true) {
          return responseFromCreateToken;
        } else if (responseFromCreateToken.success === false) {
          return responseFromCreateToken;
        }
      } else if (responseFromCreateClient.success === false) {
        return responseFromCreateClient;
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

  generateVerificationToken: async (request) => {
    try {
      /**
       * Just create the token and save it on the system
       * Store it alongside their email address
       * Send the token to the user so as to use it for verification
       */
      const { query, body } = request;
      const { email } = body;
      const { tenant } = query;

      const password = password
        ? password
        : accessCodeGenerator.generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(10)
          );

      /**
       *We are just going to create the user in the system and 
       send them verification codes via email
       It is those verification codes we shall use to verify them in the system
       */

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

        const client_id = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
          )
          .toUpperCase();

        const client_secret = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(31)
        );

        const responseFromSaveClient = await ClientModel(tenant).register({
          client_id,
          client_secret,
          name: responseFromCreateUser.data.email,
        });
        if (
          responseFromSaveClient.success === false ||
          responseFromSaveClient.status === httpStatus.ACCEPTED
        ) {
          return responseFromSaveClient;
        }

        const toMilliseconds = (hrs, min, sec) =>
          (hrs * 60 * 60 + min * 60 + sec) * 1000;

        const hrs = constants.EMAIL_VERIFICATION_HOURS;
        const min = constants.EMAIL_VERIFICATION_MIN;
        const sec = constants.EMAIL_VERIFICATION_SEC;

        const responseFromSaveToken = await AccessTokenModel(tenant).register({
          token,
          network_id,
          client_id: responseFromSaveClient.data._id,
          user_id: responseFromCreateUser.data._id,
          expires: Date.now() + toMilliseconds(hrs, min, sec),
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
      /**
       * create the user on the Platform
       * create the user on Firebase
       *
       */
      const { query, params } = request;
      const { tenant } = query;
      const { user_id, token } = params;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const timeZone = moment.tz.guess();
      let filter = {
        token,
        user_id,
        expires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      // expires: { $gt: new Date().toISOString() },

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
            /**
             * we shall also need to handle case where there was no update
             * later...cases where the user never existed in the first place
             * this will not be necessary if user deletion is cascaded.
             */
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
      if (update.client_id) {
        const client_id = accessCodeGenerator
          .generate(
            constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
          )
          .toUpperCase();
        update["client_id"] = client_id;
      }
      if (update.client_secret) {
        const client_secret = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        );
        update["client_secret"] = client_secret;
      }

      const responseFromUpdateToken = await ClientModel(
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
      const responseFromDeleteToken = await ClientModel(
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
      const responseFromListToken = await ClientModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter });
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

  createClient: async (request) => {
    try {
      const { query, body, params } = request;
      const { tenant } = query;

      const client_id = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .toUpperCase();
      const client_secret = accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_SECRET_LENGTH)
      );

      let modifiedBody = Object.assign({}, body);
      modifiedBody["client_secret"] = client_secret;
      modifiedBody["client_id"] = client_id;

      const responseFromCreateToken = await ClientModel(
        tenant.toLowerCase()
      ).register(modifiedBody);

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
            name: 1,
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
  deleteRole: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.roles(request);
      if (filter.success === false) {
        return filter;
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
      const network = await NetworkModel(tenant).findById(body.network_id);
      if (isEmpty(network)) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Bad Request Error",
          errors: {
            message: `Provided organisation ${body.network_id} is invalid, please crosscheck`,
          },
        };
      }

      const organizationName = network.net_name.toUpperCase();
      newBody.role_name = `${organizationName}_${body.role_name}`;
      newBody.role_code = `${organizationName}_${
        body.role_code ? body.role_code : body.role_name
      }`;

      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(newBody);

      return responseFromCreateRole;
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

      const responseFromListAvailableUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              role: { $ne: role_id },
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
        message: `retrieved all available users for the role ${role_id}`,
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
              "You can not provide the user ID using query params and query body, choose one approach",
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const userId = userIdFromQuery || userIdFromBody;
      logObject("userId", userId);

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

      const userObject = await UserModel(tenant)
        .findById(userId)
        .populate("role")
        .lean();

      logObject("userObject", userObject);

      if (
        userObject.role &&
        userObject.role._id.toString() === role_id.toString()
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Role ${role_id} already assigned to User ${userId}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      if (
        userObject.role &&
        userObject.role.role_name.endsWith("SUPER_ADMIN")
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `SUPER ADMIN user ${userId} can not be reassigned to a different role`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        userId,
        { role: role_id },
        { new: true }
      );

      return {
        success: true,
        message: "User assigned to the Role",
        data: updatedUser,
        status: httpStatus.OK,
      };
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

      const users = await Promise.all(
        user_ids.map((id) =>
          UserModel(tenant).findById(id).populate("role").lean()
        )
      );

      for (const user of users) {
        logObject("user", user);
        if (isEmpty(user)) {
          return {
            success: false,
            message: "Bad Reqest Error",
            errors: { message: `One of the Users does not exist` },
            status: httpStatus.BAD_REQUEST,
          };
        }

        const role = user.role;
        if (!isEmpty(role) && role.role_name.endsWith("SUPER_ADMIN")) {
          logObject("");
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `SUPER ADMIN user ${user._id} can not be reassigned to a different role`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (!isEmpty(role) && role._id.toString() === role_id.toString()) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is already assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      const result = await UserModel(tenant).updateMany(
        { _id: { $in: user_ids } },
        { $set: { role: role_id } }
      );

      let message = "";
      let status = httpStatus.OK;
      if (result.nModified === user_ids.length) {
        message = "All provided users were successfully assigned.";
      } else {
        message = "Could not assign all provided users to the Role.";
        status = httpStatus.INTERNAL_SERVER_ERROR;
      }
      return {
        success: true,
        message,
        status,
      };
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

  listUsersWithRole: async (request) => {
    try {
      logText("listUsersWithRole...");
      let filter = {};
      const { query, params } = request;
      const { role_id } = params;
      const { tenant } = query;

      if (!isEmpty(role_id)) {
        filter["role"] = ObjectId(role_id);
      }

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

      const responseFromListAssignedUsers = await UserModel(tenant)
        .aggregate([
          {
            $match: {
              role: role_id,
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

      // Check if the role exists
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

      // Check if the user exists
      const userObject = await UserModel(tenant)
        .findById(user_id)
        .populate("role")
        .lean();
      logObject("userObject", userObject);

      if (isEmpty(userObject)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `provided User ${user_id.toString()} does not exist`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // check if User is not a super_admin
      if (
        userObject.role &&
        userObject.role.role_name.endsWith("SUPER_ADMIN")
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `SUPER_ADMIN User ${user_id.toString()} may not be unassigned from their role`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if user's role is pointing to a valid role ID
      if (isEmpty(userObject.role)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "User is not assigned to any role" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Check if the user is not assigned to the role
      if (
        userObject.role &&
        userObject.role._id.toString() !== role_id.toString()
      ) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `User ${user_id.toString()} is not assigned to the role ${role_id.toString()}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const updatedUser = await UserModel(tenant).findByIdAndUpdate(
        user_id,
        { $unset: { role: "" } },
        { new: true }
      );

      return {
        success: true,
        message: "User unassigned from the role",
        data: updatedUser,
        status: httpStatus.OK,
      };
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
  unAssignManyUsersFromRole: async (request) => {
    try {
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { user_ids } = body;

      // Check if the role exists
      const role = await RoleModel(tenant).findById(role_id).lean();
      if (!role) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Role not found" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check of all these provided users actually do exist?
      const existingUsers = await UserModel(tenant).find(
        { _id: { $in: user_ids } },
        "_id"
      );

      if (existingUsers.length !== user_ids.length) {
        const nonExistentUsers = user_ids.filter(
          (user_id) => !existingUsers.find((user) => user._id.equals(user_id))
        );

        return {
          success: false,
          message: `Bad Request Error`,
          errors: {
            message: `The following users do not exist: ${nonExistentUsers}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      //check if all the provided user_ids are assigned to the provided role?

      const usersAssignedToRole = await UserModel(tenant).find({
        _id: { $in: user_ids },
        role: { $all: role_id },
      });

      if (usersAssignedToRole.length !== user_ids.length) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Some of the provided User IDs are not assigned to this role ${role_id}`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const users = await Promise.all(
        user_ids.map((id) =>
          UserModel(tenant).findById(id).populate("role").lean()
        )
      );

      for (const user of users) {
        const role = user.role;
        if (!isEmpty(role) && role.role_name.endsWith("SUPER_ADMIN")) {
          logObject("");
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `Cannot unassign SUPER_ADMIN role from user ${user._id}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (isEmpty(user)) {
          return {
            success: false,
            message: "Bad Reqest Error",
            errors: { message: `One of the Users ${user._id} does not exist` },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (isEmpty(role)) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is not assigned to any role`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }

        if (!isEmpty(role) && role._id.toString() !== role_id.toString()) {
          return {
            success: false,
            message: "Bad Request Error",
            errors: {
              message: `User ${user._id.toString()} is not assigned to the role ${role_id.toString()}`,
            },
            status: httpStatus.BAD_REQUEST,
          };
        }
      }

      // Unassign the users from the role
      const result = await UserModel(tenant).updateMany(
        { _id: { $in: user_ids }, role: role_id },
        { $unset: { role: "" } }
      );

      let message = "";
      let status = httpStatus.OK;
      if (result.nModified === user_ids.length) {
        message = "All provided users were successfully unassigned.";
      } else {
        message = "Could not unassign all users from role.";
        status = httpStatus.INTERNAL_SERVER_ERROR;
      }
      return {
        success: true,
        message,
        status,
      };
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

  /********* groups  ******************************************/
  createGroup: async (request) => {
    try {
      const { body, query } = request;
      const { tenant } = query;
      let modifiedBody = Object.assign({}, body);

      const responseFromRegisterGroup = await GroupModel(
        tenant.toLowerCase()
      ).register(modifiedBody);

      logObject("responseFromRegisterGroup", responseFromRegisterGroup);

      if (responseFromRegisterGroup.success === true) {
        return responseFromRegisterGroup;
      } else if (responseFromRegisterGroup.success === false) {
        return responseFromRegisterGroup;
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
  updateGroup: async (request) => {
    try {
      const { body, query, params } = request;
      const { tenant } = query;
      let update = Object.assign({}, body);

      let filter = {};
      const responseFromGeneratefilter = generateFilter.groups(request);
      if (responseFromGeneratefilter.success === false) {
        return responseFromGeneratefilter;
      } else {
        filter = responseFromGeneratefilter.data;
      }

      const responseFromModifyGroup = await GroupModel(
        tenant.toLowerCase()
      ).modify({ update, filter });

      if (responseFromModifyGroup.success === true) {
        return responseFromModifyGroup;
      } else if (responseFromModifyGroup.success === false) {
        return responseFromModifyGroup;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      logObject("error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },
  deleteGroup: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      let filter = {};
      const responseFromGenerateFilter = generateFilter.groups(request);
      logObject("responseFromGenerateFilter", responseFromGenerateFilter);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
      }

      logObject("the filter", filter);

      const responseFromRemoveGroup = await GroupModel(
        tenant.toLowerCase()
      ).remove({ filter });

      logObject("responseFromRemoveGroup", responseFromRemoveGroup);

      if (responseFromRemoveGroup.success === true) {
        return responseFromRemoveGroup;
      } else if (responseFromRemoveGroup.success === false) {
        return responseFromRemoveGroup;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return {
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
        success: false,
      };
    }
  },
  listGroup: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      let filter = {};
      const responseFromGenerateFilter = generateFilter.groups(request);
      if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      } else {
        filter = responseFromGenerateFilter.data;
        logObject("filter", filter);
      }

      const responseFromListGroups = await GroupModel(
        tenant.toLowerCase()
      ).list({ filter, limit, skip });

      if (responseFromListGroups.success === true) {
        return responseFromListGroups;
      } else if (responseFromListGroups.success === false) {
        return responseFromListGroups;
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
