const httpStatus = require("http-status");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const createFeedUtil = require("@utils/feed.util");
const { stringify } = require("@utils/common");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- feed-controller`);

const createFeed = {
  // ── GET /recent/:ch_id ────────────────────────────────────────────────────
  // ch_id is accepted as either:
  //   • all-digit string  → ThingSpeak channel (AirQo)
  //   • alphanumeric      → serial_number (external devices)
  // getDeviceFeed() in feed.util.js handles the resolution.
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

      // Pass ch_id as-is — getDeviceFeed()/resolveDevice() handles type
      // detection internally (numeric string → device_number, else serial_number).
      // Coercing to an integer here would strip leading zeros and misclassify
      // digit-only serial numbers.
      try {
        const { status, data } = await createFeedUtil.getDeviceFeed(
          { identifier: ch_id, start, end, transform: false },
          next
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

  // ── GET /transform/recent ─────────────────────────────────────────────────
  // Accepts:
  //   • ?channel=<number>         → AirQo device (ThingSpeak)
  //   • ?serial_number=<string>   → external device (manufacturer API)
  generateDescriptiveLastEntry: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
        return;
      }

      const { channel, serial_number, start, end } = req.query;

      // Resolve identifier: numeric channel takes precedence when both are
      // somehow present (shouldn't happen given oneOf validation, but be safe).
      const identifier = channel ? parseInt(channel, 10) : serial_number;

      try {
        const { status, data } = await createFeedUtil.getDeviceFeed(
          { identifier, start, end, transform: true },
          next
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
