const httpStatus = require("http-status");
const blogPostManagementUtil = require("@utils/blog-post-management");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- blog-post-management-controller`
);
const { logText, logObject } = require("@utils/log");

const BlogPostManagementController = {
  edit: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const id = req.params.id;
      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(request.query.tenant)
        ? defaultTenant
        : request.query.tenant;

      const result = await blogPostManagementUtil.edit(id, request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          editedBlogPost: result.data,
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

  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const id = req.params.id;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await blogPostManagementUtil.update(id, requestBody, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          updatedBlogPost: result.data,
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

  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const id = req.params.id;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await blogPostManagementUtil.delete(id, requestBody, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          deletedBlogPost: result.data,
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

  schedule: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const id = req.params.id;
      const requestBody = Object.assign({}, req.body);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      requestBody.tenant = isEmpty(requestBody.tenant)
        ? defaultTenant
        : requestBody.tenant;

      const result = await blogPostManagementUtil.schedule(
        id,
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
          scheduledBlogPost: result.data,
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

  history: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const id = req.params.id;
      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(request.query.tenant)
        ? defaultTenant
        : request.query.tenant;

      const result = await blogPostManagementUtil.history(id, request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: result.message,
          blogPostHistory: result.data,
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

module.exports = BlogPostManagementController;
