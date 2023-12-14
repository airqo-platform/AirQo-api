const httpStatus = require("http-status");
const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText, logElement, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-token-controller`
);

const createAccessToken = {
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

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request.query.tenant = tenant;
      const responseFromCreateAccessToken =
        await controlAccessUtil.createAccessToken(request);

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
            : { message: "" },
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
      logText("we are in baby");
      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      logElement("tenant", tenant);
      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromListAccessToken =
        await controlAccessUtil.listAccessToken(request);

      logObject("responseFromListAccessToken", responseFromListAccessToken);

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
            : { message: "" },
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

  verify: async (req, res) => {
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
      let request = req;
      request.query.tenant = tenant;
      const responseFromListAccessToken = await controlAccessUtil.verifyToken(
        request
      );
      const status = responseFromListAccessToken.status;
      return res.status(status).send(responseFromListAccessToken.message);
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

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request["query"]["tenant"] = tenant;
      const responseFromDeleteAccessToken =
        await controlAccessUtil.deleteAccessToken(request);

      if (responseFromDeleteAccessToken.success === true) {
        const status = responseFromDeleteAccessToken.status
          ? responseFromDeleteAccessToken.status
          : httpStatus.OK;
        return res.status(status).json({
          message: responseFromDeleteAccessToken.message
            ? responseFromDeleteAccessToken.message
            : "",
          deleted_token: responseFromDeleteAccessToken.data
            ? responseFromDeleteAccessToken.data
            : {},
        });
      } else if (responseFromDeleteAccessToken.success === false) {
        const status = responseFromDeleteAccessToken.status
          ? responseFromDeleteAccessToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromDeleteAccessToken.message
            ? responseFromDeleteAccessToken.message
            : "",
          errors: responseFromDeleteAccessToken.errors
            ? responseFromDeleteAccessToken.errors
            : { message: "" },
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

  regenerate: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request.query.tenant = tenant;
      const responseFromUpdateAccessToken =
        await controlAccessUtil.regenerateAccessToken(request);

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
            : { message: "" },
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
          extractErrorsFromRequest(req)
        );
      }

      let { tenant, id } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = req;
      request.query.tenant = tenant;
      const responseFromUpdateAccessToken =
        await controlAccessUtil.updateAccessToken(request);

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
            : { message: "" },
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

  /******************** IP ADDRESSES ********************** */

  blackListIp: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromBlackListIp = await controlAccessUtil.blackListIp(
        request
      );

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
            : { message: "" },
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
  blackListIps: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromBlackListIps = await controlAccessUtil.blackListIps(
        request
      );

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
            : { message: "" },
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
  removeBlacklistedIp: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromRemoveBlackListedIp =
        await controlAccessUtil.removeBlacklistedIp(request);

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
            : { message: "" },
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
  blackListIpRange: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromBlackListIpRange =
        await controlAccessUtil.blackListIpRange(request);

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
            : { message: "" },
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
  removeBlacklistedIpRange: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromRemoveBlackListedIpRange =
        await controlAccessUtil.removeBlacklistedIpRange(request);

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
            : { message: "" },
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
  listBlacklistedIpRange: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let request = req;
      if (isEmpty(req.query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListBlacklistedIPRanges =
        await controlAccessUtil.listBlacklistedIpRange(request);

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
            : { message: "" },
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
  whiteListIp: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(req.query.tenant)) {
        request.query.tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const responseFromWhiteListIp = await controlAccessUtil.whiteListIp(
        request
      );

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
            : { message: "" },
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
  removeWhitelistedIp: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let request = req;
      if (isEmpty(req.query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromRemoveWhiteListedIp =
        await controlAccessUtil.removeWhitelistedIp(request);

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
            : { message: "" },
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
  listUnknownIPs: async (req, res) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let request = req;
      if (isEmpty(req.query.tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT || "airqo";
      }

      const responseFromListUnknownIPs = await controlAccessUtil.listUnknownIPs(
        request
      );

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
            : { message: "" },
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

module.exports = createAccessToken;
