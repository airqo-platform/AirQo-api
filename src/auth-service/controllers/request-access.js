const httpStatus = require("http-status");
const requestAccessUtil = require("@utils/request-access");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- request-access-controller`
);
const { logText, logObject, logElement } = require("@utils/log");

const requestAccess = {
  create: async (req, res) => {
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
      const {
        firstName,
        lastName,
        email,
        long_organization,
        jobTitle,
        website,
        description,
        category,
        country,
      } = req.body;

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
      request["country"] = country;

      await requestAccessUtil
        .create(request, (value) => {
          if (value.success === true) {
            const status = value.status ? value.status : httpStatus.OK;
            return res.status(status).json({
              success: true,
              message: value.message,
              candidate: value.data,
            });
          } else if (value.success === false) {
            const status = value.status
              ? value.status
              : httpStatus.INTERNAL_SERVER_ERROR;
            const errors = value.errors ? value.errors : "";
            return res.status(status).json({
              success: false,
              message: value.message,
              errors,
            });
          }
        })
        .catch((error) => {
          logger.error(`Internal Server Error ${error}`);
          res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Internal Server Error",
            errors: { message: error },
          });
        });
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
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
      let responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);
      if (responseFromFilter.success === true) {
        let filter = responseFromFilter.data;
        const responseFromListCandidate = await requestAccessUtil.list({
          tenant,
          filter,
          limit,
          skip,
        });
        logObject("responseFromListCandidate", responseFromListCandidate);
        if (responseFromListCandidate.success === true) {
          return res.status(httpStatus.OK).json({
            success: true,
            message: responseFromListCandidate.message,
            candidates: responseFromListCandidate.data,
          });
        } else if (responseFromListCandidate.success === false) {
          if (responseFromListCandidate.error) {
            return res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromListCandidate.message,
              error: responseFromListCandidate.error,
            });
          } else {
            return res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromListCandidate.message,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: e.message,
      });
    }
  },
  confirm: async (req, res) => {
    logText("inside the confirm candidate......");
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
      const {
        firstName,
        lastName,
        email,
        long_organization,
        jobTitle,
        website,
        category,
        description,
        country,
      } = req.body;

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
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
        request["country"] = country;
        request["filter"] = filter;

        let responseFromConfirmCandidate = await requestAccessUtil.confirm(
          request
        );

        logObject("responseFromConfirmCandidate", responseFromConfirmCandidate);
        if (responseFromConfirmCandidate.success === true) {
          let status = responseFromConfirmCandidate.status
            ? responseFromConfirmCandidate.status
            : httpStatus.OK;
          return res.status(status).json({
            success: true,
            message: responseFromConfirmCandidate.message,
            user: responseFromConfirmCandidate.data,
          });
        } else if (responseFromConfirmCandidate.success === false) {
          let status = responseFromConfirmCandidate.status
            ? responseFromConfirmCandidate.status
            : httpStatus.INTERNAL_SERVER_ERROR;

          if (responseFromConfirmCandidate.error) {
            res.status(status).json({
              success: false,
              message: responseFromConfirmCandidate.message,
              error: responseFromConfirmCandidate.error
                ? responseFromConfirmCandidate.error
                : "",
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "contoller server error",
        error: e.message,
        errors: { message: e.message },
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
      const responseFromFilter = generateFilter.candidates(req);

      if (responseFromFilter.success == true) {
        let responseFromDeleteCandidate = await requestAccessUtil.delete(
          tenant,
          responseFromFilter.data
        );

        if (responseFromDeleteCandidate.success == true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromDeleteCandidate.message,
            candidate: responseFromDeleteCandidate.data,
          });
        } else if (responseFromDeleteCandidate.success == false) {
          if (responseFromDeleteCandidate.error) {
            res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromDeleteCandidate.message,
              candidate: responseFromDeleteCandidate.data,
              error: responseFromDeleteCandidate.error,
            });
          } else {
            res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromDeleteCandidate.message,
              candidate: responseFromDeleteCandidate.data,
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
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
        errors: { message: error.message },
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
      const responseFromFilter = generateFilter.candidates(req);
      logObject("responseFromFilter", responseFromFilter);

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        let requestBody = req.body;
        delete requestBody._id;
        let responseFromUpdateCandidate = await requestAccessUtil.update(
          tenant,
          filter,
          requestBody
        );
        logObject("responseFromUpdateCandidate", responseFromUpdateCandidate);
        if (responseFromUpdateCandidate.success == true) {
          res.status(httpStatus.OK).json({
            success: true,
            message: responseFromUpdateCandidate.message,
            candidate: responseFromUpdateCandidate.data,
          });
        } else if (responseFromUpdateCandidate.success == false) {
          if (responseFromUpdateCandidate.error) {
            res.status(httpStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromUpdateCandidate.message,
              candidate: responseFromUpdateCandidate.data,
              error: responseFromUpdateCandidate.error,
            });
          } else {
            res.status(httpStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromUpdateCandidate.message,
              candidate: responseFromUpdateCandidate.data,
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
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.BAD_GATEWAY).json({
        success: false,
        message: "controller server error",
        error: error.message,
      });
    }
  },
};

module.exports = requestAccess;
