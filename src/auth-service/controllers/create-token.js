const httpStatus = require("http-status");
const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logObject, logText } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-token-controller`
);

function handleResponse({
  result,
  key = "data",
  errorKey = "errors",
  res,
} = {}) {
  if (!result) {
    return;
  }

  const isSuccess = result.success;
  const defaultStatus = isSuccess
    ? httpStatus.OK
    : httpStatus.INTERNAL_SERVER_ERROR;

  const defaultMessage = isSuccess
    ? "Operation Successful"
    : "Internal Server Error";

  const status = result.status ?? defaultStatus;
  const message = result.message ?? defaultMessage;
  const data = result.data ?? [];
  const errors = isSuccess
    ? undefined
    : result.errors ?? { message: "Internal Server Error" };

  return res.status(status).json({ message, [key]: data, [errorKey]: errors });
}

const createAccessToken = {
  create: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromCreateAccessToken =
        await controlAccessUtil.createAccessToken(request, next);

      if (isEmpty(responseFromCreateAccessToken)) {
        return;
      }

      if (responseFromCreateAccessToken.success === true) {
        const status = responseFromCreateAccessToken.status
          ? responseFromCreateAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromCreateAccessToken.message
            ? responseFromCreateAccessToken.message
            : "",
          created_token: responseFromCreateAccessToken.data
            ? responseFromCreateAccessToken.data
            : [],
        });
      } else if (responseFromCreateAccessToken.success === false) {
        const status = responseFromCreateAccessToken.status
          ? responseFromCreateAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromCreateAccessToken.message
            ? responseFromCreateAccessToken.message
            : "",
          errors: responseFromCreateAccessToken.errors
            ? responseFromCreateAccessToken.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListAccessToken =
        await controlAccessUtil.listAccessToken(request, next);

      if (isEmpty(responseFromListAccessToken)) {
        return;
      }

      if (responseFromListAccessToken.success === true) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromListAccessToken.message
            ? responseFromListAccessToken.message
            : "",
          tokens: responseFromListAccessToken.data
            ? responseFromListAccessToken.data
            : [],
        });
      } else if (responseFromListAccessToken.success === false) {
        const status = responseFromListAccessToken.status
          ? responseFromListAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListAccessToken.message,
          errors: responseFromListAccessToken.errors
            ? responseFromListAccessToken.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  verify: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListAccessToken = await controlAccessUtil.verifyToken(
        request,
        next
      );
      const status = responseFromListAccessToken.status;
      return res.status(status).send(responseFromListAccessToken.message);
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeleteAccessToken =
        await controlAccessUtil.deleteAccessToken(request, next);

      if (isEmpty(responseFromDeleteAccessToken)) {
        return;
      } else {
        handleResponse({
          result: responseFromDeleteAccessToken,
          key: "deleted_token",
          res,
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  regenerate: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateAccessToken =
        await controlAccessUtil.regenerateAccessToken(request, next);

      if (isEmpty(responseFromUpdateAccessToken)) {
        return;
      }

      if (responseFromUpdateAccessToken.success === true) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          updated_token: responseFromUpdateAccessToken.data
            ? responseFromUpdateAccessToken.data
            : [],
        });
      } else if (responseFromUpdateAccessToken.success === false) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          errors: responseFromUpdateAccessToken.errors
            ? responseFromUpdateAccessToken.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateAccessToken =
        await controlAccessUtil.updateAccessToken(request, next);

      if (isEmpty(responseFromUpdateAccessToken)) {
        return;
      }

      if (responseFromUpdateAccessToken.success === true) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          updated_token: responseFromUpdateAccessToken.data
            ? responseFromUpdateAccessToken.data
            : [],
        });
      } else if (responseFromUpdateAccessToken.success === false) {
        const status = responseFromUpdateAccessToken.status
          ? responseFromUpdateAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromUpdateAccessToken.message
            ? responseFromUpdateAccessToken.message
            : "",
          errors: responseFromUpdateAccessToken.errors
            ? responseFromUpdateAccessToken.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  /******************** IP ADDRESSES ********************** */

  blackListIp: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromBlackListIp = await controlAccessUtil.blackListIp(
        request,
        next
      );

      if (isEmpty(responseFromBlackListIp)) {
        return;
      }

      if (responseFromBlackListIp.success === true) {
        const status = responseFromBlackListIp.status
          ? responseFromBlackListIp.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromBlackListIp.message
            ? responseFromBlackListIp.message
            : "",
          blacklisted_ip: responseFromBlackListIp.data
            ? responseFromBlackListIp.data
            : [],
        });
      } else if (responseFromBlackListIp.success === false) {
        const status = responseFromBlackListIp.status
          ? responseFromBlackListIp.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromBlackListIp.message
            ? responseFromBlackListIp.message
            : "",
          errors: responseFromBlackListIp.errors
            ? responseFromBlackListIp.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  blackListIps: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromBlackListIps = await controlAccessUtil.blackListIps(
        request,
        next
      );

      if (isEmpty(responseFromBlackListIps)) {
        return;
      }

      if (responseFromBlackListIps.success === true) {
        const status = responseFromBlackListIps.status
          ? responseFromBlackListIps.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromBlackListIps.message
            ? responseFromBlackListIps.message
            : "",
          blacklisted_ips: responseFromBlackListIps.data
            ? responseFromBlackListIps.data
            : [],
        });
      } else if (responseFromBlackListIps.success === false) {
        const status = responseFromBlackListIps.status
          ? responseFromBlackListIps.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromBlackListIps.message
            ? responseFromBlackListIps.message
            : "",
          errors: responseFromBlackListIps.errors
            ? responseFromBlackListIps.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  removeBlacklistedIp: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveBlackListedIp =
        await controlAccessUtil.removeBlacklistedIp(request, next);

      if (isEmpty(responseFromRemoveBlackListedIp)) {
        return;
      }

      if (responseFromRemoveBlackListedIp.success === true) {
        const status = responseFromRemoveBlackListedIp.status
          ? responseFromRemoveBlackListedIp.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromRemoveBlackListedIp.message
            ? responseFromRemoveBlackListedIp.message
            : "",
          removed_ip: responseFromRemoveBlackListedIp.data
            ? responseFromRemoveBlackListedIp.data
            : {},
        });
      } else if (responseFromRemoveBlackListedIp.success === false) {
        const status = responseFromRemoveBlackListedIp.status
          ? responseFromRemoveBlackListedIp.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromRemoveBlackListedIp.message
            ? responseFromRemoveBlackListedIp.message
            : "",
          errors: responseFromRemoveBlackListedIp.errors
            ? responseFromRemoveBlackListedIp.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  blackListIpRange: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromBlackListIpRange =
        await controlAccessUtil.blackListIpRange(request, next);

      if (isEmpty(responseFromBlackListIpRange)) {
        return;
      }

      if (responseFromBlackListIpRange.success === true) {
        const status = responseFromBlackListIpRange.status
          ? responseFromBlackListIpRange.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromBlackListIpRange.message
            ? responseFromBlackListIpRange.message
            : "",
          blacklisted_ip_range: responseFromBlackListIpRange.data
            ? responseFromBlackListIpRange.data
            : [],
        });
      } else if (responseFromBlackListIpRange.success === false) {
        const status = responseFromBlackListIpRange.status
          ? responseFromBlackListIpRange.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromBlackListIpRange.message
            ? responseFromBlackListIpRange.message
            : "",
          errors: responseFromBlackListIpRange.errors
            ? responseFromBlackListIpRange.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  removeBlacklistedIpRange: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveBlackListedIpRange =
        await controlAccessUtil.removeBlacklistedIpRange(request, next);

      if (isEmpty(responseFromRemoveBlackListedIpRange)) {
        return;
      }

      if (responseFromRemoveBlackListedIpRange.success === true) {
        const status = responseFromRemoveBlackListedIpRange.status
          ? responseFromRemoveBlackListedIpRange.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromRemoveBlackListedIpRange.message
            ? responseFromRemoveBlackListedIpRange.message
            : "",
          removed_ip_range: responseFromRemoveBlackListedIpRange.data
            ? responseFromRemoveBlackListedIpRange.data
            : {},
        });
      } else if (responseFromRemoveBlackListedIpRange.success === false) {
        const status = responseFromRemoveBlackListedIpRange.status
          ? responseFromRemoveBlackListedIpRange.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromRemoveBlackListedIpRange.message
            ? responseFromRemoveBlackListedIpRange.message
            : "",
          errors: responseFromRemoveBlackListedIpRange.errors
            ? responseFromRemoveBlackListedIpRange.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listBlacklistedIpRange: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListBlacklistedIPRanges =
        await controlAccessUtil.listBlacklistedIpRange(request, next);

      if (isEmpty(responseFromListBlacklistedIPRanges)) {
        return;
      }

      if (responseFromListBlacklistedIPRanges.success === true) {
        const status = responseFromListBlacklistedIPRanges.status
          ? responseFromListBlacklistedIPRanges.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromListBlacklistedIPRanges.message
            ? responseFromListBlacklistedIPRanges.message
            : "",
          blacklisted_ip_ranges: responseFromListBlacklistedIPRanges.data
            ? responseFromListBlacklistedIPRanges.data
            : {},
        });
      } else if (responseFromListBlacklistedIPRanges.success === false) {
        const status = responseFromListBlacklistedIPRanges.status
          ? responseFromListBlacklistedIPRanges.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListBlacklistedIPRanges.message
            ? responseFromListBlacklistedIPRanges.message
            : "",
          errors: responseFromListBlacklistedIPRanges.errors
            ? responseFromListBlacklistedIPRanges.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  whiteListIp: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromWhiteListIp = await controlAccessUtil.whiteListIp(
        request,
        next
      );

      if (isEmpty(responseFromWhiteListIp)) {
        return;
      }

      if (responseFromWhiteListIp.success === true) {
        const status = responseFromWhiteListIp.status
          ? responseFromWhiteListIp.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromWhiteListIp.message
            ? responseFromWhiteListIp.message
            : "",
          whitelisted_ip: responseFromWhiteListIp.data
            ? responseFromWhiteListIp.data
            : [],
        });
      } else if (responseFromWhiteListIp.success === false) {
        const status = responseFromWhiteListIp.status
          ? responseFromWhiteListIp.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromWhiteListIp.message
            ? responseFromWhiteListIp.message
            : "",
          errors: responseFromWhiteListIp.errors
            ? responseFromWhiteListIp.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  removeWhitelistedIp: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRemoveWhiteListedIp =
        await controlAccessUtil.removeWhitelistedIp(request, next);

      if (isEmpty(responseFromRemoveWhiteListedIp)) {
        return;
      }

      if (responseFromRemoveWhiteListedIp.success === true) {
        const status = responseFromRemoveWhiteListedIp.status
          ? responseFromRemoveWhiteListedIp.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromRemoveWhiteListedIp.message
            ? responseFromRemoveWhiteListedIp.message
            : "",
          removed_ip: responseFromRemoveWhiteListedIp.data
            ? responseFromRemoveWhiteListedIp.data
            : {},
        });
      } else if (responseFromRemoveWhiteListedIp.success === false) {
        const status = responseFromRemoveWhiteListedIp.status
          ? responseFromRemoveWhiteListedIp.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromRemoveWhiteListedIp.message
            ? responseFromRemoveWhiteListedIp.message
            : "",
          errors: responseFromRemoveWhiteListedIp.errors
            ? responseFromRemoveWhiteListedIp.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  listUnknownIPs: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListUnknownIPs = await controlAccessUtil.listUnknownIPs(
        request,
        next
      );

      if (isEmpty(responseFromListUnknownIPs)) {
        return;
      }

      if (responseFromListUnknownIPs.success === true) {
        const status = responseFromListUnknownIPs.status
          ? responseFromListUnknownIPs.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromListUnknownIPs.message
            ? responseFromListUnknownIPs.message
            : "",
          unknown_ips: responseFromListUnknownIPs.data
            ? responseFromListUnknownIPs.data
            : {},
        });
      } else if (responseFromListUnknownIPs.success === false) {
        const status = responseFromListUnknownIPs.status
          ? responseFromListUnknownIPs.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListUnknownIPs.message
            ? responseFromListUnknownIPs.message
            : "",
          errors: responseFromListUnknownIPs.errors
            ? responseFromListUnknownIPs.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
};

module.exports = createAccessToken;
