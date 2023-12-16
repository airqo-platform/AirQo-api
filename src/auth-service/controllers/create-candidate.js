const httpStatus = require("http-status");
const createCandidateUtil = require("@utils/create-candidate");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-candidate-controller`
);
const { logText, logObject } = require("@utils/log");

const createCandidate = {
  create: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          errors
        );
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const candidateResponse = await createCandidateUtil.create(request);

      if (candidateResponse.success === true) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: candidateResponse.message,
          candidate: candidateResponse.data,
        });
      } else if (candidateResponse.success === false) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = candidateResponse.errors
          ? candidateResponse.errors
          : { message: "Internal Server Error" };
        return res.status(status).json({
          success: false,
          message: candidateResponse.message,
          errors,
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
          errors
        );
      }
      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const candidateResponse = await createCandidateUtil.list(request);
      logObject("candidateResponse", candidateResponse);
      if (candidateResponse.success === true) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: candidateResponse.message,
          candidates: candidateResponse.data,
        });
      } else if (candidateResponse.success === false) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: candidateResponse.message,
          error: candidateResponse.error ? candidateResponse.error : "",
          errors: candidateResponse.errors
            ? candidateResponse.errors
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
  confirm: async (req, res) => {
    logText("inside the confirm candidate......");
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          errors
        );
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const candidateResponse = await createCandidateUtil.confirm(request);

      logObject("candidateResponse", candidateResponse);
      if (candidateResponse.success === true) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: candidateResponse.message,
          user: candidateResponse.data,
        });
      } else if (candidateResponse.success === false) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: candidateResponse.message,
          errors: candidateResponse.errors
            ? candidateResponse.errors
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
  delete: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          errors
        );
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const candidateResponse = await createCandidateUtil.delete(request);

      if (candidateResponse.success === true) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: candidateResponse.message,
          candidate: candidateResponse.data,
        });
      } else if (candidateResponse.success === false) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: candidateResponse.message,
          candidate: candidateResponse.data,
          errors: candidateResponse.errors
            ? candidateResponse.errors
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
  update: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          errors
        );
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const candidateResponse = await createCandidateUtil.update(request);

      logObject("candidateResponse", candidateResponse);
      if (candidateResponse.success === true) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: candidateResponse.message,
          candidate: candidateResponse.data,
        });
      } else if (candidateResponse.success === false) {
        const status = candidateResponse.status
          ? candidateResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: candidateResponse.message,
          candidate: candidateResponse.data,
          errors: candidateResponse.errors
            ? candidateResponse.errors
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
};

module.exports = createCandidate;
