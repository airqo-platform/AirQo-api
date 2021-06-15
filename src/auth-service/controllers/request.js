const CandidateSchema = require("../models/Candidate");
const UserSchema = require("../models/User");
const HTTPStatus = require("http-status");
const msgs = require("../utils/email.msgs");
const register = require("../utils/register");
const { getModelByTenant } = require("../utils/multitenancy");
const constants = require("../config/constants");
const requestUtil = require("../utils/request");
const generateFilter = require("../utils/generate-filter");
const validations = require("../utils/validations");

const CandidateModel = (tenant) => {
  return getModelByTenant(tenant, "candidate", CandidateSchema);
};

const UserModel = (tenant) => {
  return getModelByTenant(tenant, "user", UserSchema);
};

const { tryCatchErrors, missingQueryParams } = require("utils/errors");
const { logObject } = require("utils/log");
const { logText, logElement } = require("../utils/log");
const isEmpty = require("is-empty");
const { request } = require("../app");

const candidate = {
  create: async (req, res) => {
    try {
      const { tenant } = req.query;
      const {
        firstName,
        lastName,
        email,
        organization,
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
      const mailOptions = {
        from: constants.EMAIL,
        to: `${req.body.email}`,
        subject: "AirQo Platform JOIN request",
        text: msgs.joinRequest,
      };

      let responseFromUserCreation = await requestUtil.create(
        tenant.toLowerCase(),
        firstName,
        lastName,
        email,
        organization,
        jobTitle,
        website,
        description,
        category,
        mailOptions
      );

      if (responseFromUserCreation.success == true) {
        return res.status(HTTPStatus.OK).json({
          success: true,
          message: responseFromUserCreation.message,
          candidate: responseFromUserCreation.data,
        });
      } else if (responseFromUserCreation.success == false) {
        if (responseFromUserCreation.error) {
          return res.status(HTTPStatus.BAD_GATEWAY).json({
            success: false,
            message: responseFromUserCreation.message,
            error: responseFromUserCreation.error,
          });
        } else {
          return res.status(HTTPStatus.BAD_REQUEST).json({
            success: false,
            message: responseFromUserCreation.message,
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

  list: async (req, res) => {
    try {
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
      const {
        firstName,
        lastName,
        email,
        organization,
        jobTitle,
        website,
        category,
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

      if (responseFromFilter.success == true) {
        let filter = responseFromFilter.data;
        logObject("the filter in controller", filter);
        let responseFromConfirmCandidate = await requestUtil.confirm(
          tenant,
          firstName,
          lastName,
          email,
          organization,
          jobTitle,
          website,
          category,
          filter
        );

        logObject("responseFromConfirmCandidate", responseFromConfirmCandidate);
        if (responseFromConfirmCandidate.success == true) {
          return res.status(HTTPStatus.OK).json({
            success: true,
            message: responseFromConfirmCandidate.message,
            user: responseFromConfirmCandidate.data,
          });
        } else if (responseFromConfirmCandidate.success == false) {
          if (responseFromConfirmCandidate.error) {
            res.status(HTTPStatus.BAD_GATEWAY).json({
              success: false,
              message: responseFromConfirmCandidate.message,
              error: responseFromConfirmCandidate.error,
            });
          } else {
            res.status(HTTPStatus.BAD_REQUEST).json({
              success: false,
              message: responseFromConfirmCandidate.message,
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
        message: "contoller server error",
        error: e.message,
      });
    }
  },
  delete: async (req, res) => {
    try {
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
