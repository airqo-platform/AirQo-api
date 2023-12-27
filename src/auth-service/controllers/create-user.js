const httpStatus = require("http-status");
const { logText, logObject } = require("@utils/log");
const createUserUtil = require("@utils/create-user");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const controlAccessUtil = require("@utils/control-access");
const constants = require("@config/constants");
const log4js = require("log4js");
const UserModel = require("@models/User");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-user-controller`
);

const createUser = {
  listStatistics: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListStatistics = await createUserUtil.listStatistics(
        tenant,
        next
      );

      if (responseFromListStatistics.success === true) {
        const status = responseFromListStatistics.status
          ? responseFromListStatistics.status
          : httpStatus.OK;
        return res.status(status).json({
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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listLogs: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListStatistics = await createUserUtil.listLogs(
        request,
        next
      );

      if (responseFromListStatistics.success === true) {
        const status = responseFromListStatistics.status
          ? responseFromListStatistics.status
          : httpStatus.OK;
        return res.status(status).json({
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
          errors: responseFromListStatistics.errors
            ? responseFromListStatistics.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listCache: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListUsers = await createUserUtil.listCache(
        request,
        next
      );

      if (responseFromListUsers.success === true) {
        const status = responseFromListUsers.status
          ? responseFromListUsers.status
          : httpStatus.OK;
        return res.status(status).json({
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
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListUsers = await createUserUtil.list(request, next);

      if (responseFromListUsers.success === true) {
        const status = responseFromListUsers.status
          ? responseFromListUsers.status
          : httpStatus.OK;
        return res.status(status).json({
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
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listUsersAndAccessRequests: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListUsersAndAccessRequests =
        await createUserUtil.listUsersAndAccessRequests(request, next);

      if (responseFromListUsersAndAccessRequests.success === true) {
        const status = responseFromListUsersAndAccessRequests.status
          ? responseFromListUsersAndAccessRequests.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListUsersAndAccessRequests.message,
          users: responseFromListUsersAndAccessRequests.data,
        });
      } else if (responseFromListUsersAndAccessRequests.success === false) {
        const status = responseFromListUsersAndAccessRequests.status
          ? responseFromListUsersAndAccessRequests.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListUsersAndAccessRequests.message,
          errors: responseFromListUsersAndAccessRequests.errors
            ? responseFromListUsersAndAccessRequests.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  googleCallback: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      logObject("req.user.toAuthJSON()", req.user.toAuthJSON());
      const token = req.user.toAuthJSON().token;
      // Set the token as an HTTP-only cookie
      res.cookie("access_token", token, {
        httpOnly: true,
        secure: true, // Enable if using HTTPS
      });

      res.redirect(`${constants.GMAIL_VERIFICATION_SUCCESS_REDIRECT}`);

      /***
       * in the FRONTEND, access the cookie:
       * ==================================
       * npm install js-cookie
       * import Cookies from "js-cookie";
       * const token = Cookies.get("access_token");
       */
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verify: async (req, res, next) => {
    try {
      logText("..................................");
      logText("user verify......");
      res.status(httpStatus.OK).send("this token is valid");
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyEmail: async (req, res, next) => {
    try {
      logText("we are verifying the email.....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromVerifyEmail = await controlAccessUtil.verifyEmail(
        request,
        next
      );

      if (responseFromVerifyEmail.success === true) {
        const status = responseFromVerifyEmail.status
          ? responseFromVerifyEmail.status
          : httpStatus.OK;
        return res.status(status).json({
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
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteMobileUserData: async (req, res, next) => {
    try {
      logText("We are deleting the app data.....");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeleteAppData =
        await createUserUtil.deleteMobileUserData(request, next);

      if (responseFromDeleteAppData.success === true) {
        const status = responseFromDeleteAppData.status
          ? responseFromDeleteAppData.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "Data deleted sucessfully",
        });
      } else if (responseFromDeleteAppData.success === false) {
        const status = responseFromDeleteAppData.status
          ? responseFromDeleteAppData.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteAppData.message,
          errors: responseFromDeleteAppData.errors
            ? responseFromDeleteAppData.errors
            : { message: "internal server errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  emailReport: async (req, res, next) => {
    try {
      if (!req.files || Object.keys(req.files).length === 0) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "No PDF or CSV file attached",
          })
        );
      }

      const pdfFile = req.files.pdf;
      if (pdfFile && !pdfFile.mimetype.includes("pdf")) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid PDF file",
          })
        );
      }

      const csvFile = req.files.csv;
      if (csvFile && !csvFile.mimetype.includes("csv")) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Invalid CSV file",
          })
        );
      }

      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromEmailReport = await createUserUtil.emailReport(
        request,
        next
      );

      if (responseFromEmailReport.success === true) {
        const status = responseFromEmailReport.status
          ? responseFromEmailReport.status
          : httpStatus.OK;
        res.status(status).json({
          success: true,
          message: "Report Emailed sucessfully",
        });
      } else if (responseFromEmailReport.success === false) {
        const status = responseFromEmailReport.status
          ? responseFromEmailReport.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromEmailReport.message,
          errors: responseFromEmailReport.errors
            ? responseFromEmailReport.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  lookUpFirebaseUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.lookUpFirebaseUser(request, next);
      if (result[0].success === true) {
        const status = result[0].status ? result[0].status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result[0].message,
          user: result[0].data,
          exists: true,
          status: "exists",
        });
      } else if (result[0].success === false) {
        const status = result[0].status
          ? result[0].status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: "User does not exist",
          exists: false,
          errors: result[0].errors
            ? result[0].errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  syncAnalyticsAndMobile: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.syncAnalyticsAndMobile(request, next);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json(result);
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: "Unable to sync Analytics and Mobile Accounts",
          exists: false,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  signUpWithFirebase: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.signUpWithFirebase(request, next);
      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
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
        return res.status(status).json({
          success: false,
          message: "Unable to signup with Firebase",
          exists: false,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  loginWithFirebase: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.loginWithFirebase(request, next);

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          ...result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: "Unable to login with Firebase",
          exists: false,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  verifyFirebaseCustomToken: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.verifyFirebaseCustomToken(
        request,
        next
      );

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          ...result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: "Unable to login with Firebase",
          exists: false,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createFirebaseUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createUserUtil.createFirebaseUser(request, next);

      if (result[0].success === true) {
        const status = result[0].status ? result[0].status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result[0].message,
          user: result[0].data[0],
          exists: true,
          status: "exists",
        });
      } else if (result[0].success === false) {
        const status = result[0].status
          ? result[0].status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result[0].message,
          errors: result[0].errors
            ? result[0].errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  sendFeedback: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromSendEmail = await createUserUtil.sendFeedback(
        request,
        next
      );

      if (responseFromSendEmail.success === true) {
        const status = responseFromSendEmail.status
          ? responseFromSendEmail.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully responded to email",
          status,
        });
      } else if (responseFromSendEmail.success === false) {
        const status = responseFromSendEmail.status
          ? responseFromSendEmail.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: true,
          message: responseFromSendEmail.message,
          status,
          errors: responseFromSendEmail.errors
            ? responseFromSendEmail.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  forgot: async (req, res, next) => {
    logText("...........................................");
    logText("forgot password...");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromForgotPassword = await createUserUtil.forgotPassword(
        request,
        next
      );

      if (responseFromForgotPassword.success === true) {
        const status = responseFromForgotPassword.status
          ? responseFromForgotPassword.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromForgotPassword.message,
          response: responseFromForgotPassword.data,
        });
      } else if (responseFromForgotPassword.success === false) {
        const status = responseFromForgotPassword.status
          ? responseFromForgotPassword.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromForgotPassword.message,
          error: responseFromForgotPassword.error
            ? responseFromForgotPassword.error
            : "",
          errors: responseFromForgotPassword.errors
            ? responseFromForgotPassword.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  register: async (req, res, next) => {
    logText("..................................................");
    logText("register user.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateUser = await createUserUtil.register(
        request,
        next
      );

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
            : { message: "Internal Server Errors" },
          error: responseFromCreateUser.error
            ? responseFromCreateUser.error
            : "Internal Server Errors",
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (req, res, next) => {
    logText("..................................................");
    logText("create user.............");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateUser = await createUserUtil.create(request, next);
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
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  login: async (req, res, next) => {
    logText("..................................");
    logText("user login......");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (req.auth.success === true) {
        const user = await req.user.toAuthJSON();
        const currentDate = new Date();
        await UserModel("airqo").findByIdAndUpdate(user._id, {
          lastLogin: currentDate,
          isActive: true,
        });

        return res.status(httpStatus.OK).json(user);
      } else {
        if (req.auth.error) {
          throw new HttpError(req.auth.message, httpStatus.BAD_REQUEST);
        }
        throw new HttpError(req.auth.message, httpStatus.BAD_REQUEST);
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  logout: async (req, res, next) => {
    try {
      logText("..................................");
      logText("user logout......");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      return res
        .status(httpStatus.NOT_IMPLEMENTED)
        .json({ success: false, message: "not yet implemented" });

      req.logout((err) => {
        if (err) {
          logObject("err,err");
          logger.error(`Error during logout: ${JSON.stringify(err)}`);
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: err.message }
            )
          );
        }
        return res
          .status(httpStatus.OK)
          .json({ message: "logout successful", success: true });
        // res.redirect("https://analytics.airqo.net/account/login");
      });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  guest: (req, res, next) => {
    try {
      logText("..................................");
      logText("user guest login......");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

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
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside delete user............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveUser = await createUserUtil.delete(request, next);

      if (responseFromRemoveUser.success === true) {
        const status = responseFromRemoveUser.status
          ? responseFromRemoveUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRemoveUser.message
            ? responseFromRemoveUser.message
            : "Operation Successful",
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
            : "Internal Server Error",
          errors: responseFromRemoveUser.errors
            ? responseFromRemoveUser.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (req, res, next) => {
    try {
      logText(".................................................");
      logText("inside user update................");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateUser = await createUserUtil.update(request, next);

      if (responseFromUpdateUser.success === true) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateUser.message,
          user: responseFromUpdateUser.data,
        });
      } else if (responseFromUpdateUser.success === false) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUser.message,
          errors: responseFromUpdateUser.errors
            ? responseFromUpdateUser.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  loginInViaEmail: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const value = await createUserUtil.generateSignInWithEmailLink(
        request,
        next
      );
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
      } else if (value.success === false) {
        const status = value.status
          ? value.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: value.message,
          errors: value.errors
            ? value.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  emailAuth: async (req, res, next) => {
    try {
      const { params } = req;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.purpose = "auth";
      if (params.purpose) {
        request.query.purpose = params.purpose;
      }

      const value = await createUserUtil.generateSignInWithEmailLink(
        request,
        next
      );
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
      } else if (value.success === false) {
        const status = value.status
          ? value.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: value.message,
          errors: value.errors
            ? value.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateForgottenPassword: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateForgottenPassword =
        await createUserUtil.updateForgottenPassword(request, next);

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
        return res.status(status).json({
          success: false,
          message: responseFromUpdateForgottenPassword.message,
          errors: responseFromUpdateForgottenPassword.errors
            ? responseFromUpdateForgottenPassword.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateKnownPassword: async (req, res, next) => {
    try {
      logText("update known password............");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdatePassword =
        await createUserUtil.updateKnownPassword(request, next);

      if (responseFromUpdatePassword.success === true) {
        const status = responseFromUpdatePassword.status
          ? responseFromUpdatePassword.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdatePassword.message,
          user: responseFromUpdatePassword.data,
        });
      } else if (responseFromUpdatePassword.success === false) {
        const status = responseFromUpdatePassword.status
          ? responseFromUpdatePassword.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdatePassword.message,
          errors: responseFromUpdatePassword.errors
            ? responseFromUpdatePassword.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  subscribeToNewsLetter: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (isEmpty(req.body.tags)) {
        request.body.tags = [];
      }
      const responseFromSubscribeToNewsLetter =
        await createUserUtil.subscribeToNewsLetter(request, next);

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
        return res.status(status).json({
          success: false,
          message: responseFromSubscribeToNewsLetter.message,
          errors: responseFromSubscribeToNewsLetter.errors
            ? responseFromSubscribeToNewsLetter.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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

module.exports = createUser;
