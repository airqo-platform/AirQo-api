const PermissionSchema = require("../models/Permission");
const AccessTokenSchema = require("../models/AccessToken");
const UserSchema = require("../models/User");
const RoleSchema = require("../models/Role");
const httpStatus = require("http-status");
const mongoose = require("mongoose").set("debug", true);
const accessCodeGenerator = require("generate-password");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("./mailer");
const generateFilter = require("@utils/generate-filter");
const { compareSync } = require("bcrypt");

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
  /*** email verification *******************************************/
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
          filter = {
            token,
            expires: {
              $gt: Date.now(),
            },
          };
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
        .generate(constants.RANDOM_PASSWORD_CONFIGURATION(16))
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
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  listAccessToken: async (request) => {
    try {
      const { query } = request;
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
      logObject("the filter man!", filter);
      const responseFromListToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).list({ skip, limit, filter });
      if (responseFromListToken.success === true) {
        return responseFromListToken;
      } else if (responseFromListToken.success === false) {
        return responseFromListToken;
      }
    } catch (error) {
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
        .generate(constants.RANDOM_PASSWORD_CONFIGURATION(16))
        .toUpperCase();

      let modifiedBody = Object.assign({}, body);
      modifiedBody["token"] = token;

      const responseFromCreateToken = await AccessTokenModel(
        tenant.toLowerCase()
      ).register(modifiedBody);

      if (responseFromCreateToken.success === true) {
        return responseFromCreateToken;
      } else if (responseFromCreateToken.success === false) {
        return responseFromCreateToken;
      }
    } catch (error) {
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
      /**
       * list users who are not assigned that role
       * use an appropriate Mongo DB filter for this
       */
      const responseFromListAvailableUsersForRole = {};
      if (responseFromListAvailableUsersForRole.success === true) {
        return responseFromListAvailableUsersForRole;
      } else if (responseFromListAvailableUsersForRole.success === false) {
        return responseFromListAvailableUsersForRole;
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignUserToRole: async (request) => {
    try {
      /**
       * just update the user's role
       * Note that the "admin" user may not be reassigned to a different role
       */
      const responseFromUpdateUser = {};
      if (responseFromUpdateUser.success === true) {
        return responseFromUpdateUser;
      } else if (responseFromUpdateUser.success === false) {
        return responseFromUpdateUser;
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  sample: async (request) => {
    try {
    } catch (error) {
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
      const responseFromListUsersWithRole = {};
      if (responseFromListUsersWithRole.success === true) {
        return responseFromListUsersWithRole;
      } else if (responseFromListUsersWithRole.success === false) {
        return responseFromListUsersWithRole;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal Server Error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  unAssignUserFromRole: async (req, res) => {
    try {
      /**
       * logged in user needs to have the right permission to perform this
       * action
       *
       * send error message of 400 in case user was not assigned to that role
       */
      const responseFromunAssignUserFromRole = {};
      if (responseFromunAssignUserFromRole.success === true) {
        return responseFromunAssignUserFromRole;
      } else if (responseFromunAssignUserFromRole.success === false) {
        return responseFromunAssignUserFromRole;
      }
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
      const responseFromlistPermissionsForRole = {};
      if (responseFromlistPermissionsForRole.success === true) {
        return responseFromlistPermissionsForRole;
      } else if (responseFromlistPermissionsForRole.success === false) {
        return responseFromlistPermissionsForRole;
      }
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
      const responseFromListAvailablePermissionsForRole = {};
      if (responseFromListAvailablePermissionsForRole.success === true) {
        return responseFromListAvailablePermissionsForRole;
      } else if (
        responseFromListAvailablePermissionsForRole.success === false
      ) {
        return responseFromListAvailablePermissionsForRole;
      }
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
      const responseFromAssignPermissionToRole = {};
      if (responseFromAssignPermissionToRole.success === true) {
        return responseFromAssignPermissionToRole;
      } else if (responseFromAssignPermissionToRole.success === false) {
        return responseFromAssignPermissionToRole;
      }
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
      const responseFromUnAssignPermissionFromRole = {};
      if (responseFromUnAssignPermissionFromRole.success === true) {
        return responseFromUnAssignPermissionFromRole;
      } else if (responseFromUnAssignPermissionFromRole.success === false) {
        return responseFromUnAssignPermissionFromRole;
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
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
