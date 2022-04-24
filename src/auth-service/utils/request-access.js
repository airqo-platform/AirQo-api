const UserSchema = require("../models/User");
const CandidateSchema = require("../models/Candidate");
const { getModelByTenant } = require("./multitenancy");
const { logObject, logElement, logText } = require("./log");
const mailer = require("../services/mailer");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
constants = require("../config/constants");
const jwt = require("jsonwebtoken");
const kickbox = require("kickbox")
  .client(`${constants.KICKBOX_API_KEY}`)
  .kickbox();
const log4js = require("log4js");
const logger = log4js.getLogger("request-access-util");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const joinUtil = require("./join-platform");

const request = {
  create: async (request, callback) => {
    try {
      const { firstName, email, tenant } = request;

      const token = jwt.sign({ email }, constants.JWT_SECRET);

      logObject("body", request);

      let candidateBody = request;
      candidateBody["confirmationCode"] = token;

      const responseFromCreateCandidate = await CandidateModel(tenant).register(
        request
      );

      if (responseFromCreateCandidate.success === true) {
        let createdCandidate = await responseFromCreateCandidate.data;
        const entity = "candidate";

        const responseFromSendEmail = await mailer.confirmEmail({
          firstName,
          email,
          entity,
          token,
        });
        callback(responseFromSendEmail);
      } else if (responseFromCreateCandidate.success === false) {
        callback(responseFromCreateCandidate);
      }
    } catch (e) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },

  confirmEmail: async (tenant, filter) => {
    try {
      let update = {
        is_email_verified: true,
        confirmationCode: "",
      };
      const responseFromUpdateCandidate = await request.update(
        tenant,
        filter,
        update,
        "verified"
      );

      if (responseFromUpdateCandidate.success === true) {
        return {
          success: true,
          message: "email successfully confirmed",
          data: responseFromUpdateCandidate.data,
          status: responseFromUpdateCandidate.status,
        };
      } else if (responseFromUpdateCandidate.success === false) {
        return {
          success: false,
          message: "invalid confirmation code or email is already verified",
          errors: responseFromUpdateCandidate.errors,
          status: responseFromUpdateCandidate.status,
        };
      }
    } catch (error) {
      logger.error(`the error --- ${error}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  list: async ({ tenant, filter, limit, skip }) => {
    try {
      const responseFromListCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });

      if (responseFromListCandidate.success === true) {
        return {
          success: true,
          message: responseFromListCandidate.message,
          data: responseFromListCandidate.data,
        };
      } else if (responseFromListCandidate.success === false) {
        const errors = responseFromListCandidate.errors
          ? responseFromListCandidate.errors
          : { message: "" };
        const status = responseFromListCandidate.status
          ? responseFromListCandidate.status
          : "";

        return {
          success: false,
          message: responseFromListCandidate.message,
          errors,
          status,
        };
      }
    } catch (e) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (tenant, filter, update, type) => {
    try {
      let responseFromModifyCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });

      if (responseFromModifyCandidate.success === true) {
        let candidate = responseFromModifyCandidate.data;

        const email = candidate.email,
          firstName = candidate.firstName,
          lastName = candidate.lastName,
          entity = "candidate",
          fields_updated = candidate.fields_updated
            ? candidate.fields_updated
            : {};

        let responseFromSendEmail = await mailer.update({
          email,
          firstName,
          lastName,
          type,
          entity,
          fields_updated,
        });

        if (responseFromSendEmail.success === true) {
          return responseFromModifyCandidate;
        } else if (responseFromSendEmail.success === false) {
          return responseFromSendEmail;
        }
      } else if (responseFromModifyCandidate.success === false) {
        return responseFromModifyCandidate;
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      };
    }
  },

  confirm: async (req) => {
    let {
      tenant,
      firstName,
      lastName,
      email,
      organization,
      long_organization,
      jobTitle,
      website,
      category,
      filter,
      description,
    } = req;
    try {
      let responseFromListCandidate = await request.list({ tenant, filter });
      logObject(
        "responseFromListCandidate during confirmation",
        responseFromListCandidate
      );

      if (
        responseFromListCandidate.success === true &&
        !isEmpty(responseFromListCandidate.data)
      ) {
        let responseFromGeneratePassword = joinUtil.createPassword(10);
        logObject("responseFromGeneratePassword", responseFromGeneratePassword);
        if (responseFromGeneratePassword.success === true) {
          let password = responseFromGeneratePassword.data;

          let requestBody = {
            tenant,
            firstName,
            lastName,
            email,
            organization,
            long_organization,
            jobTitle,
            website,
            password,
            description,
            category,
            privilege: "user",
            userName: email,
          };
          logObject("requestBody during confirmation", requestBody);

          /**
           * what if we take this process to the join util?
           *
           */

          let responseFromCreateUser = await UserModel(tenant).register(
            requestBody
          );
          logObject(
            "responseFromCreateUser during confirmation",
            responseFromCreateUser
          );
          let createdUser = await responseFromCreateUser.data;

          logObject("createdUser", createdUser);

          if (responseFromCreateUser.success === true) {
            let responseFromSendEmail = await mailer.user(
              firstName,
              lastName,
              email,
              password,
              tenant,
              "confirm"
            );
            logObject(
              "responseFromSendEmail during confirmation",
              responseFromSendEmail
            );
            if (responseFromSendEmail.success === true) {
              let responseFromDeleteCandidate = await request.delete(
                tenant,
                filter
              );
              if (responseFromDeleteCandidate.success === true) {
                return {
                  success: true,
                  message: "candidate successfully confirmed",
                  data: jsonifyCreatedUser,
                };
              } else if (responseFromDeleteCandidate.success === false) {
                if (responseFromDeleteCandidate.error) {
                  return {
                    success: false,
                    message: responseFromDeleteCandidate.message,
                    data: responseFromDeleteCandidate.data,
                    error: responseFromDeleteCandidate.error,
                  };
                } else {
                  return {
                    success: false,
                    message: responseFromDeleteCandidate.message,
                    data: responseFromDeleteCandidate.data,
                  };
                }
              }
            } else if (responseFromSendEmail.success === false) {
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
          }
          if (responseFromCreateUser.success === false) {
            if (responseFromCreateUser.error) {
              return {
                success: false,
                message: responseFromCreateUser.message,
                error: responseFromCreateUser.error,
              };
            } else {
              return {
                success: false,
                message: responseFromCreateUser.message,
              };
            }
          }
        }

        if (responseFromGeneratePassword.success === false) {
          if (responseFromGeneratePassword.error) {
            return {
              success: false,
              message: responseFromGeneratePassword.message,
              error: responseFromGeneratePassword.error,
            };
          } else {
            return {
              success: false,
              message: responseFromGeneratePassword.message,
            };
          }
        }
      }

      if (
        responseFromListCandidate.success === true &&
        isEmpty(responseFromListCandidate.data)
      ) {
        return {
          success: false,
          message: "the candidate does not exist",
        };
      }

      if (responseFromListCandidate.success === false) {
        if (responseFromListCandidate.error) {
          return {
            success: false,
            message: "unable to retrieve candidate",
            error: responseFromListCandidate.error,
          };
        } else {
          return {
            success: true,
            message: "unable to retrieve candidate",
          };
        }
      }
    } catch (e) {
      if (e.code === 11000) {
        return {
          success: false,
          message: "duplicate entry",
          error: e.keyValue,
          status: httpStatus.BAD_REQUEST,
        };
      }
      return {
        success: false,
        message: "util server error",
        error: e.message,
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (tenant, filter) => {
    try {
      let responseFromRemoveCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });

      if (responseFromRemoveCandidate.success === true) {
        return {
          success: true,
          message: responseFromRemoveCandidate.message,
          data: responseFromRemoveCandidate.data,
        };
      } else if (responseFromRemoveCandidate.success === false) {
        if (responseFromRemoveCandidate.error) {
          return {
            success: false,
            message: responseFromRemoveCandidate.message,
            error: responseFromRemoveCandidate.error,
          };
        } else {
          return {
            success: false,
            message: responseFromRemoveCandidate.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
};

module.exports = request;
