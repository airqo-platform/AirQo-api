const UserSchema = require("@models/User");
const LogSchema = require("@models/Log");
const AccessTokenSchema = require("@models/AccessToken");
const ClientSchema = require("@models/Client");
const { getModelByTenant } = require("@config/dbConnection");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const bcrypt = require("bcrypt");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const crypto = require("crypto");
const isEmpty = require("is-empty");
const { getAuth, sendSignInLinkToEmail } = require("firebase-admin/auth");
const actionCodeSettings = require("@config/firebase-settings");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const mailchimp = require("@config/mailchimp");
const md5 = require("md5");
const accessCodeGenerator = require("generate-password");
const generateFilter = require("./generate-filter");
const moment = require("moment-timezone");

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

const LogModel = (tenant) => {
  try {
    const logs = mongoose.model("logs");
    return logs;
  } catch (error) {
    const logs = getModelByTenant(tenant, "log", LogSchema);
    return logs;
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
  listLogs: async (tenant) => {
    try {
      const responseFromListLogs = await LogModel(tenant).list(tenant);
      if (responseFromListLogs.success === true) {
        return {
          success: true,
          message: responseFromListLogs.message,
          data: responseFromListLogs.data,
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.OK,
        };
      } else if (responseFromListLogs.success === false) {
        return {
          success: false,
          message: responseFromListLogs.message,
          errors: responseFromListLogs.errors
            ? responseFromListLogs.errors
            : { message: "Internal Server Error" },
          status: responseFromListLogs.status
            ? responseFromListLogs.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (e) {
      logElement("list users util", e.message);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },
  listStatistics: async (tenant) => {
    try {
      const responseFromListStatistics = await UserModel(tenant).listStatistics(
        tenant
      );
      if (responseFromListStatistics.success === true) {
        return {
          success: true,
          message: responseFromListStatistics.message,
          data: responseFromListStatistics.data,
          status: responseFromListStatistics.status
            ? responseFromListStatistics.status
            : httpStatus.OK,
        };
      } else if (responseFromListStatistics.success === false) {
        return {
          success: false,
          message: responseFromListStatistics.message,
          errors: responseFromListStatistics.errors
            ? responseFromListStatistics.errors
            : { message: "Internal Server Error" },
          status: responseFromListStatistics.status
            ? responseFromListStatistics.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (e) {
      logElement("list users util", e.message);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },

  list: async (tenant, filter, limit, skip) => {
    try {
      const responseFromListUser = await UserModel(tenant).list({
        filter,
        limit,
        skip,
      });
      if (responseFromListUser.success === true) {
        return {
          success: true,
          message: responseFromListUser.message,
          data: responseFromListUser.data,
          status: responseFromListUser.status
            ? responseFromListUser.status
            : httpStatus.OK,
        };
      } else if (responseFromListUser.success === false) {
        return {
          success: false,
          message: responseFromListUser.message,
          errors: responseFromListUser.errors
            ? responseFromListUser.errors
            : { message: "Internal Server Error" },
          status: responseFromListUser.status
            ? responseFromListUser.status
            : httpStatus.INTERNAL_SERVER_ERROR,
        };
      }
    } catch (e) {
      logElement("list users util", e.message);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      };
    }
  },
  update: async (request) => {
    try {
      let filter = {};
      const { query, body } = request;
      let update = body;

      if (!isEmpty(update.password)) {
        delete update.password;
      }
      if (!isEmpty(update._id)) {
        delete update._id;
      }

      const { tenant } = query;

      const responseFromGenerateFilter = generateFilter.users(request);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      } else if (responseFromGenerateFilter.success === false) {
        return responseFromGenerateFilter;
      }

      const responseFromModifyUser = await UserModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyUser.success === true) {
        const user = responseFromModifyUser.data;
        const responseFromSendEmail = await mailer.update(
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
          } else if (responseFromSendEmail.success === false) {
            callback({
              success: false,
              message: "email sending process unsuccessful",
              errors: responseFromSendEmail.errors,
              status: httpStatus.INTERNAL_SERVER_ERROR,
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
      const responseFromSendEmail = await mailer.feedback({
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
        return responseFromSendEmail;
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
        const responseFromSendEmail = await mailer.user(
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
          return responseFromSendEmail;
        }
      } else if (responseFromCreateUser.success === false) {
        return responseFromCreateUser;
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
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
      const responseFromGenerateResetToken = join.generateResetToken();
      logObject(
        "responseFromGenerateResetToken",
        responseFromGenerateResetToken
      );
      logObject("filter", filter);
      if (responseFromGenerateResetToken.success === true) {
        const token = responseFromGenerateResetToken.data;
        const update = {
          resetPasswordToken: token,
          resetPasswordExpires: Date.now() + 3600000,
        };
        const responseFromModifyUser = await UserModel(
          tenant.toLowerCase()
        ).modify({
          filter,
          update,
        });
        if (responseFromModifyUser.success === true) {
          const responseFromSendEmail = await mailer.forgot(
            filter.email,
            token,
            tenant
          );
          logObject("responseFromSendEmail", responseFromSendEmail);
          if (responseFromSendEmail.success === true) {
            return {
              success: true,
              message: "forgot email successfully sent",
              status: httpStatus.OK,
            };
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromModifyUser.success === false) {
          return responseFromModifyUser;
        }
      } else if (responseFromGenerateResetToken.success === false) {
        return responseFromGenerateResetToken;
      }
    } catch (e) {
      logElement("forgot password util", e.message);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  updateForgottenPassword: async (request) => {
    try {
      const { tenant, body } = request;
      const { resetPasswordToken } = body;
      const timeZone = moment.tz.guess();
      let filter = {
        resetPasswordToken,
        resetPasswordExpires: {
          $gt: moment().tz(timeZone).toDate(),
        },
      };

      logObject("isPasswordTokenValid FILTER", filter);
      const responseFromCheckTokenValidity = await join.isPasswordTokenValid({
        tenant,
        filter,
      });

      logObject(
        "responseFromCheckTokenValidity",
        responseFromCheckTokenValidity
      );

      if (responseFromCheckTokenValidity.success === true) {
        const update = {
          resetPasswordToken: null,
          resetPasswordExpires: null,
        };
        const userDetails = responseFromCheckTokenValidity.data;
        filter = { _id: ObjectId(userDetails._id) };
        logObject("updateForgottenPassword FILTER", filter);
        const responseFromModifyUser = await UserModel(tenant).modify({
          filter,
          update,
        });
        return responseFromModifyUser;
      } else if (responseFromCheckTokenValidity.success === false) {
        return responseFromCheckTokenValidity;
      }
    } catch (error) {
      logObject("error updateForgottenPassword UTIL", error);
      return {
        success: false,
        message: "util server error",
        errors: { message: error.message },
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

  isPasswordTokenValid: async ({ tenant = "airqo", filter = {} } = {}) => {
    try {
      const responseFromListUser = await UserModel(tenant.toLowerCase()).list({
        filter,
      });
      logObject("responseFromListUser", responseFromListUser);
      if (responseFromListUser.success === true) {
        if (
          isEmpty(responseFromListUser.data) ||
          responseFromListUser.data.length > 1
        ) {
          return {
            status: httpStatus.BAD_REQUEST,
            success: false,
            message: "password reset link is invalid or has expired",
            errors: {
              message: "password reset link is invalid or has expired",
            },
          };
        } else if (responseFromListUser.data.length === 1) {
          return {
            success: true,
            message: "password reset link is valid",
            status: httpStatus.OK,
            data: responseFromListUser.data[0],
          };
        }
      } else if (responseFromListUser.success === false) {
        return responseFromListUser;
      }
    } catch (error) {
      return {
        status: httpStatus.INTERNAL_SERVER_ERROR,
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
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
          status: httpStatus.INTERNAL_SERVER_ERROR,
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
