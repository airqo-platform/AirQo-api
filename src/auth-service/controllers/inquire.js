const HTTPStatus = require("http-status");
const inquireUtil = require("../utils/inquire");
const generateFilter = require("../utils/generate-filter");
const validations = require("../utils/validations");
const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const { badRequest } = require("../utils/errors");
const { tryCatchErrors, missingQueryParams } = require("utils/errors");
const { logText, logElement, logObject, logError } = require("../utils/log");
const isEmpty = require("is-empty");

const inquire = {
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      const { fullName, email, message, category } = req.body;

      const { errors, isValid } = validations.inquire(req.body);
      if (!isValid) {
        return res
          .status(HTTPStatus.BAD_REQUEST)
          .json({ success: false, errors, message: "validation error" });
      }

      let request = {};
      request["tenant"] = tenant.toLowerCase();
      request["fullName"] = fullName;
      request["email"] = email;
      request["message"] = message;
      request["category"] = category;

      await inquireUtil
        .create(request, (value) => {
          if (value.success === true) {
            return res.status(value.status).json({
              success: true,
              message: value.message,
              inquiry: value.data,
            });
          }

          if (value.success === false) {
            const errors = value.errors ? value.errors : "";
            return res.status(value.status).json({
              success: false,
              message: value.message,
              errors,
            });
          }
        })
        .catch((error) => {});
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      if (isEmpty(tenant)) {
        missingQueryParams(req, res);
      }
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let responseFromFilter = generateFilter.inquiry(req);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        const responseFromListInquiry = await inquireUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        if (responseFromListInquiry.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListInquiry.message,
            inquiries: responseFromListInquiry.data,
          });
        } else if (responseFromListInquiry.success == false) {
          if (responseFromListInquiry.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListInquiry.message,
              error: responseFromListInquiry.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromListInquiry.message,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          if (responseFromFilter.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromFilter.message,
              error: responseFromFilter.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromFilter.message,
            });
          }
        }
      }
    } catch (e) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }
      const responseFromFilter = generateFilter.inquiry(req);

      if (responseFromFilter.success == true) {
        let responseFromDeleteInquiry = await inquireUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteInquiry.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromDeleteInquiry.message,
            inquiry: responseFromDeleteInquiry.data,
          });
        } else if (responseFromDeleteInquiry.success == false) {
          if (responseFromDeleteInquiry.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromDeleteInquiry.message,
              inquire: responseFromDeleteInquiry.data,
              error: responseFromDeleteInquiry.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromDeleteInquiry.message,
              inquire: responseFromDeleteInquiry.data,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      const { tenant } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }
      const responseFromFilter = generateFilter.inquiry(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateInquiry = await inquireUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateInquiry", responseFromUpdateInquiry);
        if (responseFromUpdateInquiry.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateInquiry.message,
            inquiry: responseFromUpdateInquiry.data,
          });
        } else if (responseFromUpdateInquiry.success == false) {
          if (responseFromUpdateInquiry.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateInquiry.message,
              inquire: responseFromUpdateInquiry.data,
              error: responseFromUpdateInquiry.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromUpdateInquiry.message,
              inquire: responseFromUpdateInquiry.data,
            });
          }
        }
      } else if (responseFromFilter.success == false) {
        if (responseFromFilter.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromFilter.message,
            error: responseFromFilter.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromFilter.message,
          });
        }
      }
    } catch (error) {
      return res.status(HTTPStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },
};

module.exports = inquire;
