const PermissionSchema = require("@models/Permission");
const ScopeSchema = require("@models/Scope");
const ClientSchema = require("@models/Client");
const AccessTokenSchema = require("@models/AccessToken");
const UserSchema = require("@models/User");
const RoleSchema = require("@models/Role");
const DepartmentSchema = require("@models/Department");
const GroupSchema = require("@models/Group");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const accessCodeGenerator = require("generate-password");
const { getModelByTenant } = require("@config/dbConnection");
const { logObject, logElement, logText } = require("@utils/log");
const mailer = require("@utils/mailer");
const generateFilter = require("@utils/generate-filter");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const moment = require("moment-timezone");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- control-access-util`
);

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
            if (responseFromUpdateUser.status === httpStatus.NOT_FOUND) {
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
        constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_SECRET_LENGTH)
      );
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
      const client_secret = accessCodeGenerator
        .generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        )
        .toUpperCase();

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
      const update = body;
      const filter = generateFilter.roles(request);
      if (filter.success === false) {
        return filter;
      }
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
      const responseFromCreateRole = await RoleModel(
        tenant.toLowerCase()
      ).register(body);
      logObject("been able to create the damn role", responseFromCreateRole);
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

  listUserWithRole: async (req, res) => {
    try {
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsersForRole: async (request) => {
    try {
      logText("listAvailableUsersForRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, params } = request;
      const { role_id } = params;
      const { tenant } = query;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;

      function manipulateFilter(obj) {
        const newObj = {};
        for (var key in obj) {
          newObj[key] = { $ne: obj[key] };
        }
        return newObj;
      }

      const filterResponse = generateFilter.users(newRequest);
      if (filterResponse.success === false) {
        return filter;
      } else {
        filter = manipulateFilter(filterResponse.data);
      }

      logObject("filter", filter);

      const responseFromListAvailableUsersForRole = await UserModel(
        tenant
      ).list({
        skip,
        limit,
        filter,
      });

      logObject(
        "responseFromListAvailableUsersForRole",
        responseFromListAvailableUsersForRole
      );

      if (responseFromListAvailableUsersForRole.success === true) {
        return responseFromListAvailableUsersForRole;
      } else if (responseFromListAvailableUsersForRole.success === false) {
        return responseFromListAvailableUsersForRole;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToRole: async (request) => {
    try {
      logText("assignUserToRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { user } = body;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;

      filter = { _id: role_id };
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list({
        filter,
        skip,
        limit,
      });

      logObject("responseFromListRole", responseFromListRole);
      if (responseFromListRole.success === true) {
        if (responseFromListRole.status === httpStatus.NOT_FOUND) {
          return responseFromListRole;
        }
      } else if (responseFromListRole.success === false) {
        return responseFromListRole;
      }

      filter = { _id: user };
      const responseFromListUser = await UserModel(tenant).list({
        skip,
        limit,
        filter,
      });
      if (responseFromListUser.success === true) {
        const user = responseFromListUser.data[0];
        logObject("user", user);

        if (!isEmpty(user.role) && user.role.role_name === "admin") {
          logObject("user.role.role_name", user.role.role_name);
          return {
            success: false,
            message: "admin user may not be reassigned to a different role",
            status: httpStatus.BAD_REQUEST,
            errors: {
              message: "admin user may not be reassigned to a different role",
            },
          };
        }
      } else if (responseFromListUser.success === false) {
        return responseFromListUser;
      }

      const update = {
        role: role_id,
      };

      const responseFromUpdateUser = await UserModel(tenant).modify({
        update,
        filter,
      });

      if (responseFromUpdateUser.success === true) {
        if (responseFromUpdateUser.status === httpStatus.NOT_FOUND) {
          return responseFromUpdateUser;
        }
        let newResponse = Object.assign({}, responseFromUpdateUser);
        newResponse.message = "successfully assigned user to role";
        return newResponse;
      } else if (responseFromUpdateUser.success === false) {
        return responseFromUpdateUser;
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

  listUsersWithRole: async (request) => {
    try {
      logText("listUsersWithRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, body, params } = request;
      const { role_id } = params;
      const { tenant } = query;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;
      const filterResponse = generateFilter.users(newRequest);
      if (filterResponse.success === false) {
        return filter;
      } else {
        filter = filterResponse.data;
      }
      logObject("the filter", filter);

      const responseFromListUsersWithRole = await UserModel(tenant).list({
        skip,
        limit,
        filter,
      });

      logObject("responseFromListUsersWithRole", responseFromListUsersWithRole);

      if (responseFromListUsersWithRole.success === true) {
        return responseFromListUsersWithRole;
      } else if (responseFromListUsersWithRole.success === false) {
        return responseFromListUsersWithRole;
      }
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
      /**
       * logged in user needs to have the right permission to perform this
       * action
       *
       * send error message of 400 in case user was not assigned to that role
       */

      logText("the util for unAssignUserFromRole...");
      let filter = {};
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);
      const { query, params } = request;
      const { role_id, user_id } = params;
      const { tenant } = query;
      let newRequest = Object.assign({}, request);
      newRequest["query"]["role_id"] = role_id;

      filter = { _id: role_id };
      const responseFromListRole = await RoleModel(tenant.toLowerCase()).list({
        filter,
        skip,
        limit,
      });

      logObject("responseFromListRole", responseFromListRole);

      if (responseFromListRole.success === true) {
        if (responseFromListRole.status === httpStatus.NOT_FOUND) {
          return responseFromListRole;
        }
      } else if (responseFromListRole.success === false) {
        return responseFromListRole;
      }

      filter = { _id: user_id };
      const update = { $unset: { role: "" } };
      const responseFromUnAssignUserFromRole = await UserModel(tenant).modify({
        filter,
        update,
      });

      logObject(
        "responseFromUnAssignUserFromRole",
        responseFromUnAssignUserFromRole
      );

      if (responseFromUnAssignUserFromRole.success === true) {
        if (responseFromUnAssignUserFromRole.status === httpStatus.NOT_FOUND) {
          return responseFromUnAssignUserFromRole;
        }
        newResponse = Object.assign({}, responseFromUnAssignUserFromRole);
        newResponse.message = "successfully unassigned user from role";
        return newResponse;
      } else if (responseFromUnAssignUserFromRole.success === false) {
        return responseFromUnAssignUserFromRole;
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

      if (responseFromListAvailablePermissionsForRole.success === true) {
        if (
          responseFromListAvailablePermissionsForRole.status === httpStatus.OK
        ) {
          const permissions =
            responseFromListAvailablePermissionsForRole.data[0]
              .role_permissions;
          const permissionsArray = permissions.map((obj) => obj.permission);
          filter = { permission: { $nin: permissionsArray } };
          let responseFromListPermissions = await PermissionModel(tenant).list({
            skip,
            limit,
            filter,
          });
          return responseFromListPermissions;
        } else if (
          responseFromListAvailablePermissionsForRole.status ===
          httpStatus.NOT_FOUND
        ) {
          return responseFromListAvailablePermissionsForRole;
        }
      } else if (
        responseFromListAvailablePermissionsForRole.success === false
      ) {
        return responseFromListAvailablePermissionsForRole;
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

  assignPermissionToRole: async (request) => {
    try {
      logText("assignPermissionToRole...");
      let filter = {};
      let update = {};
      const { query, params, body } = request;
      const { role_id } = params;
      const { tenant } = query;
      const { permissions } = body;

      update.permissions = permissions;
      filter._id = role_id;

      const responseFromAssignPermissionToRole = await RoleModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromAssignPermissionToRole.success === true) {
        return responseFromAssignPermissionToRole;
      } else if (responseFromAssignPermissionToRole.success === false) {
        return responseFromAssignPermissionToRole;
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignPermissionFromRole: async (request) => {
    try {
      let filter = {};

      const { query, params } = request;
      const { role_id, permission_id } = params;
      const { tenant } = query;

      filter = { _id: role_id };
      const update = { $pull: { role_permissions: permission_id } };

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
        if (responseFromUnAssignPermissionFromRole.status === httpStatus.OK) {
          modifiedResponse.message = "permission has been unassigned from role";
          return modifiedResponse;
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
