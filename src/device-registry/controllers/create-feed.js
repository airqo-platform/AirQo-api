const httpStatus = require("http-status");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const log4js = require("log4js");
const constants = require("@config/constants");
const createFeedUtil = require("@utils/create-feed");
const stringify = require("@utils/stringify");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-feed-controller`
);

const createFeed = {
  getLastFeed: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { start, end, ch_id } = { ...req.query, ...req.params };
      const channel = ch_id;

      try {
        const api_key = await createFeedUtil.getAPIKey(channel);
        const request = { channel, api_key, start, end };
        const thingspeakData = await createFeedUtil.fetchThingspeakData(
          request
        );
        const { status, data } = createFeedUtil.handleThingspeakResponse(
          thingspeakData
        );
        return res.status(status).json(data);
      } catch (error) {
        logger.error(`🐛🐛 Error in getLastFeed: ${error.message}`);
        const message = error.response
          ? error.response.data
          : "Internal Server Error";
        const statusCode = error.response
          ? error.response.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, { message: error.message }));
        return;
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

  generateDescriptiveLastEntry: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { channel, start, end } = req.query;

      try {
        const api_key = await createFeedUtil.getAPIKey(channel);
        const request = { channel, api_key, start, end };
        const thingspeakData = await createFeedUtil.fetchThingspeakData(
          request
        );

        const { status, data } = await createFeedUtil.processDeviceMeasurements(
          thingspeakData.feeds[0],
          thingspeakData.channel
        );
        return res.status(status).json(data);
      } catch (error) {
        logger.error(
          `🐛🐛 an error in generateDescriptiveLastEntry: ${stringify(error)}`
        );
        const message = error.response
          ? error.response.data
          : "Internal Server Error";
        const statusCode = error.response
          ? error.response.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        logger.error(`🐛🐛 Internal Server Error ${error.message}`);
        next(new HttpError(message, statusCode, error));
        return;
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

module.exports = createFeed;
