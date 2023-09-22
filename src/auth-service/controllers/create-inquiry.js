const httpStatus = require("http-status");
const createInquiryUtil = require("../utils/create-inquiry");
const generateFilter = require("../utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const { logText, logElement, logObject, logError } = require("../utils/log");
const isEmpty = require("is-empty");
const constants = require("../config/constants");

const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- inquire-controller`
);

const inquire = {
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const errorResponse = badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
        return errorResponse;
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      const { fullName, email, message, category, firstName, lastName } =
        req.body;

      let request = {};
      request["tenant"] = tenant.toLowerCase();
      request["fullName"] = fullName;
      request["email"] = email;
      request["message"] = message;
      request["category"] = category;
      request["firstName"] = firstName;
      request["lastName"] = lastName;

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
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let responseFromFilter = generateFilter.inquiry(req);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        const responseFromListInquiry = await createInquiryUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        if (responseFromListInquiry.success == true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromListInquiry.message,
            inquiries: responseFromListInquiry.data,
          });
        } else if (responseFromListInquiry.success == false) {
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
      } else if (responseFromFilter.success == false) {
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
    } catch (e) {
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: e.message,
      });
    }
  },

  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      const responseFromFilter = generateFilter.inquiry(req);

      if (responseFromFilter.success == true) {
        let responseFromDeleteInquiry = await createInquiryUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteInquiry.success == true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromDeleteInquiry.message,
            inquiry: responseFromDeleteInquiry.data,
          });
        } else if (responseFromDeleteInquiry.success == false) {
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
      } else if (responseFromFilter.success == false) {
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
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
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
      const responseFromFilter = generateFilter.inquiry(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateInquiry = await createInquiryUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateInquiry", responseFromUpdateInquiry);
        if (responseFromUpdateInquiry.success == true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromUpdateInquiry.message,
            inquiry: responseFromUpdateInquiry.data,
          });
        } else if (responseFromUpdateInquiry.success == false) {
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
      } else if (responseFromFilter.success == false) {
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
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },
};

module.exports = inquire;
