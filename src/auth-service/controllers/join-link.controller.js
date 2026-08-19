const httpStatus = require("http-status");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const joinLinkUtil = require("@utils/join-link.util");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- join-link-controller`,
);

const respond = (res, result) => {
  if (isEmpty(result)) {
    return;
  }
  if (result.success === true) {
    const status = result.status ? result.status : httpStatus.OK;
    return res.status(status).json({
      success: true,
      message: result.message,
      data: result.data,
      ...(result.meta ? { meta: result.meta } : {}),
    });
  }
  const status = result.status ? result.status : httpStatus.INTERNAL_SERVER_ERROR;
  return res.status(status).json({
    success: false,
    message: result.message,
    error: result.error ? result.error : "",
    errors: result.errors ? result.errors : { message: "Internal Server Error" },
  });
};

const joinLinkController = {
  createJoinLink: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await joinLinkUtil.createJoinLink(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }
      return respond(res, result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  listJoinLinks: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await joinLinkUtil.listJoinLinks(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }
      return respond(res, result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  revokeJoinLink: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await joinLinkUtil.revokeJoinLink(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }
      return respond(res, result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },

  redeemJoinLink: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors));
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await joinLinkUtil.redeemJoinLink(request, next);
      if (isEmpty(result) || res.headersSent) {
        return;
      }
      return respond(res, result);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message },
        ),
      );
    }
  },
};

module.exports = joinLinkController;
