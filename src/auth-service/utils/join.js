const UserSchema = require("../models/User");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("../services/mailer");
const generatePassword = require("./generate-password");
const jsonify = require("./jsonify");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const constants = require("../config/constants");
const isEmpty = require("is-empty");
const HTTPStatus = require("http-status");
const emailExistence = require("email-existence");

const UserModel = (tenant) => {
  try {
    let users;
    users = mongoose.model("users");
    return users;
  } catch (error) {
    users = getModelByTenant(tenant, "user", UserSchema);
    return users;
  }
};

const join = {
  list: async (tenant, filter, limit, skip) => {
    try {
      let responseFromListUser = await UserModel(tenant).list({
        filter,
        limit,
        skip,
      });
      if (responseFromListUser.success == true) {
        return {
          success: true,
          message: responseFromListUser.message,
          data: responseFromListUser.data,
        };
      } else if ((responseFromListUser.success = false)) {
        if (responseFromListUser.error) {
          return {
            success: false,
            message: responseFromListUser.message,
            error: responseFromListUser.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListUser.message,
          };
        }
      }
    } catch (e) {
      logElement("list users util", e.message);
      return {
        success: false,
        message: "list users util server error",
        error: e.message,
      };
    }
  },
  doesEmailExist: (value) => {
    try {
      emailExistence.check(value, (error, response) => {
        if (response) {
          logText("the email does exist");
          return {
            success: true,
            message: "",
            data: response,
          };
        }
        if (error) {
          logText("the email does NOT exist");
          return {
            success: false,
            message: "",
            errors: {
              message: error.message,
            },
          };
        }
      });
    } catch (error) {
      logText("the email does NOT exist");
      return {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      };
    }
  },
  update: async (tenant, filter, update) => {
    try {
      // logObject("the filter sent to DB", filter);
      // logObject("the update sent to DB", update);
      let responseFromModifyUser = await UserModel(tenant.toLowerCase()).modify(
        {
          filter,
          update,
        }
      );
      // logObject("responseFromModifyUser", responseFromModifyUser);
      if (responseFromModifyUser.success == true) {
        let user = responseFromModifyUser.data;
        let responseFromSendEmail = await mailer.update(
          user.email,
          user.firstName,
          user.lastName
        );
        // logObject("responseFromSendEmail", responseFromSendEmail);
        if (responseFromSendEmail.success == true) {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: responseFromModifyUser.data,
          };
        } else if (responseFromSendEmail.success == false) {
          if (responseFromSendEmail.error) {
            return {
              success: false,
              message: responseFromSendEmail.message,
              error: responseFromSendEmail.error,
            };
          } else {
            return {
              success: false,
              message: responseFromSendEmail.message,
            };
          }
        }
      } else if (responseFromModifyUser.success == false) {
        if (responseFromModifyUser.error) {
          return {
            success: false,
            message: responseFromModifyUser.message,
            error: responseFromModifyUser.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifyUser.message,
          };
        }
      }
    } catch (e) {
      logElement("update users util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
  delete: async (tenant, filter) => {
    try {
      let responseFromRemoveUser = await UserModel(tenant.toLowerCase()).remove(
        {
          filter,
        }
      );
      if (responseFromRemoveUser.success == true) {
        return {
          success: true,
          message: responseFromRemoveUser.message,
          data: responseFromRemoveUser.data,
        };
      } else if (responseFromRemoveUser.success == false) {
        if (responseFromRemoveUser.error) {
          return {
            success: false,
            message: responseFromRemoveUser.message,
            error: responseFromRemoveUser.error,
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveUser.message,
          };
        }
      }
    } catch (e) {
      logElement("delete users util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },

  create: async (request) => {
    try {
      let {
        tenant,
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
      } = request;
      let response = {};
      logText("...........create user util...................");
      let responseFromGeneratePassword = generatePassword();
      logObject("responseFromGeneratePassword", responseFromGeneratePassword);
      if (responseFromGeneratePassword.success === true) {
        let password = responseFromGeneratePassword.data;
        let requestBody = {
          firstName,
          lastName,
          email,
          organization,
          long_organization,
          privilege,
          userName: email,
          password,
        };

        let responseFromCreateUser = await UserModel(tenant).register(
          requestBody
        );
        logObject("responseFromCreateUser", responseFromCreateUser);

        if (responseFromCreateUser.success === true) {
          let createdUser = await responseFromCreateUser.data;
          let jsonifyCreatedUser = jsonify(createdUser);
          logObject("created user in util", jsonifyCreatedUser);
          let responseFromSendEmail = await mailer.user(
            firstName,
            lastName,
            email,
            password,
            tenant,
            "user"
          );
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "user successfully created",
              data: jsonifyCreatedUser,
            };
          }

          if (responseFromSendEmail.success === false) {
            let status = responseFromSendEmail.status
              ? responseFromSendEmail.status
              : "";
            let error = responseFromSendEmail.error
              ? responseFromSendEmail.error
              : "";
            return {
              success: false,
              message: responseFromSendEmail.message,
              error,
              status,
            };
          }
        }

        if (responseFromCreateUser.success === false) {
          let error = responseFromCreateUser.error
            ? responseFromCreateUser.error
            : "";
          let status = responseFromCreateUser.status
            ? responseFromCreateUser.status
            : "";
          logElement("the error from the model", error);
          return {
            success: false,
            message: responseFromCreateUser.message,
            error,
            status,
          };
        }
      }

      if (responseFromGeneratePassword.success === false) {
        let error = responseFromGeneratePassword.error
          ? responseFromGeneratePassword.error
          : "";
        let status = responseFromGeneratePassword.status
          ? responseFromGeneratePassword.status
          : "";
        logElement("error when password generation fails", error);
        return {
          success: false,
          message: responseFromGeneratePassword.message,
          error,
          status,
        };
      }
    } catch (e) {
      logElement("create users util", e.message);
      logObject("create user util error", e);
      return {
        success: false,
        message: "util server error",
        error: e.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  confirmEmail: (tenant, filter) => {
    try {
      let responseFromListUser = join.list({ filter });
      if (responseFromListUser.success == true) {
        let responseFromUpdateUser = this.update(tenant, filter, update);
        if (responseFromUpdateUser.success == true) {
          return {
            success: true,
            message: "remail successfully confirmed",
            data: responseFromUpdateUser.data,
          };
        } else if (responseFromUpdateUser.success == false) {
          if (responseFromUpdateUser.error) {
            return {
              success: false,
              message: responseFromUpdateUser.message,
              error: responseFromUpdateUser.error,
            };
          } else {
            return {
              success: false,
              message: responseFromUpdateUser.message,
            };
          }
        }
      } else if (responseFromListUser.success == false) {
        if (responseFromListUser.error) {
          return {
            success: false,
            message: responseFromListUser.message,
            error: responseFromListUser.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListUser.message,
          };
        }
      }
    } catch (error) {
      logElement("confirm email util", error.message);
      return {
        success: false,
        message: "join util server error",
        error: error.message,
      };
    }
  },

  forgotPassword: async (tenant, filter) => {
    try {
      let responseFromGenerateResetToken = join.generateResetToken();
      logObject(
        "responseFromGenerateResetToken",
        responseFromGenerateResetToken
      );
      logObject("filter", filter);
      if (responseFromGenerateResetToken.success === true) {
        let token = responseFromGenerateResetToken.data;
        let update = {
          resetPasswordToken: token,
          resetPasswordExpires: Date.now() + 3600000,
        };
        let responseFromModifyUser = await UserModel(
          tenant.toLowerCase()
        ).modify({
          filter,
          update,
        });
        if (responseFromModifyUser.success === true) {
          let responseFromSendEmail = await mailer.forgot(
            filter.email,
            token,
            tenant
          );
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "forgot email successfully sent",
            };
          }

          if (responseFromSendEmail.success === false) {
            if (responseFromSendEmail.error) {
              return {
                success: false,
                error: responseFromSendEmail.error,
                message: "unable to send the email request",
              };
            } else {
              return {
                success: false,
                message: responseFromSendEmail.message,
              };
            }
          }
        }

        if (responseFromModifyUser.success === false) {
          if (responseFromModifyUser.error) {
            return {
              success: false,
              error: responseFromModifyUser.error,
              message: responseFromModifyUser.message,
            };
          } else {
            return {
              success: false,
              message: responseFromModifyUser.message,
            };
          }
        }
      }

      if (responseFromGenerateResetToken.success === false) {
        if (responseFromGenerateResetToken.error) {
          return {
            success: false,
            error: responseFromGenerateResetToken.error,
            message: responseFromGenerateResetToken.message,
          };
        } else {
          return {
            success: false,
            message: responseFromGenerateResetToken.message,
          };
        }
      }
    } catch (e) {
      logElement("forgot password util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },

  updateForgottenPassword: async (tenant, filter, update) => {
    try {
      let responseFromCheckTokenValidity = await join.isPasswordTokenValid(
        tenant.toLowerCase(),
        filter
      );
      logObject(
        "responseFromCheckTokenValidity",
        responseFromCheckTokenValidity
      );
      if (responseFromCheckTokenValidity.success == true) {
        let modifiedUpdate = {
          ...update,
          resetPasswordToken: null,
          resetPasswordExpires: null,
        };
        let responseFromUpdateUser = await join.update(
          tenant.toLowerCase(),
          filter,
          modifiedUpdate
        );
        logObject(
          "responseFromUpdateUser in update forgotten password",
          responseFromUpdateUser
        );
        if (responseFromUpdateUser.success == true) {
          return {
            success: true,
            message: responseFromUpdateUser.message,
            data: responseFromUpdateUser.data,
          };
        } else if (responseFromUpdateUser == false) {
          if (responseFromUpdateUser.error) {
            return {
              success: false,
              message: responseFromUpdateUser.message,
              error: responseFromUpdateUser.error,
            };
          } else {
            return {
              success: true,
              message: responseFromUpdateUser.message,
            };
          }
        }
      } else if (responseFromCheckTokenValidity.success == false) {
        if (responseFromCheckTokenValidity.error) {
          return {
            success: false,
            message: responseFromCheckTokenValidity.message,
            error: responseFromCheckTokenValidity.error,
          };
        } else {
          return {
            success: false,
            message: responseFromCheckTokenValidity.message,
          };
        }
      }
    } catch (error) {
      logElement("update forgotten password", error.message);
      return {
        success: false,
        message: "util server error",
        error: error.message,
      };
    }
  },

  updateKnownPassword: async (tenant, new_pwd, old_pwd, filter) => {
    try {
      logElement("the tenant", tenant);
      logElement("the old password", old_pwd);
      logElement("the new password ", new_pwd);
      logObject("the filter", filter);
      let responseFromComparePassword = await join.comparePasswords(
        filter,
        tenant,
        old_pwd
      );
      logObject("responseFromComparePassword", responseFromComparePassword);
      if (responseFromComparePassword.success == true) {
        let update = {
          password: new_pwd,
        };

        let responseFromUpdateUser = await join.update(tenant, filter, update);
        logObject("responseFromUpdateUser", responseFromUpdateUser);
        if (responseFromUpdateUser.success == true) {
          return {
            success: true,
            message: responseFromUpdateUser.message,
            data: responseFromUpdateUser.data,
          };
        } else if (responseFromUpdateUser.success == false) {
          if (responseFromUpdateUser.error) {
            return {
              success: false,
              message: responseFromUpdateUser.message,
              error: responseFromUpdateUser.error,
            };
          } else {
            return {
              success: false,
              message: responseFromUpdateUser.message,
            };
          }
        }
      } else if (responseFromComparePassword.success == false) {
        if (responseFromComparePassword.error) {
          return {
            success: false,
            message: responseFromComparePassword.message,
            error: responseFromComparePassword.error,
          };
        } else {
          return {
            success: false,
            message: responseFromComparePassword.message,
          };
        }
      }
    } catch (e) {
      logElement("update known password", e.message);
      return {
        success: false,
        message: "update known password util server error",
        error: e.message,
      };
    }
  },
  comparePasswords: async (filter, tenant, old_pwd) => {
    try {
      let user = await UserModel(tenant).findOne(filter).exec();
      if (!isEmpty(user)) {
        let responseFromBcrypt = await bcrypt.compare(
          old_pwd,
          user._doc.password
        );
        if (responseFromBcrypt == true) {
          return {
            success: true,
            message: "the passwords match",
          };
        } else if (responseFromBcrypt == false) {
          return {
            message:
              "either your old password is incorrect or the provided user does not exist",
            success: false,
          };
        }
      } else {
        return {
          success: false,
          message: "unable to find this user",
        };
      }
    } catch (error) {
      logElement("compare passwords util server error", error.message);
      return {
        success: false,
        message: "compare passwords utils server error",
        error: error.message,
      };
    }
  },
  generateResetToken: () => {
    try {
      const token = crypto.randomBytes(20).toString("hex");
      return {
        success: true,
        message: "token generated successfully",
        data: token,
      };
    } catch (error) {
      logElement("generate reset token util", error.message);
      return {
        success: false,
        message: "util server error",
        error: error.message,
      };
    }
  },

  isPasswordTokenValid: async (tenant, filter) => {
    try {
      let responseFromListUser = await UserModel(tenant.toLowerCase()).list({
        filter,
      });
      logObject("responseFromListUser", responseFromListUser);
      // logObject("the filter", filter);
      if (responseFromListUser.success == true) {
        if (isEmpty(responseFromListUser.data)) {
          return {
            success: false,
            message: "password reset link is invalid or has expired",
          };
        } else {
          return {
            success: true,
            message: responseFromListUser.message,
            data: responseFromListUser.data,
          };
        }
      } else if (responseFromListUser.success == false) {
        if (responseFromListUser.error) {
          return {
            success: false,
            message: responseFromListUser.message,
            error: responseFromListUser.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListUser.message,
          };
        }
      }
    } catch (error) {
      logElement("is password token valid", error.message);
      return {
        success: false,
        message: "util server error",
        error: error.message,
      };
    }
  },
};

module.exports = join;
