const httpStatus = require("http-status");
const userUtil = require("@utils/user.util");
const {
  HttpError,
  extractErrorsFromRequest,
  logObject,
  logText,
  stringify,
} = require("@utils/shared");
const isEmpty = require("is-empty");
const tokenUtil = require("@utils/token.util");
const constants = require("@config/constants");
const { AbstractTokenFactory } = require("@services/atf.service");
const log4js = require("log4js");
const UserModel = require("@models/User");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- user controller`);

const handleRequest = (req, next) => {
  const errors = extractErrorsFromRequest(req);
  if (errors) {
    next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
    return null;
  }
  const request = req;
  request.body = request.body || {};
  request.query = request.query || {};
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  request.query.tenant = isEmpty(req.query.tenant)
    ? defaultTenant
    : req.query.tenant;
  return request;
};

const handleError = (error, next) => {
  logger.error(`🐛🐛 Internal Server Error`, error?.stack || error);
  if (error instanceof HttpError) {
    return next(error);
  }
  const expose = process.env.NODE_ENV !== "production";
  next(
    new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
      message: expose ? error.message : "An unexpected error occurred",
    })
  );
};

const sendResponse = (res, result, dataKey = "data") => {
  if (isEmpty(result) || res.headersSent) {
    return;
  }

  const isSuccess = result.success;
  const defaultStatus = isSuccess
    ? httpStatus.OK
    : httpStatus.INTERNAL_SERVER_ERROR;
  const status = result.status || defaultStatus;

  if (isSuccess) {
    return res.status(status).json({
      success: true,
      message: result.message,
      [dataKey]: result.data,
    });
  }

  return res.status(status).json({
    success: false,
    message: result.message,
    errors: result.errors || { message: "Internal Server Error" },
  });
};

const userController = {
  listStatistics: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const { tenant } = request.query;
      const result = await userUtil.listStatistics(tenant, next);
      sendResponse(res, result, "users_stats");
    } catch (error) {
      handleError(error, next);
    }
  },
  listLogs: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.listLogs(request, next);
      sendResponse(res, result, "users_stats");
    } catch (error) {
      handleError(error, next);
    }
  },
  getUserStats: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.getUserStats(request, next);
      sendResponse(res, result, "users_stats");
    } catch (error) {
      handleError(error, next);
    }
  },
  listCache: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.listCache(request, next);
      sendResponse(res, result, "users");
    } catch (error) {
      handleError(error, next);
    }
  },
  list: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.list(request, next);
      sendResponse(res, result, "users");
    } catch (error) {
      handleError(error, next);
    }
  },
  listUsersAndAccessRequests: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.listUsersAndAccessRequests(request, next);
      sendResponse(res, result, "users");
    } catch (error) {
      handleError(error, next);
    }
  },
  googleCallback: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors)
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      const request = handleRequest(req, next);
      if (!request) return;

      // --- FIX: Perform role cleanup and other updates on login ---
      await userUtil.ensureDefaultAirqoRole(req.user, request.query.tenant);

      // --- FIX: Re-fetch the user to get the cleaned-up data before generating the token ---
      const freshUser = await UserModel(request.query.tenant).findById(
        req.user._id
      );

      const userDetails = await freshUser.toAuthJSON();
      const token = userDetails.token;
      logger.info("Google login succeeded for user", { userId: req.user._id });

      // Fire-and-forget: Update user stats without blocking the login response.
      (async () => {
        try {
          const currentDate = new Date();
          await UserModel(request.query.tenant).findByIdAndUpdate(
            req.user._id,
            {
              $set: { lastLogin: currentDate, isActive: true },
              $inc: { loginCount: 1 },
              ...(req.user.analyticsVersion !== 3 && req.user.verified === false
                ? { $set: { verified: true } }
                : {}),
            },
            { new: true, upsert: false, runValidators: true }
          );
        } catch (error) {
          logger.error(
            `🐛🐛 Google login stats update error -- ${stringify(error)}`
          );
        }
      })();

      // Set the token as an HTTP-only cookie
      res.cookie("access_token", token, {
        httpOnly: true,
        secure: true, // Enable if using HTTPS
      });

      if (constants.ENVIRONMENT === "STAGING ENVIRONMENT") {
        // Create a temporary, non-httpOnly cookie for debugging:
        res.cookie("temp_access_token", token, {
          httpOnly: false, // Set to false for debugging
          secure: true, // But keep secure: true (if using HTTPS)
        });
      }

      res.redirect(
        `${constants.GMAIL_VERIFICATION_SUCCESS_REDIRECT}/xyz/Home?success=google`
      );
    } catch (error) {
      handleError(error, next);
    }
  },

  verify: async (req, res, next) => {
    try {
      if (!res.headersSent) {
        res.status(httpStatus.OK).send("this token is valid");
        return;
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  verifyEmail: async (req, res, next) => {
    try {
      logger.info("we are verifying the email.....");
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await tokenUtil.verifyEmail(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  deleteMobileUserData: async (req, res, next) => {
    try {
      logger.info("We are deleting the app data.....");
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.deleteMobileUserData(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  emailReport: async (req, res, next) => {
    try {
      // Check if at least one file is uploaded
      if (!req.files || Object.keys(req.files).length === 0) {
        return next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Please attach a PDF or CSV file.",
          })
        );
      }

      let pdfFile, csvFile;

      if (req.files.pdf) {
        pdfFile = req.files.pdf;
        if (!pdfFile.mimetype.includes("pdf")) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid PDF file",
            })
          );
        }
      }

      if (req.files.csv) {
        csvFile = req.files.csv;
        if (!csvFile.mimetype.includes("csv")) {
          return next(
            new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
              message: "Invalid CSV file",
            })
          );
        }
      }

      const errors = extractErrorsFromRequest(req);
      if (errors) {
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }

      const request = handleRequest(req, next);
      if (!request) return;
      request.pdfFile = pdfFile; // Attach files to the request object
      request.csvFile = csvFile;
      const result = await userUtil.emailReport(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  lookUpFirebaseUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors)
        return next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.lookUpFirebaseUser(request, next);
      sendResponse(res, result[0], "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  syncAnalyticsAndMobile: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.syncAnalyticsAndMobile(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  signUpWithFirebase: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.signUpWithFirebase(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  loginWithFirebase: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.loginWithFirebase(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  verifyFirebaseCustomToken: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.verifyFirebaseCustomToken(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  createFirebaseUser: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.createFirebaseUser(request, next);
      sendResponse(res, result[0], "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  sendFeedback: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.sendFeedback(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  forgot: async (req, res, next) => {
    logger.info("...........................................");
    logger.info("forgot password...");
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.forgotPassword(request, next);
      sendResponse(res, result, "response");
    } catch (error) {
      handleError(error, next);
    }
  },
  register: async (req, res, next) => {
    logger.info("..................................................");
    logger.info("register user.............");
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.register(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  create: async (req, res, next) => {
    logger.info("..................................................");
    logger.info("create user.............");
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.create(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  login: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      if (req.auth.success === true) {
        // Centralize login logic by using the enhanced utility
        const enhancedLoginResult = await userUtil.loginWithEnhancedTokens(
          request,
          next
        );

        if (enhancedLoginResult.success) {
          const { data } = enhancedLoginResult;
          // --- FIX: Reconstruct the response to be fully backward-compatible ---
          // This includes all the user profile fields the mobile app and other clients likely expect.
          const userResponse = {
            _id: data._id,
            token: data.token,
            email: data.email,
            firstName: data.firstName,
            lastName: data.lastName,
            userName: data.userName,
            privilege: data.privilege,
            organization: data.organization,
            long_organization: data.long_organization,
            profilePicture: data.profilePicture,
            country: data.country,
            phoneNumber: data.phoneNumber,
            verified: data.verified,
            isActive: data.isActive,
          };
          return res.status(httpStatus.OK).json(userResponse);
        } else {
          // Pass along the error from the utility
          return sendResponse(res, enhancedLoginResult);
        }
      } else {
        throw new HttpError(req.auth.message, req.auth.status);
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  loginWithDetails: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      if (req.auth.success === true) {
        // Centralize login logic by using the enhanced utility
        const enhancedLoginResult = await userUtil.loginWithEnhancedTokens(
          request,
          next
        );

        if (enhancedLoginResult.success) {
          const { data } = enhancedLoginResult;
          // The enhanced response is already very detailed.
          // We can format it to match the old structure or return the new, richer object.
          // Returning the new object is an enhancement.
          const response = {
            _id: data._id,
            userName: data.userName,
            token: data.token,
            email: data.email,
            details: data, // The entire enhanced object becomes the 'details'
          };
          return res.status(httpStatus.OK).json(response);
        } else {
          // Pass along the error from the utility
          return sendResponse(res, enhancedLoginResult);
        }
      } else {
        throw new HttpError(req.auth.message, req.auth.status);
      }
    } catch (error) {
      handleError(error, next);
    }
  },

  logout: async (req, res, next) => {
    try {
      logger.info("..................................");
      logger.info("user logout......");
      const request = handleRequest(req, next);
      if (!request) return;

      return res
        .status(httpStatus.NOT_IMPLEMENTED)
        .json({ success: false, message: "not yet implemented" });

      req.logout((err) => {
        if (err) {
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      handleError(error, next);
    }
  },
  guest: (req, res, next) => {
    try {
      logger.info("..................................");
      logger.info("user guest login......");
      const request = handleRequest(req, next);
      if (!request) return;
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
      handleError(error, next);
    }
  },
  delete: async (req, res, next) => {
    try {
      logger.info(".................................................");
      logger.info("inside delete user............");
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.delete(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  update: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.update(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  loginInViaEmail: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      request.query.purpose = "login";
      const result = await userUtil.generateSignInWithEmailLink(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  emailAuth: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const { params } = request;
      request.query.purpose = "auth";
      if (params.purpose) {
        request.query.purpose = params.purpose;
      }
      const result = await userUtil.generateSignInWithEmailLink(request, next);
      sendResponse(res, result);
    } catch (error) {
      handleError(error, next);
    }
  },
  updateForgottenPassword: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.updateForgottenPassword(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  updateKnownPassword: async (req, res, next) => {
    try {
      logger.info("update known password............");
      const request = handleRequest(req, next);
      if (!request) return;
      const result = await userUtil.updateKnownPassword(request, next);
      sendResponse(res, result, "user");
    } catch (error) {
      handleError(error, next);
    }
  },
  resetPasswordRequest: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const { email } = req.body;
      const tenant = req.query.tenant;
      const token = userUtil.generateNumericToken(5);
      const result = await userUtil.initiatePasswordReset(
        {
          email,
          token,
          tenant,
        },
        next
      );

      res
        .status(httpStatus.OK)
        .json({ success: true, message: result.message });
    } catch (error) {
      handleError(error, next);
    }
  },
  resetPassword: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const { token } = req.params;
      const { password } = req.body;

      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      const tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.resetPassword(
        {
          token,
          password,
          tenant,
        },
        next
      );

      res
        .status(httpStatus.OK)
        .json({ success: true, message: result.message });
    } catch (error) {
      logObject("error in controller", error);
      handleError(error, next);
    }
  },

  registerMobileUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.body.analyticsVersion = 4;

      const result = await userUtil.registerMobileUser(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        res
          .status(httpStatus.CREATED)
          .json({ success: true, message: result.message, data: result.user });
      } else {
        next(new HttpError(result.message, httpStatus.BAD_REQUEST));
      }
    } catch (error) {
      handleError(error, next);
    }
  },

  verifyMobileEmail: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.verifyMobileEmail(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }
      if (result.success) {
        res
          .status(httpStatus.OK)
          .json({ success: true, message: result.message, data: result.user });
      } else {
        next(new HttpError(result.message, httpStatus.BAD_REQUEST));
      }
    } catch (error) {
      handleError(error, next);
    }
  },

  subscribeToNewsLetter: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (isEmpty(req.body.tags)) {
        request.body.tags = [];
      }
      const result = await userUtil.subscribeToNewsLetter(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  reSubscribeToNewsLetter: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (isEmpty(req.body.tags)) {
        request.body.tags = [];
      }
      const result = await userUtil.reSubscribeToNewsLetter(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  unSubscribeFromNewsLetter: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      if (isEmpty(req.body.tags)) {
        request.body.tags = [];
      }
      const result = await userUtil.unSubscribeFromNewsLetter(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  /***************************** notifications  ***********************/
  subscribeToNotifications: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.subscribeToNotifications(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  unSubscribeFromNotifications: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.unSubscribeFromNotifications(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  checkNotificationStatus: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.checkNotificationStatus(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          message: result.message,
          success: true,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  getOrganizationBySlug: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.getOrganizationBySlug(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },

  registerViaOrgSlug: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.registerViaOrgSlug(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          data: result.data,
        });
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors,
        });
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  cleanup: async (req, res, next) => {
    try {
      logText("Performing user data cleanup...");
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await userUtil.cleanup(request, next);

      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json(result);
      } else {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json(result);
      }
    } catch (error) {
      handleError(error, next);
    }
  },
  /**
   * Enhanced login endpoint with comprehensive role/permission data and optimized tokens
   * @route POST /api/v2/users/loginEnhanced
   */
  loginEnhanced: async (req, res, next) => {
    try {
      const request = handleRequest(req, next);
      if (!request) return;

      // Add debug info flag if in development
      if (
        process.env.NODE_ENV === "development" &&
        !request.body.includeDebugInfo
      ) {
        request.body.includeDebugInfo = req.query.debug === "true";
      }

      console.log("🔐 Enhanced login controller processing:", {
        email: request.body.email,
        tenant: request.query.tenant,
        strategy: constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS,
        debug: request.body.includeDebugInfo,
      });

      const result = await userUtil.loginWithEnhancedTokens(request, next);

      if (result.success) {
        // logger.info("Enhanced login successful");
        // console.log("✅ Enhanced login successful in controller");
      } else {
        logger.info("Enhanced login failed");
        console.log("❌ Enhanced login failed in controller:", result.message);
      }

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Enhanced login controller error: ${error.message}`);
      handleError(error, next);
    }
  },

  /**
   * Generate optimized token for existing session
   * @route POST /api/v2/users/generateToken
   */
  generateOptimizedToken: async (req, res, next) => {
    try {
      logger.info("Generate optimized token endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      console.log("🔧 Token generation requested:", {
        userId: request.body.userId,
        strategy: request.body.strategy,
        tenant: request.query.tenant,
      });

      const result = await userUtil.generateOptimizedToken(request, next);

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Token generation controller error: ${error.message}`);
      handleError(error, next);
    }
  },

  /**
   * Refresh user permissions and optionally regenerate token
   * @route POST /api/v2/users/refreshPermissions
   */
  refreshPermissions: async (req, res, next) => {
    try {
      logger.info("Refresh permissions endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      console.log("🔄 Permission refresh requested:", {
        userId: request.body.userId || request.user?._id,
        strategy: request.body.strategy,
        tenant: request.query.tenant,
      });

      // Use userId from body or from authenticated user
      if (!request.body.userId && request.user?._id) {
        request.body.userId = request.user._id;
      }

      const result = await userUtil.refreshUserPermissions(request, next);

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Permission refresh controller error: ${error.message}`);
      handleError(error, next);
    }
  },

  /**
   * Analyze token sizes across different strategies for a user
   * @route GET /api/v2/users/analyzeTokens/:userId
   */
  analyzeTokenStrategies: async (req, res, next) => {
    try {
      logger.info("Token analysis endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      // Get userId from params
      request.body.userId = req.params.userId || req.user?._id;

      if (!request.body.userId) {
        return next(
          new HttpError("User ID is required", httpStatus.BAD_REQUEST, {
            userId: "User ID must be provided in URL params",
          })
        );
      }

      console.log("📊 Token analysis requested:", {
        userId: request.body.userId,
        tenant: request.query.tenant,
      });

      const result = await userUtil.analyzeTokenStrategies(request, next);

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Token analysis controller error: ${error.message}`);
      handleError(error, next);
    }
  },

  /**
   * Get user permissions in a specific context (group/network)
   * @route GET /api/v2/users/contextPermissions
   */
  getContextPermissions: async (req, res, next) => {
    try {
      logger.info("Context permissions endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      // Get parameters from various sources
      request.body.userId =
        req.query.userId || req.body.userId || req.user?._id;
      request.body.contextId = req.query.contextId || req.body.contextId;
      request.body.contextType = req.query.contextType || req.body.contextType;

      if (!request.body.userId) {
        return next(
          new HttpError("User ID is required", httpStatus.BAD_REQUEST, {
            userId: "User ID must be provided",
          })
        );
      }

      console.log("🏢 Context permissions requested:", {
        userId: request.body.userId,
        contextId: request.body.contextId,
        contextType: request.body.contextType,
        tenant: request.query.tenant,
      });

      const result = await userUtil.getUserContextPermissions(request, next);

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Context permissions controller error: ${error.message}`);
      handleError(error, next);
    }
  },

  /**
   * Update user's preferred token strategy
   * @route PUT /api/v2/users/tokenStrategy
   */
  updateTokenStrategy: async (req, res, next) => {
    try {
      logger.info("Update token strategy endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      // Use userId from body or from authenticated user
      if (!request.body.userId && request.user?._id) {
        request.body.userId = request.user._id;
      }

      if (!request.body.userId) {
        return next(
          new HttpError("User ID is required", httpStatus.BAD_REQUEST, {
            userId: "User ID must be provided",
          })
        );
      }

      if (!request.body.strategy) {
        return next(
          new HttpError("Strategy is required", httpStatus.BAD_REQUEST, {
            strategy: "Token strategy must be provided",
          })
        );
      }

      console.log("🎯 Token strategy update requested:", {
        userId: request.body.userId,
        strategy: request.body.strategy,
        tenant: request.query.tenant,
      });

      const result = await userUtil.updateTokenStrategy(request, next);

      return sendResponse(res, result);
    } catch (error) {
      logger.error(
        `🐛 Token strategy update controller error: ${error.message}`
      );
      handleError(error, next);
    }
  },

  /**
   * Get comprehensive user profile with all permissions and roles
   * @route GET /api/v2/users/profile/enhanced
   */
  getEnhancedProfile: async (req, res, next) => {
    try {
      logger.info("Enhanced profile endpoint called");

      // Check authentication first before handleRequest
      const userId = req.user?._id;
      if (!userId) {
        logger.warn("Enhanced profile accessed without authentication", {
          headers: req.headers.authorization ? "token present" : "no token",
          user: req.user ? "user object exists" : "no user object",
        });

        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            auth: "User must be authenticated to access profile",
          })
        );
      }

      const request = handleRequest(req, next);
      if (!request) return;

      const { tenant } = request.query;

      console.log("👤 Enhanced profile requested:", {
        userId,
        tenant,
      });

      // Get user permissions context
      const permissionsRequest = {
        body: { userId }, // Use body instead of params for getUserContextPermissions
        query: { tenant },
      };

      const permissionsResult = await userUtil.getUserContextPermissions(
        permissionsRequest,
        next
      );

      if (!permissionsResult.success) {
        logger.error("Failed to get user permissions for profile", {
          userId,
          tenant,
          error: permissionsResult.message,
        });
        return sendResponse(res, permissionsResult);
      }

      const UserModel = require("@models/User");

      // First get the basic user data
      const basicUser = await UserModel(tenant)
        .findById(userId)
        .select("-password -resetPasswordToken -resetPasswordExpires")
        .lean();

      if (!basicUser) {
        logger.warn("User not found for enhanced profile", { userId, tenant });
        return next(
          new HttpError("User not found", httpStatus.NOT_FOUND, {
            user: "User profile not found",
          })
        );
      }

      // Manually populate group_roles.group if they exist
      let populatedUser = { ...basicUser };

      if (basicUser.group_roles && basicUser.group_roles.length > 0) {
        try {
          const GroupModel = require("@models/Group");
          const groupIds = basicUser.group_roles.map((gr) => gr.group);

          const groups = await GroupModel(tenant)
            .find({ _id: { $in: groupIds } })
            .select("grp_title grp_status organization_slug")
            .lean();

          // Map groups back to group_roles
          populatedUser.group_roles = basicUser.group_roles.map(
            (groupRole) => ({
              ...groupRole,
              group:
                groups.find(
                  (g) => g._id.toString() === groupRole.group.toString()
                ) || groupRole.group,
            })
          );
        } catch (error) {
          logger.warn(`Could not populate group roles: ${error.message}`);
          populatedUser.group_roles = basicUser.group_roles;
        }
      }

      // Manually populate network_roles.network if they exist
      if (basicUser.network_roles && basicUser.network_roles.length > 0) {
        try {
          const NetworkModel = require("@models/Network");
          const networkIds = basicUser.network_roles.map((nr) => nr.network);

          const networks = await NetworkModel(tenant)
            .find({ _id: { $in: networkIds } })
            .select("net_name net_status net_acronym")
            .lean();

          // Map networks back to network_roles
          populatedUser.network_roles = basicUser.network_roles.map(
            (networkRole) => ({
              ...networkRole,
              network:
                networks.find(
                  (n) => n._id.toString() === networkRole.network.toString()
                ) || networkRole.network,
            })
          );
        } catch (error) {
          // If Network model doesn't exist or fails, keep original network_roles
          logger.warn(`Could not populate network roles: ${error.message}`);
          populatedUser.network_roles = basicUser.network_roles;
        }
      }

      const user = populatedUser;

      const enhancedProfile = {
        // Basic user info
        ...user,

        // Enhanced permissions and roles
        ...permissionsResult.data.permissions,

        // Profile metadata
        profileLastUpdated: new Date().toISOString(),
        hasEnhancedPermissions: true,

        // Context summary
        contextSummary: {
          totalPermissions:
            permissionsResult.data.permissions?.allPermissions?.length || 0,
          groupMemberships:
            permissionsResult.data.permissions?.groupMemberships?.length || 0,
          networkMemberships:
            permissionsResult.data.permissions?.networkMemberships?.length || 0,
          isSuperAdmin:
            permissionsResult.data.permissions?.isSuperAdmin || false,
        },
      };

      const result = {
        success: true,
        message: "Enhanced profile retrieved successfully",
        data: enhancedProfile,
        status: httpStatus.OK,
      };

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Enhanced profile controller error: ${error.message}`);
      console.error("❌ Enhanced profile error details:", {
        error: error.message,
        stack: error.stack?.substring(0, 500),
        userId: req.user?._id,
        hasAuth: !!req.headers.authorization,
      });

      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "Failed to retrieve enhanced profile",
          }
        )
      );
    }
  },

  /**
   * Legacy login compatibility endpoint
   * @route POST /api/v2/users/login
   */
  loginLegacyCompatible: async (req, res, next) => {
    try {
      logger.info("Legacy compatible login endpoint called");
      const request = handleRequest(req, next);
      if (!request) return;

      // Force default strategy for backward compatibility
      request.body.preferredStrategy =
        constants.TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS;

      console.log("🔄 Legacy compatible login requested:", {
        email: request.body.email,
        tenant: request.query.tenant,
      });

      const result = await userUtil.loginWithEnhancedTokens(request, next);

      if (result.success) {
        // Transform response to match legacy format while including enhanced data
        const legacyResponse = {
          _id: result.data._id,
          userName: result.data.userName,
          token: result.data.token,
          email: result.data.email,
          firstName: result.data.firstName,
          lastName: result.data.lastName,
          userType: result.data.userType,
          organization: result.data.organization,
          long_organization: result.data.long_organization,
          privilege: result.data.privilege,

          // Enhanced fields (optional for clients that can handle them)
          permissions: result.data.permissions,
          groupMemberships: result.data.groupMemberships,
          networkMemberships: result.data.networkMemberships,
          isSuperAdmin: result.data.isSuperAdmin,
        };

        const legacyResult = {
          ...result,
          data: legacyResponse,
        };

        return sendResponse(res, legacyResult);
      }

      return sendResponse(res, result);
    } catch (error) {
      logger.error(`🐛 Legacy login controller error: ${error.message}`);
      handleError(error, next);
    }
  },
};

module.exports = userController;
