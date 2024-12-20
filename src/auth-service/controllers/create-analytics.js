const createAnalyticsUtil = require("@utils/create-analytics");
const constants = require("@config/constants");
const { isEmpty } = require("lodash");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-analytics-controller`
);

const analytics = {
  send: async (req, res, next) => {
    try {
      // Extract emails from request body or query
      const emails = req.body.emails || req.query.emails;

      // Validate emails
      if (!emails || !Array.isArray(emails) || emails.length === 0) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "Emails must be provided as an array",
          })
        );
      }

      const request = Object.assign({}, req);
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      // Call utility function to send year-end emails
      const result = await createAnalyticsUtil.sendYearEndEmails(request);

      // Prepare and send response
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
      // Log and handle any unexpected errors
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
