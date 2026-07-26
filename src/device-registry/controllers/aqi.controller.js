// aqi.controller.js
const httpStatus = require("http-status");
const { HttpError, extractErrorsFromRequest } = require("@utils/shared");
const aqiUtil = require("@utils/aqi.util");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- aqi-controller`);

const aqiController = {
  listRanges: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const result = aqiUtil.listRanges();

      res.status(httpStatus.OK).json({
        success: true,
        message: result.message,
        data: result.data,
      });
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

module.exports = aqiController;
