const httpStatus = require("http-status");
const contentModerationUtil = require("@utils/content-moderation");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- content-moderation-controller`
);
const { logText, logObject } = require("@utils/log");

const ContentModerationController = {
  listRegistrations: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(request.query.tenant)
        ? defaultTenant
        : request.query.tenant;

      const result = await contentModerationUtil.listRegistrations(
        request,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          registrationsData: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  approveRegistration: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const userId = req.params.userId;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await contentModerationUtil.approveRegistration(
        userId,
        requestBody,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          approvedRegistration: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  rejectRegistration: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const userId = req.params.userId;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await contentModerationUtil.rejectRegistration(
        userId,
        requestBody,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          rejectedRegistration: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  flagPost: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const postId = req.params.postId;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await contentModerationUtil.flagPost(
        postId,
        requestBody,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          flaggedPost: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  viewFlags: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const postId = req.params.postId;
      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(request.query.tenant)
        ? defaultTenant
        : request.query.tenant;

      const result = await contentModerationUtil.viewFlags(
        postId,
        request,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          flagsData: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  suspendUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const userId = req.params.userId;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await contentModerationUtil.suspendUser(
        userId,
        requestBody,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          suspendedUser: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },

  banUser: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const userId = req.params.userId;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await contentModerationUtil.banUser(
        userId,
        requestBody,
        next
      );
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          bannedUser: result.data,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = result.errors
          ? result.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: result.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
      return;
    }
  },
};

module.exports = ContentModerationController;
