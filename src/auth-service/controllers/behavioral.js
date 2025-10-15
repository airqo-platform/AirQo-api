const httpStatus = require("http-status");
const alertResponseUtil = require("@utils/alert-response");
const { extractErrorsFromRequest, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- behavioral-controller`
);

const behavioral = {
  submitAlertResponse: async (req, res, next) => {
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
      request.query.tenant = request.query.tenant || defaultTenant;

      const result = await alertResponseUtil.create(request, next);

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.CREATED;
        return res.status(status).json({
          success: true,
          message: result.message,
          responseId: result.data._id,
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
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
    }
  },

  getUserAlertResponses: async (req, res, next) => {
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
      request.query.tenant = request.query.tenant || defaultTenant;

      const result = await alertResponseUtil.list(request, next);

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        const { data, total } = result.data;
        return res.status(status).json({
          success: true,
          message: result.message,
          responses: data,
          pagination: {
            total,
            limit: parseInt(req.query.limit, 10) || 50,
            offset: parseInt(req.query.offset, 10) || 0,
            hasMore:
              (parseInt(req.query.offset, 10) || 0) + data.length < total,
          },
        });
      } else if (result.success === false) {
        const status = result.status
          ? result.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: result.message,
          errors: result.errors
            ? result.errors
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
    }
  },

  getAlertResponseStats: async (req, res, next) => {
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
      request.query.tenant = request.query.tenant || defaultTenant;

      const result = await alertResponseUtil.getStats(request, next);

      if (result.success === true) {
        const status = result.status ? result.status : httpStatus.OK;
        return res.status(status).json({
          success: true,
          stats: result.data,
        });
      }
      // Handle error case
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getAggregatedBehavioralData: async (req, res, next) => {
    // Placeholder for researcher-specific data aggregation
    return res.status(httpStatus.NOT_IMPLEMENTED).json({
      success: false,
      message: "Endpoint not yet implemented",
    });
  },
};

module.exports = behavioral;
