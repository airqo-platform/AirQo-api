const HTTPStatus = require("http-status");
const msgs = require("../utils/email.msgs");
const register = require("../utils/register");
const { getModelByTenant } = require("../utils/multitenancy");
const constants = require("../config/constants");
const requestUtil = require("../utils/request");
const generateFilter = require("../utils/generate-filter");
const validations = require("../utils/validations");

const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");
const { badRequest } = require("../utils/errors");

const { tryCatchErrors, missingQueryParams } = require("utils/errors");
const { logObject } = require("utils/log");
const { logText, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const { request } = require("../app");

const candidate = {
  create: async (req, res) => {
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

      const { errors, isValid } = validations.candidate(req.body);
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
      request["long_organization"] = long_organization;
      request["jobTitle"] = jobTitle;
      request["website"] = website;
      request["description"] = description;
      request["category"] = category;

      await requestUtil.create(request, (value) => {
        if (value.success === true) {
          return res.status(value.status).json({
            success: true,
            message: value.message,
            candidate: value.data,
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
      });
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
      let responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        const responseFromListCandidate = await requestUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        logObject("responseFromListCandidate", responseFromListCandidate);
        if (responseFromListCandidate.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromListCandidate.message,
            candidates: responseFromListCandidate.data,
          });
        } else if (responseFromListCandidate.success == false) {
          if (responseFromListCandidate.error) {
            return res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListCandidate.message,
              error: responseFromListCandidate.error,
            });
          } else {
            return res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromListCandidate.message,
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
  confirm: async (req, res) => {
    console.log("inside the confirm candidate");
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

          let error = responseFromConfirmCandidate.error
            ? responseFromConfirmCandidate.error
            : "";
          if (responseFromConfirmCandidate.error) {
            res.status(status).json({
              success: false,
              message: responseFromConfirmCandidate.message,
              error,
            });
          }
        }
      } else if (responseFromFilter.success === false) {
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
        message: "contoller server error",
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
      const responseFromFilter = generateFilter.candidates(req);

      if (responseFromFilter.success == true) {
        let responseFromDeleteCandidate = await requestUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteCandidate.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromDeleteCandidate.message,
            candidate: responseFromDeleteCandidate.data,
          });
        } else if (responseFromDeleteCandidate.success == false) {
          if (responseFromDeleteCandidate.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromDeleteCandidate.message,
              candidate: responseFromDeleteCandidate.data,
              error: responseFromDeleteCandidate.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromDeleteCandidate.message,
              candidate: responseFromDeleteCandidate.data,
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
      const responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateCandidate = await requestUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateCandidate", responseFromUpdateCandidate);
        if (responseFromUpdateCandidate.success == true) {
          res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromUpdateCandidate.message,
            candidate: responseFromUpdateCandidate.data,
          });
        } else if (responseFromUpdateCandidate.success == false) {
          if (responseFromUpdateCandidate.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateCandidate.message,
              candidate: responseFromUpdateCandidate.data,
              error: responseFromUpdateCandidate.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromUpdateCandidate.message,
              candidate: responseFromUpdateCandidate.data,
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

module.exports = candidate;
