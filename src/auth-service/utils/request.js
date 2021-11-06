const UserSchema = require("../models/User");
const CandidateSchema = require("../models/Candidate");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("../services/mailer");
const generatePassword = require("./generate-password");
var jsonify = require("./jsonify");
const generateFilter = require("./generate-filter");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const validationsUtil = require("./validations");
constants = require("../config/constants");
const kickbox = require("kickbox")
  .client(`${constants.KICKBOX_API_KEY}`)
  .kickbox();

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const request = {
  create: async (request, callback) => {
    try {
      let {
        firstName,
        lastName,
        email,
        long_organization,
        jobTitle,
        website,
        description,
        category,
        tenant,
      } = request;

      await validationsUtil.doesEmailExist(email, (value) => {
        if (value.success == false) {
          const errors = value.errors ? value.errors : "";
          callback({
            success: false,
            message: value.message,
            errors,
            status: value.status,
          });
        }
      });

      const responseFromCreateCandidate = await CandidateModel(tenant).register(
        request
      );

      if (responseFromCreateCandidate.success === true) {
        let createdCandidate = await responseFromCreateCandidate.data;
        let responseFromSendEmail = await mailer.candidate(
          firstName,
          lastName,
          email,
          tenant
        );
        if (responseFromSendEmail.success === true) {
          const status = responseFromSendEmail.status
            ? responseFromSendEmail.status
            : "";
          callback({
            success: true,
            message: "candidate successfully created",
            data: createdCandidate,
            status,
          });
        }

        if (responseFromSendEmail.success === false) {
          const errors = responseFromSendEmail.error
            ? responseFromSendEmail.error
            : "";
          const status = responseFromSendEmail.status
            ? responseFromSendEmail.status
            : "";

          callback({
            success: false,
            message: responseFromSendEmail.message,
            errors,
            status,
          });
        }
      }

      if (responseFromCreateCandidate.success === false) {
        const errors = responseFromCreateCandidate.errors
          ? responseFromCreateCandidate.errors
          : "";
        const status = responseFromCreateCandidate.status
          ? responseFromCreateCandidate.status
          : "";
        callback({
          success: false,
          message: responseFromCreateCandidate.message,
          errors,
          status,
        });
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

  list: async ({ tenant, filter, limit, skip }) => {
    try {
      logElement("the tenant", tenant);
      logObject("the filter", filter);
      logElement("limit", limit);
      logElement("the skip", skip);

      let responseFromListCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });

      logObject(
        "responseFromListCandidate in the util",
        responseFromListCandidate
      );
      if (responseFromListCandidate.success == true) {
        return {
          success: true,
          message: responseFromListCandidate.message,
          data: responseFromListCandidate.data,
        };
      } else if (responseFromListCandidate.success == false) {
        if (responseFromListCandidate.error) {
          return {
            success: false,
            message: responseFromListCandidate.message,
            error: responseFromListCandidate.error,
          };
        } else {
          return {
            success: false,
            message: responseFromListCandidate.message,
          };
        }
      }
    } catch (e) {
      return {
        success: false,
        message: "utils server error",
        error: e.message,
      };
    }
  },

  update: async (tenant, filter, update) => {
    try {
      let responseFromModifyCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject("responseFromModifyCandidate", responseFromModifyCandidate);
      if (responseFromModifyCandidate.success == true) {
        return {
          success: true,
          message: responseFromModifyCandidate.message,
          data: responseFromModifyCandidate.data,
        };
      } else if (responseFromModifyCandidate.success == false) {
        if (responseFromModifyCandidate.error) {
          return {
            success: false,
            message: responseFromModifyCandidate.message,
            error: responseFromModifyCandidate.error,
          };
        } else {
          return {
            success: false,
            message: responseFromModifyCandidate.message,
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
        let responseFromGeneratePassword = generatePassword();
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

          let responseFromCreateUser = await UserModel(tenant).register(
            requestBody
          );
          logObject(
            "responseFromCreateUser during confirmation",
            responseFromCreateUser
          );
          let createdUser = await responseFromCreateUser.data;
          let jsonifyCreatedUser = jsonify(createdUser);
          logObject("jsonifyCreatedUser", jsonifyCreatedUser);

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
          if (responseFromCreateUser.success == false) {
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

        if (responseFromGeneratePassword === false) {
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

      if (responseFromRemoveCandidate.success == true) {
        return {
          success: true,
          message: responseFromRemoveCandidate.message,
          data: responseFromRemoveCandidate.data,
        };
      } else if (responseFromRemoveCandidate.success == false) {
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
