// feeds.validators.js
const { oneOf, query, param, validationResult } = require("express-validator");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

// Reusable inline error collector
const collectErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(
      new HttpError("Validation error", httpStatus.BAD_REQUEST, errors.mapped())
    );
  }
  next();
};

const commonValidations = {
  timeRange: [
    query("start")
      .optional()
      .notEmpty()
      .withMessage("start date cannot be empty if provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("start date must be a valid datetime.")
      .toDate(),
    query("end")
      .optional()
      .notEmpty()
      .withMessage("end date cannot be empty if provided")
      .bail()
      .trim()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("end date must be a valid datetime.")
      .toDate(),
  ],

  // Numeric ThingSpeak channel ID — used by AirQo devices
  channel: [
    query("channel")
      .exists()
      .withMessage(
        "the channel query parameter must always be available in the request"
      )
      .notEmpty()
      .withMessage("the channel query parameter cannot be empty in the request")
      .bail()
      .isNumeric()
      .withMessage("the channel must be a number")
      .trim(),
  ],

  // String serial_number — used by external (non-AirQo) devices
  serialNumber: [
    query("serial_number")
      .exists()
      .withMessage(
        "the serial_number query parameter must always be available in the request"
      )
      .notEmpty()
      .withMessage("the serial_number query parameter cannot be empty")
      .bail()
      .trim()
      .isString()
      .withMessage("serial_number must be a string"),
  ],
};

const feedsValidations = {
  // ── GET /recent/:ch_id ──────────────────────────────────────────────────────
  // Accepts any non-empty string as ch_id:
  //   • all-digits → treated as a ThingSpeak channel ID (AirQo)
  //   • alphanumeric → treated as a serial_number (external devices)
  // The controller resolves the correct lookup from the value.
  getLastFeed: [
    param("ch_id")
      .exists()
      .withMessage("the channel ID is missing in the request params")
      .bail()
      .notEmpty()
      .withMessage("the channel ID cannot be empty")
      .bail()
      .trim(),
    collectErrors,
  ],

  // ── GET /transform/recent ───────────────────────────────────────────────────
  // Accepts EITHER a numeric `channel` (AirQo) OR a string `serial_number`
  // (external devices) — at least one must be present.
  generateDescriptiveLastEntry: [
    oneOf(
      [
        // Option A: numeric channel (AirQo / ThingSpeak)
        commonValidations.channel,
        // Option B: string serial_number (external networks)
        commonValidations.serialNumber,
      ],
      {
        message:
          "Provide either a numeric 'channel' (AirQo devices) or a " +
          "string 'serial_number' (external devices) as a query parameter",
      }
    ),
    ...commonValidations.timeRange,
    collectErrors,
  ],
};

module.exports = feedsValidations;
