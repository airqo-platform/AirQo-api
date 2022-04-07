const HTTPStatus = require("http-status");
const validations = require("../utils/validations");
const { logElement, logText, logObject } = require("../utils/log");
const errorsUtil = require("../utils/errors");
const joinUtil = require("../utils/join");
const generateFilter = require("../utils/generate-filter");
const { validationResult } = require("express-validator");
const log4js = require("log4js");
const logger = log4js.getLogger("join-controller");

const join = {
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      logText(".....................................");
      logText("list all users by query params provided");
      const { tenant, id } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromListUsers = await joinUtil.list(
          tenant,
          filter,
          limit,
          skip
        );

        if (responseFromListUsers.success === true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListUsers.message,
            users: responseFromListUsers.data,
          });
        } else if (responseFromListUsers.success === false) {
          if (responseFromListUsers.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListUsers.message,
              error: responseFromListUsers.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListUsers.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`list users -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
  verify: (req, res) => {
    return res.status(HTTPStatus.OK).json({
      success: true,
      message: "this token is valid",
      response: "valid token",
    });
  },
  forgot: async (req, res) => {
    logText("...........................................");
    logText("forgot password...");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let { email } = req.body;
      let { tenant } = req.query;
      if (!tenant && !email) {
        logger.error(`forgot credentials`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message = "Bad Request";
        const error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      logElement("the email", email);
      const { error, isValid } = validations.forgot(email);
      if (!isValid) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let update = { email };
        let responseFromForgotPassword = await joinUtil.forgotPassword(
          tenant,
          filter,
          update
        );
        logObject("responseFromForgotPassword", responseFromForgotPassword);
        if (responseFromForgotPassword.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromForgotPassword.message,
            response: responseFromForgotPassword.data,
          });
        } else if (responseFromForgotPassword.success === false) {
          if (responseFromForgotPassword.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
              error: responseFromForgotPassword.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromForgotPassword.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }
    } catch (error) {
      logger.error(`forgot -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  register: async (req, res) => {
    logText("..................................................");
    logText("register user.............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { errors, isValid } = validations.register(req.body);
      const { tenant } = req.query;
      const {
        firstName,
        lastName,
        email,
        organization,
        long_organization,
        privilege,
      } = req.body;

      if (!isValid) {
        return res
          .status(HTTPStatus.BAD_REQUEST)
          .json({ success: false, errors, message: "validation error" });
      }

      let request = {};
      request["tenant"] = tenant.toLowerCase();
      request["firstName"] = firstName;
      request["lastName"] = lastName;
      request["email"] = email;
      request["organization"] = organization;
      request["long_organization"] = long_organization;
      request["privilege"] = privilege;

      let responseFromCreateUser = await joinUtil.create(request);
      logObject("responseFromCreateUser in controller", responseFromCreateUser);
      if (responseFromCreateUser.success === true) {
        let status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateUser.message,
          user: responseFromCreateUser.data,
        });
      }

      if (responseFromCreateUser.success === false) {
        let status = responseFromCreateUser.status
          ? responseFromCreateUser.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        let error = responseFromCreateUser.error
          ? responseFromCreateUser.error
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromCreateUser.message,
          errors: error,
        });
      }
    } catch (error) {
      logger.error(`register user -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  confirmEmail: async (req, res) => {
    logText(".......................................................");
    logText("confirming email...............");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { tenant, id } = req.query;
      if (!tenant) {
        logger.error(`confirm email`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message = "Bad Request, missing tenant";
        const error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let responseFromFilter = generateFilter.users(req);
      logElement("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        filter["emailConfirmed"] = false;
        update = { confirmed: true };
        let responseFromConfirmEmail = joinUtil.confirmEmail(
          tenant,
          filter,
          update
        );
        if (responseFromConfirmEmail.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromConfirmEmail.message,
          });
        } else if (responseFromConfirmEmail.success === false) {
          if (responseFromConfirmEmail.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
              error: responseFromConfirmEmail.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmEmail.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        }
      }
    } catch (error) {
      logger.error(`confirm email -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  login: (req, res) => {
    logText("..................................");
    logText("user login......");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { errors, isValid } = validations.login(req.body);
      if (!isValid) {
        return res.status(HTTPStatus.BAD_REQUEST).json(errors);
      }
      if (req.auth.success === true) {
        const status = req.auth.status ? req.auth.status : HTTPStatus.OK;
        res.status(status).json(req.user.toAuthJSON());
      } else {
        const status = req.auth.status
          ? req.auth.status
          : INTERNAL_SERVER_ERROR;
        const errors = req.auth.error ? req.auth.error : "";
        res.status(status).json({
          success: req.auth.success,
          errors,
          message: req.auth.message,
        });
      }
    } catch (error) {
      logger.error(`user login -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  delete: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside delete user............");
      const { tenant, id } = req.query;
      if (!tenant && !id) {
        logger.error(`delete user`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message = "Bad Request, tenant and id missing";
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromRemoveUser = await joinUtil.delete(tenant, filter);
        if (responseFromRemoveUser.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromRemoveUser.message,
            user: responseFromRemoveUser.data,
          });
        } else if (responseFromRemoveUser.success === false) {
          if (responseFromRemoveUser.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromRemoveUser.message,
              error: responseFromRemoveUser.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromRemoveUser.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`delete user -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  update: async (req, res) => {
    try {
      logText(".................................................");
      logText("inside user update................");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { tenant, id } = req.query;
      if (!tenant && !id) {
        logger.error(`update user`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message = "Bad Request, missing tenant and ids";
        const error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let update = req.body;
        delete update.password;
        delete update._id;
        let responseFromUpdateUser = await joinUtil.update(
          tenant,
          filter,
          update
        );
        logObject("responseFromUpdateUser", responseFromUpdateUser);
        if (responseFromUpdateUser.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateUser.message,
            user: responseFromUpdateUser.data,
          });
        } else if (responseFromUpdateUser.success === false) {
          if (responseFromUpdateUser.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateUser.message,
              error: responseFromUpdateUser.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateUser.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`update user -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  loginInViaEmail: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["purpose"] = "login";
      await joinUtil.generateSignInWithEmailLink(request, (value) => {
        if (value.success === true) {
          const status = value.status ? value.status : HTTPStatus.OK;
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
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = value.errors ? value.errors : "";
          return res.status(status).json({
            success: false,
            message: value.message,
            errors,
          });
        }
      });
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
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
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["query"]["purpose"] = "auth";
      await joinUtil.generateSignInWithEmailLink(request, (value) => {
        if (value.success === true) {
          const status = value.status ? value.status : HTTPStatus.OK;
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
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          const errors = value.errors ? value.errors : "";
          return res.status(status).json({
            success: false,
            message: value.message,
            errors,
          });
        }
      });
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
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
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { tenant } = req.query;
      const { password, resetPasswordToken } = req.body;
      if (!tenant && !resetPasswordToken && !password) {
        logger.error(`update forgotten password`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message =
          "Bad Request, missing tenant, resetPassword and password";
        const error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let responseFromFilter = generateFilter.users(req);
      // logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let update = {
          password,
          resetPasswordToken,
        };
        let filter = responseFromFilter.data;
        // logObject("the filter in controller", filter);
        // logObject("the update in controller", update);
        let responseFromUpdateForgottenPassword =
          await joinUtil.updateForgottenPassword(tenant, filter, update);
        logObject(
          "responseFromUpdateForgottenPassword",
          responseFromUpdateForgottenPassword
        );
        if (responseFromUpdateForgottenPassword.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateForgottenPassword.message,
            user: responseFromUpdateForgottenPassword.data,
          });
        } else if (responseFromUpdateForgottenPassword.success === false) {
          if (responseFromUpdateForgottenPassword.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateForgottenPassword.message,
              error: responseFromUpdateForgottenPassword.error,
            });
          } else {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateForgottenPassword.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`update forgotten password -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },

  updateKnownPassword: async (req, res) => {
    try {
      logText("update known password............");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { errors, isValid } = validations.updateKnownPassword(req.body);
      if (!isValid) {
        return res.status(400).json(errors);
      }
      const { tenant, id } = req.query;
      const { password, old_password } = req.body;
      if (!tenant && !password && !old_password && id) {
        logger.error(`update known password`);
        const statusCode = HTTPStatus.BAD_REQUEST;
        const message =
          "Bad Request, missing tenant, password, old password and id";
        const error = {};
        errorsUtil.errorResponse({ res, message, statusCode, error });
      }

      let responseFromFilter = generateFilter.users(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let responseFromUpdatePassword = await joinUtil.updateKnownPassword(
          tenant,
          password,
          old_password,
          filter
        );
        if (responseFromUpdatePassword.success === true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdatePassword.message,
            user: responseFromUpdatePassword.data,
          });
        } else if (responseFromUpdatePassword.success === false) {
          if (responseFromUpdatePassword.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
              error: responseFromUpdatePassword.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdatePassword.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`update known password -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = "Internal Server Error";
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
};

module.exports = join;
