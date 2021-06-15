const UserSchema = require("../models/User");
const CandidateSchema = require("../models/Candidate");
const { getModelByTenant } = require("../utils/multitenancy");
const { logObject, logElement, logText } = require("../utils/log");
const mailer = require("../services/mailer");
const generatePassword = require("./generate-password");
var jsonify = require("./jsonify");
const generateFilter = require("./generate-filter");
const isEmpty = require("is-empty");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const request = {
  create: async (
    tenant,
    firstName,
    lastName,
    email,
    organization,
    jobTitle,
    website,
    description,
    category
  ) => {
    try {
      let requestBody = {
        firstName,
        lastName,
        email,
        organization,
        jobTitle,
        website,
        description,
        category,
      };

      let responseFromCreateCandidate =
        CandidateModel(tenant).register(requestBody);

      let createdCandidate = await responseFromCreateCandidate.data;
      let jsonifyCreatedCandidate = jsonify(createdCandidate);

      if (responseFromCreateCandidate.success == true) {
        let responseFromSendEmail = await mailer.candidate(
          firstName,
          lastName,
          email
        );
        if (responseFromSendEmail.success == true) {
          return {
            success: true,
            message: "candidate successfully created",
            data: jsonifyCreatedCandidate,
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
      } else {
        return {
          success: false,
          message: responseFromCreateCandidate.message,
        };
      }
    } catch (e) {
      logElement("server error in util", e.message);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
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

  confirm: async (
    tenant,
    firstName,
    lastName,
    email,
    organization,
    jobTitle,
    website,
    category,
    filter
  ) => {
    try {
      let response = {};

      /**
       * first check for the existence of the candidate
       * then generate the password and the candidate is available
       */

      logObject("the filter during confirmatiuon", filter);
      let responseFromListCandidate = await request.list({ tenant, filter });
      logObject(
        "responseFromListCandidate during confirmation",
        responseFromListCandidate
      );

      if (
        responseFromListCandidate.success == true &&
        !isEmpty(responseFromListCandidate.data)
      ) {
        let responseFromGeneratePassword = generatePassword();
        logObject("responseFromGeneratePassword", responseFromGeneratePassword);
        if (responseFromGeneratePassword.success == true) {
          let password = responseFromGeneratePassword.data;
          let requestBody = {
            tenant,
            firstName,
            lastName,
            email,
            organization,
            jobTitle,
            website,
            password,
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

          if (responseFromCreateUser.success == true) {
            /**
             * created user successfully and sent email success
             */
            let responseFromSendEmail = await mailer.user(
              firstName,
              lastName,
              email,
              password,
              tenant
            );
            logObject(
              "responseFromSendEmail during confirmation",
              responseFromSendEmail
            );
            if (responseFromSendEmail.success == true) {
              return {
                success: true,
                message: "candidate successfully confirmed",
                data: jsonifyCreatedUser,
              };
            } else if (responseFromSendEmail.success == false) {
              /**
               * created user but unable to send email
               */
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
          /**
           * unable to create user
           */
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

        if (responseFromGeneratePassword == false) {
          if (responseFromGeneratePassword.error) {
            response["success"] = false;
            response["message"] = responseFromGeneratePassword.message;
            response["error"] = responseFromGeneratePassword.error;
          } else {
            response["success"] = false;
            response["message"] = responseFromGeneratePassword.message;
          }
        }
      }

      if (
        responseFromListCandidate.success == true &&
        isEmpty(responseFromListCandidate.data)
      ) {
        (response["success"] = false),
          (response["message"] = "the candidate does not exist");
      }

      if (responseFromListCandidate.success == false) {
        if (responseFromListCandidate.error) {
          response["success"] = true;
          response["message"] = "candidate does not exist";
          response["error"] = responseFromListCandidate.error;
        } else {
          response["success"] = true;
          response["message"] = "candidate does not exist";
        }
      }
      return response;
    } catch (e) {
      return {
        success: false,
        message: "util server error",
        error: e.message,
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
