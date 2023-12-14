const httpStatus = require("http-status");
const createInquiryUtil = require("../utils/create-inquiry");
const generateFilter = require("@utils/generate-filter");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- inquire-controller`
);

const inquire = {
  create: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = { ...req.body };
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const value = await createInquiryUtil.create(request);

      if (value.success === true) {
        const status = value.status ? value.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: value.message,
          inquiry: value.data,
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
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  list: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let { tenant, limit, skip } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      let responseFromFilter = generateFilter.inquiry(req);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        const responseFromListInquiry = await createInquiryUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        if (responseFromListInquiry.success === true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromListInquiry.message,
            inquiries: responseFromListInquiry.data,
          });
        } else if (responseFromListInquiry.success === false) {
          if (responseFromListInquiry.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListInquiry.message,
              error: responseFromListInquiry.error,
            });
          } else {
            return res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromListInquiry.message,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
        if (responseFromFilter.error) {
          if (responseFromFilter.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromFilter.message,
              error: responseFromFilter.error,
            });
          } else {
            return res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromFilter.message,
            });
          }
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  delete: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromFilter = generateFilter.inquiry(req);

      if (responseFromFilter.success === true) {
        let responseFromDeleteInquiry = await createInquiryUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteInquiry.success === true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromDeleteInquiry.message,
            inquiry: responseFromDeleteInquiry.data,
          });
        } else if (responseFromDeleteInquiry.success === false) {
          if (responseFromDeleteInquiry.error) {
            res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromDeleteInquiry.message,
              inquire: responseFromDeleteInquiry.data,
              error: responseFromDeleteInquiry.error,
            });
          } else {
            res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromDeleteInquiry.message,
              inquire: responseFromDeleteInquiry.data,
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
          return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
  update: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromFilter = generateFilter.inquiry(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateInquiry = await createInquiryUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateInquiry", responseFromUpdateInquiry);
        if (responseFromUpdateInquiry.success === true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromUpdateInquiry.message,
            inquiry: responseFromUpdateInquiry.data,
          });
        } else if (responseFromUpdateInquiry.success === false) {
          if (responseFromUpdateInquiry.error) {
            res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateInquiry.message,
              inquire: responseFromUpdateInquiry.data,
              error: responseFromUpdateInquiry.error,
            });
          } else {
            res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromUpdateInquiry.message,
              inquire: responseFromUpdateInquiry.data,
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
          return res.status(httpStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },
};

module.exports = inquire;
