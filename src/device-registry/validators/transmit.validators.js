// validators/transmit.validators.js
const { oneOf, query, body, param } = require("express-validator");
const { ObjectId } = require("mongoose").Types;
const { isValidObjectId } = require("mongoose");
const constants = require("@config/constants");

const commonValidations = {
  tenant: [
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty if provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.TENANTS)
      .withMessage("the tenant value is not among the expected ones"),
  ],

  deviceIdentifier: [
    oneOf([
      query("id")
        .exists()
        .withMessage(
          "the device identifier is missing in request, consider using id",
        ),
      query("name")
        .exists()
        .withMessage(
          "the device identifier is missing in request, consider using name",
        ),
      query("device_number")
        .exists()
        .withMessage(
          "the device_number identifier is missing in request, consider using device_number",
        ),
    ]),
  ],
};

const transmitValidations = {
  transformEvents: [
    body()
      .isArray()
      .withMessage("The request body should be an array"),
    body("*.device_id")
      .exists()
      .trim()
      .withMessage("device_id is missing")
      .bail()
      .isMongoId()
      .withMessage("device_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.is_device_primary")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_device_primary should be Boolean"),
    body("*.site_id")
      .exists()
      .trim()
      .withMessage("site_id is missing")
      .bail()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    body("*.time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("*.frequency")
      .exists()
      .trim()
      .toLowerCase()
      .withMessage("frequency is missing")
      .bail()
      .isIn(["raw", "hourly", "daily"])
      .withMessage(
        "the frequency value is not among the expected ones which include: raw, hourly and daily",
      ),
    body("*.is_test_data")
      .optional()
      .notEmpty()
      .trim()
      .isBoolean()
      .withMessage("is_test_data should be boolean"),
    body("*.device")
      .optional()
      .notEmpty()
      .trim(),
    body("*.site")
      .optional()
      .notEmpty()
      .trim(),
    body("*.device_number")
      .optional()
      .notEmpty()
      .isInt()
      .withMessage("the device_number should be an integer value")
      .bail()
      .trim(),
  ],
  transmitSingleEvent: [
    commonValidations.tenant,
    commonValidations.deviceIdentifier,
    body("time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("s1_pm10").trim(),
    body("s1_pm2_5").trim(),
    body("s2_pm2_5").trim(),
    body("s2_pm10").trim(),
    body("latitude").trim(),
    body("longitude").trim(),
    body("battery").trim(),
    body("altitude").trim(),
    body("wind_speed").trim(),
    body("satellites").trim(),
    body("hdop").trim(),
    body("internal_temperature").trim(),
    body("internal_humidity").trim(),
    body("external_temperature").trim(),
    body("external_humidity").trim(),
    body("external_pressure").trim(),
    body("external_altitude").trim(),
    body("status")
      .optional()
      .notEmpty()
      .withMessage("status cannot be empty if provided"),
  ],
  transmitBulkEvents: [
    body()
      .isArray()
      .withMessage("The request body should be an array"),
    commonValidations.tenant,
    commonValidations.deviceIdentifier,
    body("*.time")
      .exists()
      .trim()
      .withMessage("time is missing")
      .bail()
      .toDate()
      .isISO8601({ strict: true, strictSeparator: true })
      .withMessage("time must be a valid datetime."),
    body("*.s1_pm10").trim(),
    body("*.s1_pm2_5").trim(),
    body("*.s2_pm2_5").trim(),
    body("*.s2_pm10")
      .optional()
      .trim(),
    body("*.latitude").trim(),
    body("*.longitude").trim(),
    body("*.battery").trim(),
    body("*.altitude").trim(),
    body("*.wind_speed").trim(),
    body("*.satellites").trim(),
    body("*.hdop").trim(),
    body("*.internal_temperature").trim(),
    body("*.internal_humidity").trim(),
    body("*.external_temperature").trim(),
    body("*.external_humidity").trim(),
    body("*.external_pressure").trim(),
    body("*.external_altitude").trim(),
    body("*.status"),
  ],
};

module.exports = transmitValidations;
