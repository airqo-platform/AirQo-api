const UserSchema = require("../models/User");
const AccessTokenSchema = require("@models/AccessToken");
const ClientSchema = require("@models/Client");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const bcrypt = require("bcrypt");
const crypto = require("crypto");
const isEmpty = require("is-empty");
const { getAuth, sendSignInLinkToEmail } = require("firebase-admin/auth");
const actionCodeSettings = require("../config/firebase-settings");
const httpStatus = require("http-status");
const constants = require("../config/constants");
const mailchimp = require("../config/mailchimp");
const md5 = require("md5");
const accessCodeGenerator = require("generate-password");
const generateFilter = require("./generate-filter");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- join-util`);

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

const ClientModel = (tenant) => {
  try {
    let clients = mongoose.model("clients");
    return clients;
  } catch (error) {
    let clients = getModelByTenant(tenant, "client", ClientSchema);
    return clients;
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
      if (responseFromListUser.success === true) {
        const status = responseFromListUser.status
          ? responseFromListUser.status
          : httpStatus.OK;
        return {
          success: true,
          message: responseFromListUser.message,
          data: responseFromListUser.data,
          status,
        };
      } else if (responseFromListUser.success === false) {
        const status = responseFromListUser.status
          ? responseFromListUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListUser.errors
          ? responseFromListUser.errors
          : { message: "Internal Server Error" };

        return {
          success: false,
          message: responseFromListUser.message,
          errors,
          status,
        };
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
  update: async (request) => {
    try {
      let filter = {};
      const { query, body } = request;
      let update = body;
      delete update.password;
      delete update._id;
      const { tenant } = query;

      const responseFromGenerateFilter = generateFilter.users(request);
      logObject("responseFromGenerateFilter", responseFromGenerateFilter);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      } else if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      }
      let responseFromModifyUser = await UserModel(tenant.toLowerCase()).modify(
        {
          filter,
          update,
        }
      );
      if (responseFromModifyUser.success === true) {
        let user = responseFromModifyUser.data;
        let responseFromSendEmail = await mailer.update(
          user.email,
          user.firstName,
          user.lastName
        );

        if (responseFromSendEmail.success === true) {
          return {
            success: true,
            message: responseFromModifyUser.message,
            data: responseFromModifyUser.data,
          };
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
        }
      } else if (responseFromModifyUser.success === false) {
        return responseFromModifyUser;
      }
    } catch (e) {
      logElement("update users util", e);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },

  lookUpFirebaseUser: async (request, callback) => {
    try {
      const { body } = request;
      const { email, phoneNumber, providerId, providerUid } = body;
      let userIndetificationArray = [];
      if (isEmpty(email) && !isEmpty(phoneNumber)) {
        userIndetificationArray.push({ phoneNumber });
      } else if (!isEmpty(email) && isEmpty(phoneNumber)) {
        userIndetificationArray.push({ email });
      } else {
        userIndetificationArray.push({ phoneNumber });
        userIndetificationArray.push({ email });
      }
      return getAuth()
        .getUsers(userIndetificationArray)
        .then(async (getUsersResult) => {
          logObject("getUsersResult", getUsersResult);
          getUsersResult.users.forEach((userRecord) => {
            callback({
              success: true,
              message: "Successfully fetched user data",
              status: httpStatus.OK,
              data: [],
            });
          });

          getUsersResult.notFound.forEach((user_identifier) => {
            callback({
              success: false,
              message:
                "Unable to find users corresponding to these identifiers",
              status: httpStatus.NOT_FOUND,
              data: user_identifier,
            });
          });
        })
        .catch((error) => {
          let status = httpStatus.INTERNAL_SERVER_ERROR;

          if (error.code === "auth/invalid-email") {
            status = httpStatus.BAD_REQUEST;
          }
          callback({
            success: false,
            message: "internal server error",
            status,
            errors: {
              message: error,
            },
          });
        });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      });
    }
  },

  generateSignInWithEmailLink: async (request, callback) => {
    try {
      const { body, query } = request;
      const { email } = body;
      const { purpose } = query;

      return getAuth()
        .generateSignInWithEmailLink(email, actionCodeSettings)
        .then(async (link) => {
          let linkSegments = link.split("%").filter((segment) => segment);
          const indexBeforeCode = linkSegments.indexOf("26oobCode", 0);
          const indexOfCode = indexBeforeCode + 1;
          let emailLinkCode = linkSegments[indexOfCode].substring(2);

          let responseFromSendEmail = {};
          let token = 100000;
          if (email !== constants.EMAIL) {
            token = Math.floor(Math.random() * (999999 - 100000) + 100000);
          }
          if (purpose === "auth") {
            responseFromSendEmail = await mailer.authenticateEmail(
              email,
              token
            );
          }
          if (purpose === "login") {
            responseFromSendEmail = await mailer.signInWithEmailLink(
              email,
              token
            );
          }

          if (responseFromSendEmail.success === true) {
            callback({
              success: true,
              message: "process successful, check your email for token",
              status: httpStatus.OK,
              data: {
                link,
                token,
                email,
                emailLinkCode,
              },
            });
          }

          if (responseFromSendEmail.success === false) {
            callback({
              success: false,
              message: "email sending process unsuccessful",
              errors: responseFromSendEmail.errors,
              status: httpStatus.BAD_GATEWAY,
            });
          }
        })
        .catch((error) => {
          logObject("the error", error);
          let status = httpStatus.INTERNAL_SERVER_ERROR;

          if (error.code === "auth/invalid-email") {
            status = httpStatus.BAD_REQUEST;
          }
          callback({
            success: false,
            message: "unable to sign in using email link",
            status,
            errors: {
              message: error,
            },
          });
        });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: error.message,
        },
      });
    }
  },
  delete: async (tenant, filter) => {
    try {
      let responseFromRemoveUser = await UserModel(tenant.toLowerCase()).remove(
        {
          filter,
        }
      );

      /**
       * cascase delete of user details...
       */
      // let responseFromRemoveUser = await UserModel(
      //   tenant.toLowerCase()
      // ).v2_remove({
      //   filter,
      // });

      if (responseFromRemoveUser.success == true) {
        return {
          success: true,
          message: responseFromRemoveUser.message,
          data: responseFromRemoveUser.data,
          status: responseFromRemoveUser.status
            ? responseFromRemoveUser.status
            : "",
        };
      } else if (responseFromRemoveUser.success == false) {
        if (responseFromRemoveUser.error) {
          return {
            success: false,
            message: responseFromRemoveUser.message,
            error: responseFromRemoveUser.error
              ? responseFromRemoveUser.error
              : "",
            status: responseFromRemoveUser.status
              ? responseFromRemoveUser.status
              : "",
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveUser.message,
            status: responseFromRemoveUser.status
              ? responseFromRemoveUser.status
              : "",
          };
        }
      }
    } catch (e) {
      logElement("delete users util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  sendFeedback: async ({ email, message, subject }) => {
    try {
      let responseFromSendEmail = await mailer.feedback({
        email,
        message,
        subject,
      });

      logObject("responseFromSendEmail ....", responseFromSendEmail);

      if (responseFromSendEmail.success === true) {
        return {
          success: true,
          message: "email successfully sent",
        };
      } else if (responseFromSendEmail.success === false) {
        let status = responseFromSendEmail.status
          ? responseFromSendEmail.status
          : "";
        let errors = responseFromSendEmail.errors
          ? responseFromSendEmail.errors
          : "";
        return {
          success: false,
          message: responseFromSendEmail.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  create: async (request) => {
    try {
      const { tenant, firstName, email, network_id } = request;
      const password = accessCodeGenerator.generate(
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

          let responseFromSendEmail = await mailer.verifyEmail({
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
            return {
              success: false,
              message: responseFromSendEmail.message,
              errors: responseFromSendEmail.errors
                ? responseFromSendEmail.errors
                : "",
              status: responseFromSendEmail.status
                ? responseFromSendEmail.status
                : "",
            };
          }
        } else if (responseFromSaveToken.success === false) {
          return {
            success: false,
            message: responseFromSaveToken.message,
            status: responseFromSaveToken.status
              ? responseFromSaveToken.status
              : "",
            errors: responseFromSaveToken.errors
              ? responseFromSaveToken.errors
              : "",
          };
        }
      } else if (responseFromCreateUser.success === false) {
        return {
          success: false,
          message: responseFromCreateUser.message,
          errors: responseFromCreateUser.error
            ? responseFromCreateUser.error
            : "",
          status: responseFromCreateUser.status
            ? responseFromCreateUser.status
            : "",
        };
      }
    } catch (e) {
      logObject("e", e);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  register: async (request) => {
    try {
      let {
        tenant,
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
        network_id,
      } = request;

      const password = accessCodeGenerator.generate(
        constants.RANDOM_PASSWORD_CONFIGURATION(10)
      );

      let requestBody = {
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
        userName: email,
        password,
        network_id,
      };

      const responseFromCreateUser = await UserModel(tenant).register(
        requestBody
      );

      if (responseFromCreateUser.success === true) {
        const createdUser = await responseFromCreateUser.data;
        logObject("created user in util", createdUser._doc);
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
            data: createdUser._doc,
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : "",
          };
        } else if (responseFromSendEmail.success === false) {
          return {
            success: false,
            message: responseFromSendEmail.message,
            error: responseFromSendEmail.error
              ? responseFromSendEmail.error
              : "",
            status: responseFromSendEmail.status
              ? responseFromSendEmail.status
              : "",
          };
        }
      } else if (responseFromCreateUser.success === false) {
        return {
          success: false,
          message: responseFromCreateUser.message,
          error: responseFromCreateUser.error
            ? responseFromCreateUser.error
            : "",
          status: responseFromCreateUser.status
            ? responseFromCreateUser.status
            : "",
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
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
          } else if (responseFromSendEmail.success === false) {
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
      } else if (responseFromGenerateResetToken.success === false) {
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
      if (responseFromCheckTokenValidity.success === true) {
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
        if (responseFromUpdateUser.success === true) {
          return {
            success: true,
            message: responseFromUpdateUser.message,
            data: responseFromUpdateUser.data,
          };
        } else if (responseFromUpdateUser === false) {
          return {
            success: false,
            status: responseFromUpdateUser.status
              ? responseFromUpdateUser.status
              : "",
            message: responseFromUpdateUser.message
              ? responseFromUpdateUser.message
              : "",
            error: responseFromUpdateUser.error
              ? responseFromUpdateUser.error
              : "",
          };
        }
      } else if (responseFromCheckTokenValidity.success === false) {
        return {
          success: false,
          status: responseFromCheckTokenValidity.status
            ? responseFromCheckTokenValidity.status
            : "",
          message: responseFromCheckTokenValidity.message
            ? responseFromCheckTokenValidity.message
            : "",
          error: responseFromCheckTokenValidity.error
            ? responseFromCheckTokenValidity.error
            : "",
        };
      }
    } catch (error) {
      logElement("update forgotten password", error.message);
      return {
        success: false,
        message: "util server error",
        error: error.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
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

  subscribeToNewsLetter: async (request) => {
    try {
      const { email, tags } = request.body;

      const subscriberHash = md5(email);
      const listId = constants.MAILCHIMP_LIST_ID;

      const responseFromMailChimp = await mailchimp.lists.setListMember(
        listId,
        subscriberHash,
        { email_address: email, status_if_new: "subscribed" }
      );
      const existingTags = responseFromMailChimp.tags.map((tag) => tag.name);

      const allUniqueTags = [...new Set([...existingTags, ...tags])];
      const formattedTags = allUniqueTags.map((tag) => {
        return {
          name: tag,
          status: "active",
        };
      });

      const responseFromUpdateSubscriberTags =
        await mailchimp.lists.updateListMemberTags(
          constants.MAILCHIMP_LIST_ID,
          subscriberHash,
          {
            body: {
              tags: formattedTags,
            },
          }
        );

      if (responseFromUpdateSubscriberTags === null) {
        return {
          success: true,
          status: httpStatus.OK,
          message:
            "successfully subscribed the email address to the AirQo newsletter",
        };
      } else {
        return {
          success: false,
          status: httpStatus.BAD_GATEWAY,
          message: "unable to subscribe user to the AirQo newsletter",
          errors: {
            message:
              "unable to Update Subsriber Tags for the newsletter subscription",
          },
        };
      }
    } catch (error) {
      const errorResponse = error.response ? error.response : {};
      const text = errorResponse ? errorResponse.text : "";
      const status = errorResponse
        ? errorResponse.status
        : httpStatus.INTERNAL_SERVER_ERROR;
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message, more: text },
        status,
      };
    }
  },
};

module.exports = join;
