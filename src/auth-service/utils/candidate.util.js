const UserModel = require("@models/User");
const CandidateModel = require("@models/Candidate");
const NetworkModel = require("@models/Network");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const accessCodeGenerator = require("generate-password");
const { mailer, stringify, generateFilter } = require("@utils/common");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-candidate-util`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const createCandidate = {
  create: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message:
            "Please contact support@airqo.net, Candidates are deprecated",
        },
      };
      const { firstName, lastName, email, tenant, network_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!isEmpty(network_id)) {
        const networkExists = await NetworkModel(tenant).exists({
          _id: ObjectId(network_id),
        });
        if (!networkExists) {
          logger.error(
            `Network ${network_id} not found in System, crosscheck or make another request`
          );
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "The provided network does not exist",
              [network_id]: `Network ID not found`,
            })
          );
        }
      }

      const userExists = await UserModel(tenant).exists({ email });
      const candidateExists = await CandidateModel(tenant).exists({ email });

      if (candidateExists) {
        logger.error(
          `candidate ${email} already exists in the System, they just need to be approved`
        );
        return {
          success: true,
          message: "candidate already exists",
          status: httpStatus.OK,
        };
      } else if (userExists) {
        logger.error(
          `Candidate ${email} already exists as a User in the System, you can use the FORGOT PASSWORD feature`
        );
        const emailResponse = await mailer.existingUserAccessRequest(
          {
            email,
            firstName,
            lastName,
          },
          next
        );

        if (emailResponse && emailResponse.success === false) {
          logger.error(
            `🐛🐛 Internal Server Error -- ${stringify(emailResponse)}`
          );
        }
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message:
              "You already exist as an AirQo User, please use the FORGOT PASSWORD feature",
          })
        );
        return;
      } else {
        const responseFromCreateCandidate = await CandidateModel(
          tenant
        ).register(request.body, next);

        if (responseFromCreateCandidate.success === true) {
          const createdCandidate = await responseFromCreateCandidate.data;
          const responseFromSendEmail = await mailer.candidate(
            {
              firstName,
              lastName,
              email,
              tenant,
            },
            next
          );
          if (responseFromSendEmail.success === true) {
            const status = responseFromSendEmail.status
              ? responseFromSendEmail.status
              : httpStatus.OK;
            return {
              success: true,
              message: "candidate successfully created",
              data: createdCandidate,
              status,
            };
          } else if (responseFromSendEmail.success === false) {
            logger.error(`${responseFromSendEmail.message}`);
            return responseFromSendEmail;
          }
        } else if (responseFromCreateCandidate.success === false) {
          logger.error(`${responseFromCreateCandidate.message}`);
          return responseFromCreateCandidate;
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message:
            "Please contact support@airqo.net, Candidates are deprecated",
        },
      };
      const { tenant, limit, skip } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const filter = generateFilter.candidates(request, next);
      const responseFromListCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).list(
        {
          filter,
          limit,
          skip,
        },
        next
      );
      return responseFromListCandidate;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message:
            "Please contact support@airqo.net, Candidates are deprecated",
        },
      };
      const { query, body } = request;
      const filter = generateFilter.candidates(request, next);
      const update = body;
      const tenant = query.tenant;
      const responseFromModifyCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).modify(
        {
          filter,
          update,
        },
        next
      );
      return responseFromModifyCandidate;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  confirm: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message:
            "Please contact support@airqo.net, Candidates are deprecated",
        },
      };
      const { tenant, firstName, lastName, email, network_id } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };

      if (!isEmpty(network_id)) {
        const networkExists = await NetworkModel(tenant).exists({
          _id: ObjectId(network_id),
        });
        if (!networkExists) {
          logger.error(
            `Network ${network_id} not found in System, crosscheck or make another request`
          );
          next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: `Network ${network_id} not found`,
              [network_id]: "the provided network does not exist",
            })
          );
        }
      }
      const candidateExists = await CandidateModel(tenant).exists({
        email,
      });
      const userExists = await UserModel(tenant).exists({ email });
      if (!candidateExists) {
        logger.error(
          `Candidate ${email} not found in System, crosscheck or make another request`
        );
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Candidate ${email} not found`,
            [email]: `Candidate ${email} not found`,
          })
        );
      } else if (userExists) {
        logger.error(
          `User ${email} already exists, try to utilise FORGOT PASSWORD feature`
        );
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `User ${email} already exists, try to utilise FORGOT PASSWORD feature`,
            [email]: `User ${email} already exists, try to utilise FORGOT PASSWORD feature`,
          })
        );
      } else {
        const candidateDetails = await CandidateModel(tenant)
          .find({ email })
          .lean();

        const password = accessCodeGenerator.generate(
          constants.RANDOM_PASSWORD_CONFIGURATION(10)
        );

        let requestBodyForUserCreation = Object.assign({}, request.body);
        requestBodyForUserCreation.privilege = "user";
        requestBodyForUserCreation.userName = email;
        requestBodyForUserCreation.password = password;

        const responseFromCreateUser = await UserModel(tenant).register(
          requestBodyForUserCreation,
          next
        );

        if (responseFromCreateUser.success === true) {
          const responseFromSendEmail = await mailer.user(
            {
              firstName,
              lastName,
              email,
              password,
              tenant,
              type: "confirm",
            },
            next
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
              next(
                new HttpError(
                  "Internal Server Error",
                  httpStatus.INTERNAL_SERVER_ERROR,
                  { message: "unable to find the candidate details" }
                )
              );
            }
            const filter = {
              _id: ObjectId(candidateDetails[0]._id),
            };
            const responseFromDeleteCandidate = await CandidateModel(
              tenant.toLowerCase()
            ).remove({ filter }, next);

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
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (error.code === 11000) {
        logger.error(`Duplicate Entry ${error.message}`);
        next(
          new HttpError("Duplicate Entry", httpStatus.BAD_REQUEST, {
            message: `duplicate entry ${error.keyValue}`,
          })
        );
      }
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "Deprecated Functionality",
        status: httpStatus.GONE,
        errors: {
          message:
            "Please contact support@airqo.net, Candidates are deprecated",
        },
      };
      const { tenant } = { ...request.query };
      const filter = generateFilter.candidates(request, next);
      const responseFromRemoveCandidate = await CandidateModel(
        tenant.toLowerCase()
      ).remove(
        {
          filter,
        },
        next
      );
      return responseFromRemoveCandidate;
    } catch (error) {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = createCandidate;
