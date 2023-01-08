const PermissionSchema = require("../models/Permission");
const AccessTokenSchema = require("../models/AccessToken");
const UserSchema = require("../models/User");
const RoleSchema = require("../models/Role");
const httpStatus = require("http-status");
const generateFilter = require("./generate-filter");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const createUserUtil = require("./create-user");
const msgTemplates = require("./email.templates");
const accessCodeGenerator = require("generate-password");

const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("./mailer");

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
    let tokens = mongoose.model("permissions");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "permission", PermissionSchema);
    return tokens;
  }
};

const RoleModel = (tenant) => {
  try {
    let tokens = mongoose.model("roles");
    return tokens;
  } catch (error) {
    let tokens = getModelByTenant(tenant, "role", RoleSchema);
    return tokens;
  }
};

const controlAccess = {
  verifyEmail: async (request) => {
    try {
      const { query, params } = request;
      const { tenant } = query;
      const { user_id, token } = params;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);

      let filter = { _id: user_id };

      let responseFromListUsers = await UserModel(tenant).list({
        filter,
        limit,
        skip,
      });

      logObject("responseFromListUsers", responseFromListUsers);

      if (responseFromListUsers.success === true) {
        if (responseFromListUsers.status === httpStatus.NO_CONTENT) {
          return {
            success: false,
            message: "invalid link",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "this is a bad request" },
          };
        } else if (responseFromListUsers.status === httpStatus.OK) {
          const user = responseFromListUsers.data[0];
          filter = { token };
          const responseFromListAccessToken = await AccessTokenModel(
            tenant
          ).list({ skip, limit, filter });

          logObject("responseFromListAccessToken", responseFromListAccessToken);

          if (responseFromListAccessToken.success === true) {
            if (responseFromListAccessToken.status === httpStatus.NO_CONTENT) {
              return {
                success: false,
                status: httpStatus.BAD_REQUEST,
                message: "Invalid link",
                errors: { message: "this is a bad request" },
              };
            } else if (responseFromListAccessToken.status === httpStatus.OK) {
              const password = accessCodeGenerator.generate(
                constants.RANDOM_PASSWORD_CONFIGURATION(10)
              );
              let update = { verified: true, password };
              filter = { _id: user_id };
              const responseFromUpdateUser = await UserModel(tenant).modify({
                filter,
                update,
              });

              logObject("responseFromUpdateUser", responseFromUpdateUser);
              if (responseFromUpdateUser.success === true) {
                filter = { token };
                logObject("the deletion of the token filter", filter);
                const responseFromDeleteToken = await AccessTokenModel(
                  tenant
                ).remove(filter);

                logObject("responseFromDeleteToken", responseFromDeleteToken);

                if (responseFromDeleteToken.success === true) {
                  const responseFromSendEmail =
                    await mailer.afterEmailVerification({
                      firstName: user.firstName,
                      username: user.userName,
                      password,
                      email: user.email,
                    });

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
            return {
              success: false,
              message: responseFromListAccessToken.message,
              errors: responseFromListAccessToken.errors
                ? responseFromListAccessToken.errors
                : httpStatus.INTERNAL_SERVER_ERROR,
              status: responseFromListAccessToken.status
                ? responseFromListAccessToken.status
                : httpStatus.OK,
            };
          }
        }
      } else if (responseFromListUsers.success === false) {
        return {
          success: false,
          message: responseFromListUsers.message,
          errors: responseFromListUsers.errors
            ? responseFromListUsers.errors
            : { message: "INTERNAL SERVER ERROR" },
          status: responseFromListUsers.status
            ? responseFromListUsers.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (error) {
      logObject("erroring in util", error);
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  /***hashing */
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
  /**access tokens */
  updateAccessToken: async (request) => {
    try {
      const { query, body } = request;
      const responseFromUpdateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
    } catch (error) {}
  },

  deleteAccessToken: async (request) => {
    try {
      const { query, body } = request;
      const responseFromDeleteToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).delete({ filter });
    } catch (error) {}
  },

  listAccessTokens: async (request) => {
    try {
      const { query, body } = request;
      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter });
    } catch (error) {}
  },

  createAccessTokens: async (request) => {
    try {
      const { query, body } = request;
      const responseFromCreateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).register(body);
    } catch (error) {
      return {
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      };
    }
  },

  /** roles */
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

  /***
   * others for role.....
   */
  listUserWithRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsersForRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignUserFromRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listPermissionsForRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailablePermissionsForRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignPermissionToRole: async (req, res) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  unAssignPermissionFromRole: async (request) => {
    try {
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  /** permissions */
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
      return responseFromListPermissions;
    } catch (error) {
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
      const responseFromListPermissions = await PermissionModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromListPermissions;
    } catch (error) {
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
      const responseFromUpdateRole = await PermissionModel(
        tenant.toLowerCase()
      ).modify({ filter, update });
      return responseFromUpdateRole;
    } catch (error) {
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
      return responseFromCreatePermission;
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = controlAccess;
