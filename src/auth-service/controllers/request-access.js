const HTTPStatus = require("http-status");
const requestUtil = require("../utils/request-access");
const generateFilter = require("../utils/generate-filter");
const validations = require("../utils/validations");
const { validationResult } = require("express-validator");
const { missingQueryParams } = require("utils/errors");
const { logObject } = require("../utils/log");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger("request-controller");
const errorsUtil = require("../utils/errors");

const candidate = {
  create: async (req, res) => {
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
      const {
        firstName,
        lastName,
        email,
        long_organization,
        jobTitle,
        website,
        description,
        category,
      } = req.body;

      let request = {};
      request["tenant"] = tenant;
      request["firstName"] = firstName;
      request["lastName"] = lastName;
      request["email"] = email;
      request["long_organization"] = long_organization;
      request["jobTitle"] = jobTitle;
      request["website"] = website;
      request["description"] = description;
      request["category"] = category;

      await requestUtil
        .create(request, (value) => {
          if (value.success === true) {
            const status = value.status ? value.status : HTTPStatus.OK;
            return res.status(status).json({
              success: true,
              message: value.message,
            });
          } else if (value.success === false) {
            const errors = value.errors ? value.errors : { message: "" };
            const status = value.status
              ? value.status
              : HTTPStatus.INTERNAL_SERVER_ERROR;
            return res.status(status).json({
              success: false,
              message: value.message,
              errors,
            });
          }
        })
        .catch((error) => {
          return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error",
            errors: { message: error },
          });
        });
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Errorsr",
        errors: { message: error.message },
      });
    }
  },

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
      const { tenant } = req.query;
      const limit = parseInt(req.query.limit, 0);
      const skip = parseInt(req.query.skip, 0);
      let responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        const responseFromListCandidate = await requestUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        if (responseFromListCandidate.success === true) {
          const candidates = responseFromListCandidate.data.filter(
            (element) => element.isEmailVerified === true
          );
          const status = responseFromListCandidate.status
            ? responseFromListCandidate.status
            : HTTPStatus.OK;
          return res.status(status).json({
            success: true,
            message: "successfully retrieved the verified candidates",
            candidates,
          });
        } else if (responseFromListCandidate.success === false) {
          const errors = responseFromListCandidate.errors
            ? responseFromListCandidate.errors
            : { message: "" };

          const status = responseFromListCandidate.status
            ? responseFromListCandidate.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;

          return res.status(status).json({
            success: false,
            message: responseFromListCandidate.message,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        const errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };

        const status = responseFromFilter.status
          ? responseFromFilter.status
          : "";

        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "controller server error",
        errors: { message: e.message },
      });
    }
  },
  confirm: async (req, res) => {
    console.log("inside the confirm candidate");
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const {
        firstName,
        lastName,
        email,
        long_organization,
        jobTitle,
        website,
        category,
        description,
      } = req.body;

      const { errors, isValid } = validations.candidate(req.body);
      if (!isValid) {
        return res
          .status(HTTPStatus.BAD_REQUEST)
          .json({ success: false, errors, message: "validation error" });
      }

      const { tenant } = req.query;
      if (!tenant) {
        missingQueryParams(req, res);
      }
      let responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        logObject("the filter in controller", filter);
        let request = {};
        request["tenant"] = tenant.toLowerCase();
        request["firstName"] = firstName;
        request["lastName"] = lastName;
        request["email"] = email;
        request["organization"] = tenant;
        request["long_organization"] = long_organization;
        request["jobTitle"] = jobTitle;
        request["website"] = website;
        request["description"] = description;
        request["category"] = category;
        request["filter"] = filter;

        let responseFromConfirmCandidate = await requestUtil.confirm(request);

        logObject("responseFromConfirmCandidate", responseFromConfirmCandidate);
        if (responseFromConfirmCandidate.success === true) {
          let status = responseFromConfirmCandidate.status
            ? responseFromConfirmCandidate.status
            : HTTPStatus.OK;
          return res.status(status).json({
            success: true,
            message: responseFromConfirmCandidate.message,
            user: responseFromConfirmCandidate.data,
          });
        } else if (responseFromConfirmCandidate.success === false) {
          let status = responseFromConfirmCandidate.status
            ? responseFromConfirmCandidate.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;

          let errors = responseFromConfirmCandidate.errors
            ? responseFromConfirmCandidate.errors
            : "";

          res.status(status).json({
            success: false,
            message: responseFromConfirmCandidate.message,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        const errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        const status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (e) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },
  delete: async (req, res) => {
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

      const responseFromFilter = generateFilter.candidates(req);

      if (responseFromFilter.success === true) {
        let responseFromDeleteCandidate = await requestUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteCandidate.success === true) {
          const status = responseFromDeleteCandidate.status
            ? responseFromDeleteCandidate.status
            : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromDeleteCandidate.message,
            candidate: responseFromDeleteCandidate.data,
          });
        } else if (responseFromDeleteCandidate.success === false) {
          const errors = responseFromDeleteCandidate.errors
            ? responseFromDeleteCandidate.errors
            : { message: "" };
          const status = responseFromDeleteCandidate.status
            ? responseFromDeleteCandidate.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;
          res.status(status).json({
            success: false,
            message: responseFromDeleteCandidate.message,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        const errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        const status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
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

      const responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateCandidate = await requestUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateCandidate", responseFromUpdateCandidate);
        if (responseFromUpdateCandidate.success === true) {
          const status = responseFromUpdateCandidate.status
            ? responseFromUpdateCandidate.status
            : HTTPStatus.OK;
          res.status(status).json({
            success: true,
            message: responseFromUpdateCandidate.message,
            candidate: responseFromUpdateCandidate.data,
          });
        } else if (responseFromUpdateCandidate.success === false) {
          const errors = responseFromUpdateCandidate.errors
            ? responseFromUpdateCandidate.errors
            : { message: "" };
          const status = responseFromUpdateCandidate.status
            ? responseFromUpdateCandidate.status
            : HTTPStatus.INTERNAL_SERVER_ERROR;

          return res.status(status).json({
            success: false,
            message: responseFromUpdateCandidate.message,
            errors,
          });
        }
      } else if (responseFromFilter.success === false) {
        const errors = responseFromFilter.errors
          ? responseFromFilter.errors
          : { message: "" };
        const status = responseFromFilter.status
          ? responseFromFilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromFilter.message,
          errors,
        });
      }
    } catch (error) {
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  confirmEmail: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      const { tenant, confirmationCode } = req.query;

      let filter = {};
      filter["confirmationCode"] = confirmationCode;
      filter["isEmailVerified"] = false;

      let updateRequestBody = {};
      updateRequestBody["isEmailVerified"] = true;

      let responseFromUpdateCandidate = await requestUtil.update(
        tenant,
        filter,
        updateRequestBody
      );

      logObject("responseFromUpdateCandidate", responseFromUpdateCandidate);

      if (responseFromUpdateCandidate.success === true) {
        const status = responseFromUpdateCandidate.status
          ? responseFromUpdateCandidate.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully confirmed the candidate's email",
          confirmed_candidate: responseFromUpdateCandidate.data,
        });
      } else if (responseFromUpdateCandidate.success === false) {
        const status = responseFromUpdateCandidate.status
          ? responseFromUpdateCandidate.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateCandidate.errors
          ? responseFromUpdateCandidate.errors
          : { message: "" };
        logger.error(`confirmEmail --- ${errors}`);
        return res.status(status).json({
          success: false,
          message: "Internal Server Error",
          errors,
        });
      }
    } catch (e) {
      logObject("error", e);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
      });
    }
  },
};

module.exports = candidate;
