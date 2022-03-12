const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/create-site");
const locationController = require("../controllers/create-location");
const airqloudController = require("../controllers/create-airqloud");
const middlewareConfig = require("../config/router.middleware");
const eventController = require("../controllers/create-event");
const photoController = require("../controllers/create-photo");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const createSiteUtil = require("../utils/create-site");
const createAirQloudUtil = require("../utils/create-location");
const { logElement, logText } = require("../utils/log");
const { isBoolean, isEmpty } = require("underscore");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const decimalPlaces = require("decimal-places");

middlewareConfig(router);

/******************* create device use-case ***************************/
/*** decrypt read and write keys */
router.post(
  "/decrypt",
  oneOf([
    body("encrypted_key")
      .exists()
      .withMessage("encrypted_key parameter should be provided")
      .trim(),
  ]),
  deviceController.decryptKey
);

router.put(
  "/encrypt",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  oneOf([
    [
      body("visibility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .optional()
        .notEmpty()
        .trim(),
      body("mountType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .optional()
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phoneNumber must be a valid one")
        .bail(),
      body("height")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 10 })
        .withMessage("height must be a number between 0 and 10")
        .bail()
        .toFloat(),
      body("elevation")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .optional()
        .notEmpty()
        .withMessage("writeKey should not be empty")
        .trim(),
      body("readKey")
        .optional()
        .notEmpty()
        .withMessage("readKey should not be empty")
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("product_name")
        .optional()
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.encryptKeys
);
/** get number of devices */
router.get(
  "/count",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  deviceController.getDevicesCount
);
/***list devices */
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      query("device_number")
        .optional()
        .notEmpty()
        .trim()
        .isInt()
        .withMessage("device_number must be an integer")
        .bail()
        .toInt(),
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.list
);
/**** create device */
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      body("device_number")
        .optional()
        .notEmpty()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("long_name")
        .exists()
        .withMessage("the device long_name should be provided")
        .trim(),
      body("generation_version")
        .exists()
        .withMessage("the generation_version number should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation_version should be an integer ")
        .toInt(),
      body("generation_count")
        .exists()
        .withMessage("the generation_count should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation should be an integer")
        .toInt(),
      body("mountType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("product_name")
        .optional()
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .optional()
        .notEmpty()
        .trim(),
      body("isActive")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .optional()
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phoneNumber must be a valid one")
        .bail(),
      body("height")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .optional()
        .notEmpty()
        .trim(),
      body("readKey")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.create
);
/***** delete device */
router.delete(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id "
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name "
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  deviceController.delete
);

/*** update device */
router.put(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  oneOf([
    [
      body("visibility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .optional()
        .notEmpty()
        .trim(),
      body("mountType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("status")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn([
          "recalled",
          "ready",
          "deployed",
          "undeployed",
          "decommissioned",
          "assembly",
          "testing",
        ])
        .withMessage(
          "the status value is not among the expected ones which include: recalled, ready, deployed, undeployed, decommissioned, assembly, testing "
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .optional()
        .notEmpty()
        .withMessage("nextMaintenance date cannot be empty")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance date must be a valid datetime."),
      body("isPrimaryInLocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phoneNumber must be a valid one")
        .bail(),
      body("height")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .optional()
        .notEmpty()
        .trim(),
      body("readKey")
        .optional()
        .notEmpty()
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .trim(),
      body("product_name")
        .optional()
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.update
);
/** return nearest coordinates */
router.get(
  "/by/nearest-coordinates",
  deviceController.listAllByNearestCoordinates
);
/*soft create device*/
router.post(
  "/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      body("visibility")
        .exists()
        .withMessage("visibility should be provided")
        .bail()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("device_number")
        .optional()
        .notEmpty()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("long_name")
        .exists()
        .withMessage("the device long_name should be provided")
        .trim(),
      body("generation_version")
        .exists()
        .withMessage("the generation_version number should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation_version should be an integer ")
        .toInt(),
      body("generation_count")
        .exists()
        .withMessage("the generation_count should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the generation should be an integer")
        .toInt(),
      body("mountType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
    ],
  ]),
  deviceController.createOnPlatform
);

/*soft delete*/
router.delete(
  "/soft",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id "
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name "
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  deviceController.deleteOnPlatform
);
/*soft update device*/
router.put(
  "/soft",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  oneOf([
    [
      body("visibility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .optional()
        .notEmpty()
        .trim(),
      body("mountType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .optional()
        .notEmpty()
        .withMessage("nextMaintenance cannot be empty")
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .optional()
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .optional()
        .notEmpty()
        .trim()
        .custom((value) => {
          let parsedPhoneNumber = phoneUtil.parse(value);
          let isValid = phoneUtil.isValidNumber(parsedPhoneNumber);
          return isValid;
        })
        .withMessage("phoneNumber must be a valid one")
        .bail(),
      body("height")
        .optional()
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .optional()
        .notEmpty()
        .trim(),
      body("readKey")
        .optional()
        .notEmpty()
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("product_name")
        .optional()
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .optional()
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.updateOnPlatform
);

/** generate QR code.... */
router.get(
  "/qrcode",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  oneOf([
    query("include_site")
      .optional()
      .notEmpty()
      .trim()
      .toLowerCase()
      .isIn(["no", "yes"])
      .withMessage(
        "the value is not among the expected ones which can either be NO or YES"
      ),
  ]),
  deviceController.generateQRCode
);

/******************* create-photo use-case ***************/
router.delete(
  "/photos",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("id")
        .exists()
        .withMessage(
          "the photo unique identifier is missing in request, consider using the id"
        )
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device number cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device ID cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device name cannot be empty")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device name should not have spaces in it"),
    ],
  ]),
  photoController.delete
);
router.post(
  "/photos",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("device_number")
        .exists()
        .withMessage("the device number is missing in request")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .exists()
        .withMessage("the device ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .exists()
        .withMessage("the device name is missing in request")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      body("photos")
        .exists()
        .withMessage("the photos are missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the photos should be an array"),
    ],
  ]),
  photoController.create
);
router.put(
  "/photos",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("device_id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("device_name")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the unique device_name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device number is missing in the request")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device name is missing in request")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      body("photos")
        .optional()
        .notEmpty()
        .withMessage("the photos are missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the photos should be an array"),
    ],
  ]),
  photoController.update
);
router.get(
  "/photos",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("device_number")
        .optional()
        .notEmpty()
        .withMessage("this device identifier cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      query("device_name")
        .optional()
        .notEmpty()
        .withMessage("this device identifier cannot be empty")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      query("device_id")
        .optional()
        .notEmpty()
        .withMessage("this device identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("id")
        .optional()
        .notEmpty()
        .withMessage("this device identifier cannot be empty")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  photoController.list
);
/*** platform */
router.post(
  "/photos/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device number cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .exists()
        .withMessage("the device ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .exists()
        .withMessage("the device name is missing in request")
        .bail()
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
      body("image_url")
        .exists()
        .withMessage("the image_url is missing in request")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the image_url cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL")
        .trim(),
      body("tags")
        .optional()
        .notEmpty()
        .withMessage("the tags cannot be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("metadata cannot be empty if provided"),
      body("metadata.url")
        .optional()
        .notEmpty()
        .withMessage("the metadata.url cannot be empty when provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the metadata.url cannot be empty when provided")
        .withMessage("the cannot have spaces in it")
        .bail()
        .isURL()
        .withMessage("the metadata.url cannot be empty when provided")
        .withMessage("the metadata.url is not a valid URL")
        .trim(),
      body("metadata.public_id")
        .optional()
        .notEmpty()
        .withMessage("the metadata.public_id cannot be empty when provided")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the metadata.public_id cannot have spaces in it")
        .trim(),
    ],
  ]),
  photoController.createPhotoOnPlatform
);
router.put(
  "/photos/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the photo unique identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    body()
      .notEmpty()
      .custom((value) => {
        return !isEmpty(value);
      })
      .withMessage("the request body should not be empty"),
  ]),
  oneOf([
    [
      body("device_number")
        .optional()
        .notEmpty()
        .withMessage("the device number is missing in the request")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .optional()
        .notEmpty()
        .withMessage("the device ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("device_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("device_name")
        .optional()
        .notEmpty()
        .withMessage("the device name is missing in request")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("device_name should not have spaces in it"),
      body("image_url")
        .optional()
        .notEmpty()
        .withMessage("the image_url cannot be empty")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL"),
      body("description")
        .optional()
        .trim(),
      body("image_code")
        .optional()
        .trim(),
      body("tags")
        .optional()
        .notEmpty()
        .withMessage("the tags cannot be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage(
          "metadata cannot be empty when provided in this operation"
        ),
      body("metadata.url")
        .optional()
        .notEmpty()
        .withMessage("metadata should not be empty")
        .bail()
        .isURL()
        .withMessage("metadata should be a valid URL")
        .bail()
        .trim(),
      body("metadata.public_id")
        .optional()
        .notEmpty()
        .withMessage("public_id should not be empty")
        .bail()
        .trim(),
      body("metadata.version")
        .optional()
        .notEmpty()
        .withMessage("version should not be empty")
        .bail()
        .isFloat()
        .withMessage("version should be a number")
        .bail()
        .trim(),
      body("metadata.signature")
        .optional()
        .notEmpty()
        .withMessage("signature should not be empty")
        .trim(),
      body("metadata.width")
        .optional()
        .notEmpty()
        .withMessage("width should not be empty")
        .isFloat()
        .withMessage("the width should be a number")
        .bail()
        .trim(),
      body("metadata.height")
        .optional()
        .notEmpty()
        .withMessage("height should not be empty")
        .isFloat()
        .withMessage("the height should be a number")
        .bail()
        .trim(),
      body("metadata.format")
        .optional()
        .trim(),
      body("metadata.resource_type")
        .optional()
        .trim(),
      body("metadata.created_at")
        .optional()
        .trim(),
      body("metadata.bytes")
        .optional()
        .notEmpty()
        .withMessage("bytes should not be empty")
        .isFloat()
        .withMessage("the bytes should be a number")
        .bail()
        .trim(),
      body("metadata.type")
        .optional()
        .trim(),
      body("metadata.secure_url")
        .optional()
        .notEmpty()
        .withMessage("secure_url should not be empty")
        .bail()
        .isURL()
        .withMessage("secure_url should be a valid URL")
        .bail()
        .trim(),
    ],
  ]),
  photoController.updatePhotoOnPlatform
);
router.delete(
  "/photos/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  photoController.deletePhotoOnPlatform
);
/*** metadata */
router.post(
  "/photos/cloud",
  oneOf([
    [
      body("resource_type")
        .exists()
        .withMessage("resource_type is missing in request")
        .trim(),
      body("path")
        .exists()
        .withMessage("resource_type is missing in request")
        .trim(),
      body("device_name")
        .exists()
        .withMessage("device_name is missing in request")
        .trim(),
    ],
  ]),
  photoController.createPhotoOnCloudinary
);
router.delete(
  "/photos/cloud",
  oneOf([
    [
      body("image_urls")
        .exists()
        .withMessage("image_urls is missing in the request body")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the image_urls must be an array")
        .bail()
        .notEmpty()
        .withMessage("the image_urls cannot be empty")
        .trim(),
      body("image_urls.*")
        .isURL()
        .withMessage("the provided URL is not a valid one"),
      query("device_name")
        .exists()
        .withMessage(
          "the device_name query parameter must be provided for this operation"
        )
        .trim(),
    ],
  ]),
  photoController.deletePhotoOnCloudinary
);
router.put("/photos/cloud", photoController.updatePhotoOnCloudinary);

/****************** create activities use-case *************************/
router.post(
  "/activities/recall",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .trim(),
    ],
  ]),
  siteController.recallDevice
);
router.post(
  "/activities/deploy",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("powerType")
        .exists()
        .withMessage("the powerType is is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("mountType")
        .exists()
        .withMessage("the mountType is is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("height")
        .exists()
        .withMessage("the height is is missing in your request")
        .bail()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("the height must be a number between 0 and 100")
        .trim(),
      body("isPrimaryInLocation")
        .exists()
        .withMessage("the isPrimaryInLocation is is missing in your request")
        .bail()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean")
        .trim(),
      body("site_id")
        .exists()
        .withMessage("site_id is missing")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("date")
        .exists()
        .withMessage("date is missing")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("date must be a valid datetime."),
    ],
  ]),
  siteController.deployDevice
);
router.post(
  "/activities/maintain",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("description")
        .exists()
        .withMessage("the description is missing in your request")
        .trim(),
      body("tags")
        .exists()
        .withMessage("the tags are missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("date")
        .exists()
        .withMessage("date is missing")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("date must be a valid datetime."),
    ],
  ]),
  siteController.maintainDevice
);
router.get("/activities", siteController.getActivities);
router.put("/activities", siteController.updateActivity);
router.delete("/activities", siteController.deleteActivity);

/****************************** create sites usecase *************** */
router.get(
  "/sites",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  siteController.list
);

router.get("/sites/weather", siteController.listWeatherStations);
router.get(
  "/sites/weather/nearest",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.listNearestWeatherStation
);

router.get(
  "/sites/airqlouds/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.findAirQlouds
);
router.post(
  "/sites",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
      body("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .trim()
        .custom((value) => {
          return createSiteUtil.validateSiteName(value);
        })
        .withMessage(
          "The name should be greater than 5 and less than 50 in length"
        ),
      body("airqlouds")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .optional()
        .isMongoId()
        .withMessage("each airqloud should be a mongo ID"),
    ],
  ]),
  siteController.register
);

router.post(
  "/sites/metadata",
  oneOf([
    [
      body("latitude")
        .exists()
        .withMessage("the latitude should be provided")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude should be provided")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
    ],
  ]),
  siteController.generateMetadata
);

router.put(
  "/sites",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  oneOf([
    [
      body("status")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["active", "decommissioned"])
        .withMessage(
          "the status value is not among the expected ones which include: decommissioned, active"
        ),
      body("nearest_tahmo_station")
        .optional()
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the nearest_tahmo_station should be an object"),
      body("createdAt")
        .optional()
        .notEmpty()
        .withMessage("createdAt cannot be empty when provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("createdAt date must be a valid datetime."),
      body("location_id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the location_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("distance_to_nearest_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_primary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_primary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_secondary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_secondary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_tertiary_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_tertiary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_unclassified_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_unclassified_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body("bearing_to_kampala_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("bearing_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_kampala_center")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body(" distance_to_nearest_city")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage(" distance_to_nearest_city must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_motorway")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_motorway must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_road")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("landform_270")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_270 must be a number")
        .bail()
        .toFloat(),
      body("landform_90")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_90 must be a number")
        .bail()
        .toFloat(),
      body("greenness")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("greenness must be a number")
        .bail()
        .toFloat(),
      body("altitude")
        .optional()
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("altitude must be a number")
        .bail()
        .toFloat(),
      body("city")
        .optional()
        .notEmpty()
        .trim(),
      body("street")
        .optional()
        .notEmpty()
        .trim(),
      body("latitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("airqlouds")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .optional()
        .isMongoId()
        .withMessage("each airqloud should be a mongo ID"),
    ],
  ]),
  siteController.update
);
router.put(
  "/sites/refresh",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      )
      .bail()
      .trim(),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      )
      .bail()
      .trim(),
  ]),
  siteController.refresh
);

router.delete(
  "/sites",
  query("tenant")
    .exists()
    .withMessage("tenant should be provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["kcca", "airqo"])
    .withMessage("the tenant value is not among the expected ones"),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using id"
      ),
    query("lat_long")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using lat_long"
      ),
    query("generated_name")
      .exists()
      .withMessage(
        "the site identifier is missing in request, consider using generated_name"
      ),
  ]),
  siteController.delete
);
router.get(
  "/sites/nearest",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("longitude")
        .exists()
        .withMessage("the longitude is missing in request")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      query("radius")
        .exists()
        .withMessage("the radius is missing in request")
        .bail()
        .trim()
        .isFloat()
        .withMessage("the radius must be a number")
        .bail()
        .toFloat(),
      query("latitude")
        .exists()
        .withMessage("the latitude is missing in the request")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
    ],
  ]),
  siteController.findNearestSite
);

/******************* create-event use-case *******************************/
router.post(
  "/events",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
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
          "the frequency value is not among the expected ones which include: raw, hourly and daily"
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
  ]),
  eventController.addValues
);

router.post(
  "/events/transform",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
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
          "the frequency value is not among the expected ones which include: raw, hourly and daily"
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
  ]),
  eventController.transform
);
router.get(
  "/events",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("startTime")
        .optional()
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startTime must be a valid datetime."),
      query("endTime")
        .optional()
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endTime must be a valid datetime."),
      query("frequency")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["hourly", "daily", "raw", "minute"])
        .withMessage(
          "the frequency value is not among the expected ones which include: hourly, daily, minute and raw"
        ),
      query("external")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("recent")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the recent value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .optional()
        .notEmpty()
        .trim(),
      query("device_id")
        .optional()
        .notEmpty()
        .trim(),
      query("device_number")
        .optional()
        .notEmpty()
        .trim(),
      query("site")
        .optional()
        .notEmpty()
        .trim(),
      query("site_id")
        .optional()
        .notEmpty()
        .trim(),
      query("primary")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .optional()
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.list
);
router.post(
  "/events/transmit",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant query parameter should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage(
          "the tenant query parameter value is not among the expected ones"
        ),
      query("type")
        .exists()
        .withMessage("type query parameter should be provided")
        .trim()
        .toLowerCase()
        .isIn(["one", "many", "bulk"])
        .withMessage(
          "the type query parameter value is not among the expected ones which are: one, many, bulk"
        ),
      query("name")
        .exists()
        .withMessage("type name parameter should be provided")
        .trim(),
    ],
  ]),
  oneOf([
    body()
      .isArray()
      .withMessage("the request body should be an array"),
  ]),
  oneOf([
    [
      body("*.time")
        .exists()
        .trim()
        .withMessage("time is missing")
        .bail()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("time must be a valid datetime."),
      body("*.pm10")
        .optional()
        .notEmpty()
        .withMessage("pm10 should not be empty if/when provided")
        .bail()
        .isNumeric()
        .withMessage("pm_10 should be an integer value")
        .trim(),
      body("*.pm2_5")
        .optional()
        .notEmpty()
        .withMessage("pm2_5 should not be empty if/when provided")
        .bail()
        .isNumeric()
        .withMessage("pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm2_5")
        .optional()
        .notEmpty()
        .withMessage("s2_pm2_5 should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("s2_pm2_5 should be an integer value")
        .trim(),
      body("*.s2_pm10")
        .optional()
        .notEmpty()
        .withMessage("s2_pm10 should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("s2_pm10 should be an integer value")
        .bail()
        .trim(),
      body("*.latitude")
        .optional()
        .notEmpty()
        .withMessage("provided latitude cannot be empty")
        .bail()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the latitude must have 5 or more characters"
            );
          }
          return Promise.resolve("latitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("*.longitude")
        .optional()
        .notEmpty()
        .withMessage("provided longitude cannot be empty")
        .bail()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .custom((value) => {
          let dp = decimalPlaces(value);
          if (dp < 5) {
            return Promise.reject(
              "the longitude must have 5 or more characters"
            );
          }
          return Promise.resolve("longitude validation test has passed");
        })
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("*.battery")
        .optional()
        .notEmpty()
        .withMessage("battery should not be empty if/when provided")
        .bail()
        .isInt()
        .withMessage("battery should be an integer value")
        .trim(),
      body("*.others")
        .optional()
        .notEmpty()
        .withMessage("others cannot be empty if provided"),
      body("*.status")
        .optional()
        .notEmpty()
        .withMessage("status cannot be empty if provided"),
    ],
  ]),
  eventController.transmitValues
);
/*clear events*/
router.delete(
  "/events",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("device_number")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_number"
      )
      .bail()
      .trim()
      .isInt()
      .withMessage("the device_number should be an integer value"),
    query("device_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("site_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the device_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("site_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("device")
      .exists()
      .withMessage(
        "the device identifier is missing in request, consider using the device name"
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  eventController.deleteValuesOnPlatform
);

/************************** locations usecase  *******************/
router.post(
  "/locations",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("location")
        .exists()
        .withMessage("the location is is missing in your request")
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .exists()
        .withMessage("location.coordinates is is missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .exists()
        .withMessage("location.type is is missing in your request")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("admin_level")
        .exists()
        .withMessage("admin_level is is missing in your request")
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
      body("location_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("isCustom")
        .optional()
        .notEmpty()
        .withMessage("isCustom cannot be empty")
        .isBoolean()
        .withMessage("isCustom must be Boolean")
        .trim(),
    ],
  ]),
  locationController.register
);

router.get(
  "/locations",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  locationController.list
);

router.put(
  "/locations",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the location identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("name")
        .optional()
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
      body("description")
        .optional()
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("long_name")
        .optional()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .optional()
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .optional()
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .optional()
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("location_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  locationController.update
);

router.delete(
  "/locations",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the location identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  locationController.delete
);

/************************** airqlouds usecase  *******************/
router.post(
  "/airqlouds",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("location_id")
      .exists()
      .withMessage(
        "location details are missing in your request, consider using location_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("location_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    [
      body("location")
        .exists()
        .withMessage(
          "location details are missing in your request, consider using location"
        )
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .exists()
        .withMessage("location.coordinates is missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .exists()
        .withMessage("location.type is is missing in your request")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
    ],
  ]),
  oneOf([
    [
      body("long_name")
        .exists()
        .withMessage("the long_name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("isCustom")
        .optional()
        .notEmpty()
        .withMessage("isCustom cannot be empty")
        .isBoolean()
        .withMessage("isCustom must be Boolean")
        .trim(),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("admin_level")
        .exists()
        .withMessage("admin_level is missing in your request")
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
      body("airqloud_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .optional()
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
    ],
  ]),
  airqloudController.register
);

router.put(
  "/airqlouds/refresh",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using name"
      )
      .bail()
      .trim(),
  ]),
  airqloudController.refresh
);

router.get(
  "/airqlouds",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  airqloudController.list
);

router.get(
  "/airqlouds/sites",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using name"
      )
      .bail()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim(),
    query("admin_level")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using admin_level"
      )
      .trim()
      .bail()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
      ])
      .withMessage(
        "admin_level values include: village, county, subcounty, village, parish, country, division and district"
      ),
  ]),
  airqloudController.findSites
);

router.put(
  "/airqlouds",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("name")
        .optional()
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
        ])
        .withMessage(
          "admin_level values include: village, county, subcounty, village, parish, country, division and district"
        ),
      body("description")
        .optional()
        .trim(),
      body("sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .optional()
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("long_name")
        .optional()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .optional()
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .optional()
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .optional()
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("airqloud_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  airqloudController.update
);

router.delete(
  "/airqlouds",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  airqloudController.delete
);

router.get(
  "/airqlouds/center",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(["kcca", "airqo"])
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request query, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in your request query, consider using name"
      )
      .bail()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim(),
    body("coordinates")
      .exists()
      .withMessage(
        "a required field is missing in your request body, consider using coordinates"
      )
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage(
        "the coordinates should be an array or arrays, each containing a pair of coordinates"
      )
      .notEmpty()
      .withMessage("the coordinates cannot be empty"),
    query("admin_level")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request query, consider using admin_level"
      )
      .trim()
      .bail()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
      ])
      .withMessage(
        "admin_level values include: village, county, subcounty, village, parish, country, division and district"
      ),
  ]),
  airqloudController.calculateGeographicalCenter
);

module.exports = router;
