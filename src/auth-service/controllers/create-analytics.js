const createAnalyticsUtil = require("@utils/create-analytics");
const constants = require("@config/constants");
const { isEmpty } = require("lodash");
const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-analytics-controller`
);
const { logText, logObject } = require("@utils/log");

const analytics = {
  send: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const result = await createAnalyticsUtil.sendYearEndEmails(request);

      if (result.success) {
        res.status(httpStatus.OK).json({
          success: true,
          message: result.message,
        });
      } else {
        res.status(httpStatus.NO_CONTENT).json({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Year-End Email Controller Error: ${error.message}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = analytics;
