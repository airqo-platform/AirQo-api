const UserModel = require("../models/User");
const CandidateModel = require("../models/Candidate");
const { getModelByTenant } = require("@config/database");
const { logObject, logElement, logText } = require("./log");
const mailer = require("./mailer");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
constants = require("../config/constants");
const accessCodeGenerator = require("generate-password");
const generateFilter = require("@utils/generate-filter");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- request-access-util`
);

const requestAccess = {
  create: async (req, callback) => {
    try {
      const { firstName, lastName, email, tenant } = req;

      const userExists = await UserModel(tenant).exists({ email });
      const candidateExists = await CandidateModel(tenant).exists({
        email,
      });

      if (candidateExists) {
        logger.error(
          `candidate ${email} already exists in the System, they just need to be approved`
        );
        callback({
          success: true,
          message: "candidate already exists",
          status: httpStatus.OK,
        });
      } else if (userExists) {
        logger.error(
          `candidate ${email} already exists as a User in the System, you can use the FORGOT PASSWORD feature`
        );
        callback({
          success: false,
          message: "Bad Request Error",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message:
              "Candidate already exists as a User,you can use the FORGOT PASSWORD feature",
          },
        });
      } else {
        const responseFromCreateCandidate = await CandidateModel(
          tenant
        ).register(req);

        if (responseFromCreateCandidate.success === true) {
          const createdCandidate = await responseFromCreateCandidate.data;
          const responseFromSendEmail = await mailer.candidate(
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
            logger.error(`${responseFromCreateCandidate.message}`);
            callback(responseFromSendEmail);
          }
        } else if (responseFromCreateCandidate.success === false) {
          logger.error(`${responseFromCreateCandidate.message}`);
          callback(responseFromCreateCandidate);
        }
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

  list: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;
      const limit = parseInt(request.query.limit, 0);
      const skip = parseInt(request.query.skip, 0);

      const responseFromFilter = generateFilter.candidates(request);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;

      const responseFromListCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).list({
        filter,
        limit,
        skip,
      });
      return responseFromListCandidate;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  update: async (request) => {
    try {
      const { query, body } = request;

      const responseFromFilter = generateFilter.candidates(request);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }

      const filter = responseFromFilter.data;
      const update = body;
      const tenant = query.tenant;

      const responseFromModifyCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).modify({
        filter,
        update,
      });
      logObject("responseFromModifyCandidate", responseFromModifyCandidate);
      return responseFromModifyCandidate;
    } catch (e) {
      logger.error(`${e.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      };
    }
  },

  confirm: async (req) => {
    try {
      const { tenant, firstName, lastName, email } = req;

      const candidateExists = await CandidateModel(tenant).exists({
        email,
      });

      const userExists = await UserModel(tenant).exists({ email });
      logObject("candidateExists", candidateExists);
      logObject("userExists", userExists);
      if (!candidateExists) {
        logger.error(
          `Candidate ${email} not found in System, crosscheck or make another request`
        );
        return {
          success: false,
          message: "the candidate does not exist",
          status: httpStatus.BAD_REQUEST,
          errors: { message: `Candidate ${email} not found` },
        };
      } else if (userExists) {
        logger.error(
          `User ${email} already exists, try to utilise FORGOT PASSWORD feature`
        );
        return {
          success: false,
          message: "the User already exists",
          status: httpStatus.BAD_REQUEST,
          errors: {
            message: `User ${email} already exists, try to utilise FORGOT PASSWORD feature`,
          },
        };
      } else {
        const candidateDetails = await CandidateModel(tenant)
          .find({ email })
          .lean();

        const password = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(10)
        );

        let requestBodyForUserCreation = Object.assign({}, req);
        requestBodyForUserCreation.privilege = "user";
        requestBodyForUserCreation.userName = email;
        requestBodyForUserCreation.password = password;

        logObject(
          "requestBody during confirmation",
          requestBodyForUserCreation
        );

        const responseFromCreateUser = await UserModel(tenant).register(
          requestBodyForUserCreation
        );
        logObject(
          "responseFromCreateUser during confirmation",
          responseFromCreateUser
        );

        if (responseFromCreateUser.success === true) {
          const responseFromSendEmail = await mailer.user(
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
            logObject("candidateDetails[0]", candidateDetails[0]);
            if (
              candidateDetails.length > 1 ||
              candidateDetails.length === 0 ||
              isEmpty(candidateDetails)
            ) {
              return {
                success: false,
                message: "Internal Server Error",
                errors: { message: "unable to find the candidate details" },
                status: httpStatus.INTERNAL_SERVER_ERROR,
              };
            }
            const filter = {
              _id: ObjectId(candidateDetails[0]._id),
            };
            const responseFromDeleteCandidate = await CandidateModel(
              tenant.toLowerCase()
            ).remove({ filter });

            if (responseFromDeleteCandidate.success === true) {
              return {
                success: true,
                message: "candidate successfully confirmed",
                data: {
                  firstName,
                  lastName,
                  email,
                  userName: email,
                },
                status: httpStatus.OK,
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
      }
    } catch (e) {
      logger.error(`${JSON.stringify(e)}`);
      if (e.code === 11000) {
        return {
          success: false,
          message: "Duplicate Entry",
          error: e.keyValue,
          errors: { message: `duplicate entry ${e.keyValue}` },
          status: httpStatus.BAD_REQUEST,
        };
      }
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  delete: async (request) => {
    try {
      const { query } = request;
      const { tenant } = query;

      const responseFromFilter = generateFilter.candidates(request);

      if (responseFromFilter.success === false) {
        return responseFromFilter;
      }
      const filter = responseFromFilter.data;
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
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = requestAccess;
