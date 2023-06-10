const UserSchema = require("../models/User");
const CandidateSchema = require("../models/Candidate");
const { getModelByTenant } = require("@config/dbConnection");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
constants = require("../config/constants");
const accessCodeGenerator = require("generate-password");

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- request-access-util`
);

const requestAccess = {
  create: async (req, callback) => {
    try {
      let { firstName, lastName, email, tenant } = req;

      // await validationsUtil.checkEmailExistenceUsingKickbox(email, (value) => {
      //   if (value.success == false) {
      //     const errors = value.errors ? value.errors : { message: "Internal Server Error" };
      //     logObject("the validation checks results", {
      //       success: false,
      //       message: value.message,
      //       errors,
      //       status: value.status,
      //     });
      //     callback({
      //       success: false,
      //       message: value.message,
      //       errors,
      //       status: value.status,
      //     });
      //   }
      // });

      let filter = { email };

      const responseFromListCandidates = await CandidateModel(
        tenant.toLowerCase()
      ).list({
        filter,
      });

      logObject("responseFromListCandidates", responseFromListCandidates);

      if (
        responseFromListCandidates.message ===
        "successfully listed the candidates"
      ) {
        logger.error(
          `candidate ${email} already exists in the System, they just need to be approved`
        );
        callback({
          success: true,
          message: "candidate already exists",
          status: httpStatus.OK,
        });
      } else if (responseFromListCandidates.message === "no candidates exist") {
        const responseFromListUsers = await UserModel(
          tenant.toLowerCase()
        ).list({
          filter,
        });
        if (
          responseFromListUsers.message ===
          "successfully retrieved the user details"
        ) {
          logger.error(
            `candidate ${email} already exists as a User in the System`
          );
          callback({
            success: false,
            message: "Bad Request Error",
            status: httpStatus.BAD_REQUEST,
            errors: { message: "candidate already exists as a user" },
          });
        } else if (responseFromListUsers.message === "no users exist") {
          const responseFromCreateCandidate = await CandidateModel(
            tenant
          ).register(req);

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
                : httpStatus.OK;
              callback({
                success: true,
                message: "candidate successfully created",
                data: createdCandidate,
                status,
              });
            } else if (responseFromSendEmail.success === false) {
              const errors = responseFromSendEmail.errors
                ? responseFromSendEmail.errors
                : { message: "Internal Server Error" };
              const status = responseFromSendEmail.status
                ? responseFromSendEmail.status
                : httpStatus.INTERNAL_SERVER_ERROR;
              logger.error(`${responseFromCreateCandidate.message}`);
              callback({
                success: false,
                message: responseFromCreateCandidate.message,
                errors,
                status,
              });
            }
          } else if (responseFromCreateCandidate.success === false) {
            const errors = responseFromCreateCandidate.errors
              ? responseFromCreateCandidate.errors
              : { message: "Internal Server Error" };
            const status = responseFromCreateCandidate.status
              ? responseFromCreateCandidate.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            logger.error(`${responseFromCreateCandidate.message}`);
            callback({
              success: false,
              message: responseFromCreateCandidate.message,
              errors,
              status,
            });
          }
        } else if (responseFromListUsers.success === false) {
          const errors = responseFromListUsers.error
            ? responseFromListUsers.error
            : { message: "Internal Server Error" };
          const status = responseFromListUsers.status
            ? responseFromListUsers.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          logger.error(`${responseFromListUsers.message}`);
          callback({
            success: false,
            message: responseFromListUsers.message,
            errors,
            status,
          });
        }
      } else if (responseFromListCandidates.success === false) {
        const errors = responseFromListCandidates.error
          ? responseFromListCandidates.error
          : { message: "Internal Server Error" };
        const status = responseFromListCandidates.status
          ? responseFromListCandidates.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        logger.error(`${responseFromListCandidates.message}`);
        callback({
          success: false,
          message: responseFromListCandidates.message,
          errors,
          status,
        });
      }
    } catch (e) {
      logger.error(`${e.message}`);
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
      logger.error(`${e.message}`);
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
      logger.error(`${e.message}`);
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
      country,
    } = req;
    try {
      let responseFromListCandidate = await requestAccess.list({
        tenant,
        filter,
      });
      if (
        responseFromListCandidate.success === true &&
        !isEmpty(responseFromListCandidate.data)
      ) {
        const password = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(10)
        );

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
          country,
        };
        logObject("requestBody during confirmation", requestBody);

        let responseFromCreateUser = await UserModel(tenant).register(
          requestBody
        );

        logObject(
          "responseFromCreateUser during confirmation",
          responseFromCreateUser
        );

        if (responseFromCreateUser.success === true) {
          const createdUser = await responseFromCreateUser.data;
          logObject("createdUser", createdUser);
          const jsonify = (createdUser) => {
            let jsonData = JSON.stringify(createdUser);
            let parsedMap = JSON.parse(jsonData);
            return parsedMap;
          };

          const jsonifyCreatedUser = jsonify(createdUser);

          logObject("jsonifyCreatedUser", jsonifyCreatedUser);
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
            let responseFromDeleteCandidate = await requestAccess.delete(
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
              return responseFromDeleteCandidate;
            }
          } else if (responseFromSendEmail.success === false) {
            return responseFromSendEmail;
          }
        } else if (responseFromCreateUser.success === false) {
          return responseFromCreateUser;
        }
      } else if (
        responseFromListCandidate.success === true &&
        isEmpty(responseFromListCandidate.data)
      ) {
        return {
          success: false,
          message: "the candidate does not exist",
        };
      } else if (responseFromListCandidate.success === false) {
        const error = responseFromListCandidate.error
          ? responseFromListCandidate.error
          : {};
        return {
          success: false,
          message: "unable to retrieve candidate",
          error,
        };
      }
    } catch (e) {
      logger.error(`${e.message}`);
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
      const responseFromRemoveCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).remove({
        filter,
      });
      return responseFromRemoveCandidate;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "util server error",
        error: e.message,
      };
    }
  },
};

module.exports = requestAccess;
