const httpStatus = require("http-status");
const createInquiryUtil = require("@utils/create-inquiry");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- inquiry-controller`
);

const inquiry = {
  create: async (req, res, next) => {
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
      const inquiryResponse = await createInquiryUtil.create(request, next);

      if (inquiryResponse.success === true) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: inquiryResponse.message,
          inquiry: inquiryResponse.data,
        });
      } else if (inquiryResponse.success === false) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: inquiryResponse.message,
          errors: inquiryResponse.errors
            ? inquiryResponse.errors
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

      const inquiryResponse = await createInquiryUtil.list(request, next);
      if (inquiryResponse.success === true) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: inquiryResponse.message,
          inquiries: inquiryResponse.data,
        });
      } else if (inquiryResponse.success === false) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: inquiryResponse.message,
          errors: inquiryResponse.errors
            ? inquiryResponse.errors
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
  delete: async (req, res, next) => {
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
      const inquiryResponse = await createInquiryUtil.delete(request, next);

      if (inquiryResponse.success === true) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: inquiryResponse.message,
          deleted_inquiry: inquiryResponse.data,
        });
      } else if (inquiryResponse.success === false) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: inquiryResponse.message,
          errors: inquiryResponse.errors
            ? inquiryResponse.errors
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

      const inquiryResponse = await createInquiryUtil.update(request, next);

      if (inquiryResponse.success === true) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: inquiryResponse.message,
          updated_inquiry: inquiryResponse.data,
        });
      } else if (inquiryResponse.success === false) {
        const status = inquiryResponse.status
          ? inquiryResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: inquiryResponse.message,
          errors: inquiryResponse.errors
            ? inquiryResponse.errors
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
};

module.exports = inquiry;
