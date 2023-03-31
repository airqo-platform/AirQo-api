const httpStatus = require("http-status");
const { logElement, logText, logObject } = require("@utils/log");
const { tryCatchErrors, missingQueryParams } = require("@utils/errors");
const createUserUtil = require("@utils/create-user");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const controlAccessUtil = require("@utils/control-access");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-user-controller`
);

const createUser = {
  listStatistics: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      logText(".....................................");
      logText("list all users by query params provided");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      const responseFromListStatistics = await createUserUtil.listStatistics(
        tenant
      );

      if (responseFromListStatistics.success === true) {
        res.status(httpStatus.OK).json({
          success: true,
          message: responseFromListStatistics.message,
          users_stats: responseFromListStatistics.data,
        });
      } else if (responseFromListStatistics.success === false) {
        const status = responseFromListStatistics.status
          ? responseFromListStatistics.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListStatistics.message,
          errors: {
            message: responseFromListStatistics.errors
              ? responseFromListStatistics.errors
              : { message: "Internal Server Error" },
          },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },
  listLogs: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      logText(".....................................");
      logText("list all users by query params provided");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      const responseFromListStatistics = await createUserUtil.listLogs(tenant);

      if (responseFromListStatistics.success === true) {
        res.status(httpStatus.OK).json({
          success: true,
          message: responseFromListStatistics.message,
          users_stats: responseFromListStatistics.data,
        });
      } else if (responseFromListStatistics.success === false) {
        const status = responseFromListStatistics.status
          ? responseFromListStatistics.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListStatistics.message,
          errors: {
            message: responseFromListStatistics.errors
              ? responseFromListStatistics.errors
              : "",
          },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      logText(".....................................");
      logText("list all users by query params provided");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let filter = {};
      const responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        filter = responseFromFilter.data;
        logObject("Zi filter", filter);
      } else if (responseFromFilter.success === false) {
        return res.status(httpStatus.BAD_GATEWAY).json({
          success: false,
          message: responseFromFilter.message,
          error: responseFromFilter.error
            ? responseFromFilter.error
            : { message: "" },
        });
      }

      const responseFromListUsers = await createUserUtil.list(
        tenant,
        filter,
        limit,
        skip
      );

      if (responseFromListUsers.success === true) {
        const status = responseFromListUsers.status
          ? responseFromListUsers.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: responseFromListUsers.message,
          users: responseFromListUsers.data,
        });
      } else if (responseFromListUsers.success === false) {
        const status = responseFromListUsers.status
          ? responseFromListUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListUsers.message,
          errors: responseFromListUsers.errors
            ? responseFromListUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },
  googleCallback: async (req, res) => {
    try {
      res.redirect("/");
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  verify: (req, res) => {
    return res.status(httpStatus.OK).json({
      success: true,
      message: "this token is valid",
      response: "valid token",
    });
  },
  verifyEmail: async (req, res) => {
    try {
      const { query, body } = req;
      let { tenant } = query;
      logText("we are verifying the email.....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = req;
      if (isEmpty(tenant)) {
        request.query.tenant = "airqo";
      }

      const responseFromVerifyEmail = await controlAccessUtil.verifyEmail(
        request
      );

      logObject("responseFromVerifyEmail", responseFromVerifyEmail);

      if (responseFromVerifyEmail.success === true) {
        const status = responseFromVerifyEmail.status
          ? responseFromVerifyEmail.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "email verified sucessfully",
        });
      } else if (responseFromVerifyEmail.success === false) {
        const status = responseFromVerifyEmail.status
          ? responseFromVerifyEmail.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromVerifyEmail.message,
          errors: responseFromVerifyEmail.errors
            ? responseFromVerifyEmail.errors
            : { message: "internal server errors" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "internal server error",
        errors: { message: error.message },
      });
    }
  },
  lookUpFirebaseUser: async (req, res) => {
    try {
      const { email, phoneNumber, uid, providerId, providerUid } = req.body;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        logObject("hasErrors", hasErrors);
        let nestedErrors = validationResult(req).errors[0].nestedErrors;

        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );

        return badRequest(
          res,
          "User does not exist",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = {};
      request["body"] = {};
      request["body"]["email"] = email;
      request["body"]["phoneNumber"] = phoneNumber;
      request["body"]["uid"] = uid;
      request["body"]["providerId"] = providerId;
      request["body"]["providerUid"] = providerUid;

      function cleanObject(obj) {
        for (key in obj) {
          if (typeof obj[key] === "object") {
            cleanObject(obj[key]);
          } else if (
            typeof obj[key] === "undefined" ||
            typeof obj[key] === null
          ) {
            delete obj[key];
          }
        }
        return obj;
      }
      cleanObject(request);
      await createUserUtil.lookUpFirebaseUser(request, (result) => {
        if (result.success === true) {
          const status = result.status ? result.status : httpStatus.OK;
          res.status(status).json({
            success: true,
            message: result.message,
            user: result.data,
            exists: true,
            status: "exists",
          });
        } else if (result.success === false) {
          const status = result.status
            ? result.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          const errors = result.errors
            ? result.errors
            : { message: "Internal Server Error" };

          res.status(status).json({
            success: false,
            message: "User does not exist",
            exists: false,
            errors,
          });
        }
      });
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  sendFeedback: async (req, res) => {
    try {
      const { email, message, subject } = req.body;
      const hasErrors = !validationResult(req).isEmpty();

      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      const responseFromSendEmail = await createUserUtil.sendFeedback({
        email,
        message,
        subject,
      });

      if (responseFromSendEmail.success === true) {
        const status = responseFromSendEmail.status
          ? responseFromSendEmail.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "successfully responded to email",
          status,
        });
      } else if (responseFromSendEmail.success === false) {
        const status = responseFromSendEmail.status
          ? responseFromSendEmail.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromSendEmail.errors
          ? responseFromSendEmail.errors
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: true,
          message: responseFromSendEmail.message,
          status,
          errors,
        });
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  forgot: async (req, res) => {
    logText("...........................................");
    logText("forgot password...");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { email } = req.body;
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let update = { email };
        let responseFromForgotPassword = await createUserUtil.forgotPassword(
          tenant,
          filter,
          update
        );
        logObject("responseFromForgotPassword", responseFromForgotPassword);
        if (responseFromForgotPassword.success === true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromForgotPassword.message,
            response: responseFromForgotPassword.data,
          });
        } else if (responseFromForgotPassword.success === false) {
          if (responseFromForgotPassword.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
              error: responseFromForgotPassword.error,
            });
          } else {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error, "createUser controller");
    }
  },

  register: async (req, res) => {
    logText("..................................................");
    logText("register user.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const {
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
        network_id,
      } = req.body;

      let request = {};
      request["tenant"] = tenant.toLowerCase();
      request["firstName"] = firstName;
      request["lastName"] = lastName;
      request["email"] = email;
      request["organization"] = organization;
      request["long_organization"] = long_organization;
      request["privilege"] = privilege;
      request["network_id"] = network_id;

      let responseFromCreateUser = await createUserUtil.register(request);
      logObject("responseFromCreateUser in controller", responseFromCreateUser);
      if (responseFromCreateUser.success === true) {
        const status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateUser.message,
          user: responseFromCreateUser.data,
        });
      } else if (responseFromCreateUser.success === false) {
        const status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        const error = responseFromCreateUser.error
          ? responseFromCreateUser.error
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateUser.message,
          errors: error,
        });
      }
    } catch (error) {
      tryCatchErrors(res, error, "createUser controller");
    }
  },

  create: async (req, res) => {
    logText("..................................................");
    logText("create user.............");
    try {
      const { query, body, params } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req.body;
      request["tenant"] = tenant.toLowerCase();

      let responseFromCreateUser = await createUserUtil.create(request);
      logObject("responseFromCreateUser in controller", responseFromCreateUser);
      if (responseFromCreateUser.success === true) {
        const status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateUser.message,
          user: responseFromCreateUser.data,
        });
      } else if (responseFromCreateUser.success === false) {
        const status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateUser.message,
          errors: responseFromCreateUser.errors
            ? responseFromCreateUser.errors
            : "",
        });
      }
    } catch (error) {
      return {
        success: false,
        message: "internal server errors",
        errors: { message: error.message },
      };
    }
  },

  confirmEmail: async (req, res) => {
    logText(".......................................................");
    logText("confirming email...............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let responseFromFilter = generateFilter.users(req);
      logElement("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        filter["emailConfirmed"] = false;
        update = { confirmed: true };
        let responseFromConfirmEmail = createUserUtil.confirmEmail(
          tenant,
          filter,
          update
        );
        if (responseFromConfirmEmail.success === true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromConfirmEmail.message,
          });
        } else if (responseFromConfirmEmail.success === false) {
          if (responseFromConfirmEmail.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
              error: responseFromConfirmEmail.error,
            });
          } else {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }
    } catch (error) {
      logElement("controller server error", error.message);
      tryCatchErrors(res, error, "createUser controller");
    }
  },

  login: (req, res) => {
    logText("..................................");
    logText("user login......");
    try {
      const { tenant } = req.query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      if (!isEmpty(tenant) && tenant != "airqo") {
        logObject("tenant", tenant);
        res.status(httpStatus.MOVED_PERMANENTLY).json({
          message:
            "The account has been moved permanently to a new location, please reach out to: info@airqo.net",
          location: "https://platform.airqo.net/",
          errors: {
            message:
              "The account has been moved permanently to a new location, please reach out to: info@airqo.net",
            location: "https://platform.airqo.net/",
          },
        });
      }

      if (req.auth.success === true) {
        res.status(httpStatus.OK).json(req.user.toAuthJSON());
      } else {
        if (req.auth.error) {
          res.status(httpStatus.BAD_REQUEST).json({
            success: req.auth.success,
            error: req.auth.error,
            message: req.auth.message,
          });
        }
        res.status(httpStatus.BAD_REQUEST).json({
          success: req.auth.success,
          message: req.auth.message,
        });
      }
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  guest: (req, res) => {
    logText("..................................");
    logText("user guest login......");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      req.session.guest = true;
      req.session.save((err) => {
        if (err) {
          return res
            .status(httpStatus.INTERNAL_SERVER_ERROR)
            .json({ success: false, message: "Error creating guest session" });
        }
        // Return the guest id to the client
        return res
          .status(httpStatus.OK)
          .json({ success: true, guestId: req.user.guestId });
      });
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "internal server errors",
        errors: { message: error.message },
        error: "",
      });
    }
  },

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete user............");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromRemoveUser = await createUserUtil.delete(
          tenant,
          filter
        );
        if (responseFromRemoveUser.success === true) {
          const status = responseFromRemoveUser.status
            ? responseFromRemoveUser.status
            : httpStatus.OK;
          return res.status(status).json({
            success: true,
            message: responseFromRemoveUser.message
              ? responseFromRemoveUser.message
              : "",
            user: responseFromRemoveUser.data,
          });
        } else if (responseFromRemoveUser.success === false) {
          const status = responseFromRemoveUser.status
            ? responseFromRemoveUser.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          return res.status(status).json({
            success: false,
            message: responseFromRemoveUser.message
              ? responseFromRemoveUser.message
              : "",
            error: responseFromRemoveUser.error
              ? responseFromRemoveUser.error
              : "",
          });
        }
      } else if (responseFromFilter.success === false) {
        const status = responseFromFilter.status
          ? responseFromFilter.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        res.status(status).json({
          success: false,
          message: responseFromFilter.message ? responseFromFilter.message : "",
          error: responseFromFilter.error ? responseFromFilter.error : "",
        });
      }
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        error: error.message,
      });
    }
  },

  update: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside user update................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let responseFromUpdateUser = await createUserUtil.update(req);
      logObject("responseFromUpdateUser", responseFromUpdateUser);
      if (responseFromUpdateUser.success === true) {
        return res.status(httpStatus.OK).json({
          success: true,
          message: responseFromUpdateUser.message,
          user: responseFromUpdateUser.data,
        });
      } else if (responseFromUpdateUser.success === false) {
        if (responseFromUpdateUser.error) {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromUpdateUser.message,
            error: responseFromUpdateUser.error,
          });
        } else {
          return res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromUpdateUser.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error, "createUser controller");
    }
  },

  loginInViaEmail: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["purpose"] = "login";
      await createUserUtil.generateSignInWithEmailLink(request, (value) => {
        if (value.success === true) {
          const status = value.status ? value.status : httpStatus.OK;
          return res.status(status).json({
            success: true,
            message: value.message,
            login_link: value.data.link,
            token: value.data.token,
            email: value.data.email,
            emailLinkCode: value.data.emailLinkCode,
          });
        }

        if (value.success === false) {
          const status = value.status
            ? value.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          const errors = value.errors ? value.errors : "";
          return res.status(status).json({
            success: false,
            message: value.message,
            errors,
          });
        }
      });
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },

  emailAuth: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["purpose"] = "auth";
      await createUserUtil.generateSignInWithEmailLink(request, (value) => {
        if (value.success === true) {
          const status = value.status ? value.status : httpStatus.OK;
          return res.status(status).json({
            success: true,
            message: value.message,
            token: value.data.token,
            auth_link: value.data.link,
            auth_code: value.data.emailLinkCode,
            email: value.data.email,
          });
        }

        if (value.success === false) {
          const status = value.status
            ? value.status
            : httpStatus.INTERNAL_SERVER_ERROR;
          const errors = value.errors ? value.errors : "";
          return res.status(status).json({
            success: false,
            message: value.message,
            errors,
          });
        }
      });
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
      });
    }
  },

  updateForgottenPassword: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      const { body } = req;

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = {};
      request["body"] = body;
      request["tenant"] = tenant;
      const responseFromUpdateForgottenPassword =
        await createUserUtil.updateForgottenPassword(request);

      if (responseFromUpdateForgottenPassword.success === true) {
        const status = responseFromUpdateForgottenPassword.status
          ? responseFromUpdateForgottenPassword.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully updated the password",
          user: responseFromUpdateForgottenPassword.data,
        });
      } else if (responseFromUpdateForgottenPassword.success === false) {
        const status = responseFromUpdateForgottenPassword.status
          ? responseFromUpdateForgottenPassword.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        res.status(status).json({
          success: false,
          message: responseFromUpdateForgottenPassword.message,
          errors: responseFromUpdateForgottenPassword.errors
            ? responseFromUpdateForgottenPassword.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  updateKnownPassword: async (req, res) => {
    try {
      logText("update known password............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const { password, old_password } = req.body;

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromUpdatePassword =
          await createUserUtil.updateKnownPassword(
            tenant,
            password,
            old_password,
            filter
          );
        if (responseFromUpdatePassword.success === true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromUpdatePassword.message,
            user: responseFromUpdatePassword.data,
          });
        } else if (responseFromUpdatePassword.success === false) {
          if (responseFromUpdatePassword.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
              error: responseFromUpdatePassword.error,
            });
          } else {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(httpStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      tryCatchErrors(res, error, "createUser controller");
    }
  },
  subscribeToNewsLetter: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        logger.error(
          `input validation errors ${JSON.stringify(
            convertErrorArrayToObject(nestedErrors)
          )}`
        );
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = {};
      request["body"] = req.body;
      if (isEmpty(req.body.tags)) {
        request["body"]["tags"] = [];
      }
      const responseFromSubscribeToNewsLetter =
        await createUserUtil.subscribeToNewsLetter(request);

      if (responseFromSubscribeToNewsLetter.success === true) {
        const status = responseFromSubscribeToNewsLetter.status
          ? responseFromSubscribeToNewsLetter.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromSubscribeToNewsLetter.message,
          success: true,
        });
      } else if (responseFromSubscribeToNewsLetter.success === false) {
        const status = responseFromSubscribeToNewsLetter.status
          ? responseFromSubscribeToNewsLetter.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        const errors = responseFromSubscribeToNewsLetter.errors
          ? responseFromSubscribeToNewsLetter.errors
          : { message: "" };

        return res.status(status).json({
          success: false,
          message: responseFromSubscribeToNewsLetter.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createUser;
