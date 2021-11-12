const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/create-site");
const locationController = require("../controllers/create-location");
const airqloudController = require("../controllers/create-airqloud");
const middlewareConfig = require("../config/router.middleware");
const componentController = require("../controllers/create-component");
const eventController = require("../controllers/create-event");
const imageUpload = require("../utils/multer");
const photoController = require("../controllers/create-photo");
const { checkTenancy } = require("../utils/validators/auth");
const { validateRequestQuery } = require("../utils/validators/requestQuery");
const { validateRequestBody } = require("../utils/validators/requestBody");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const sanitize = require("../utils/sanitize");
const ObjectId = mongoose.Types.ObjectId;
const numeral = require("numeral");
const createSiteUtil = require("../utils/create-site");
const createAirQloudUtil = require("../utils/create-location");
const { logElement } = require("../utils/log");
const { isBoolean, isEmpty } = require("underscore");
const phoneUtil = require("google-libphonenumber").PhoneNumberUtil.getInstance();
const { registerDeviceUtil } = require("../utils/create-device");

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
        .if(body("visibility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .if(body("long_name").exists())
        .notEmpty()
        .trim(),
      body("mountType")
        .if(body("mountType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .if(body("powerType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .if(body("isActive").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .if(body("isRetired").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .if(body("mobility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .if(body("nextMaintenance").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .if(body("isPrimaryInLocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .if(body("isUsedForCollocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .if(body("owner").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .if(body("host_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .if(body("phoneNumber").exists())
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
        .if(body("height").exists())
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 10 })
        .withMessage("height must be a number between 0 and 10")
        .bail()
        .toFloat(),
      body("elevation")
        .if(body("elevation").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .if(body("writeKey").exists())
        .notEmpty()
        .withMessage("writeKey should not be empty")
        .trim(),
      body("readKey")
        .if(body("readKey").exists())
        .notEmpty()
        .withMessage("readKey should not be empty")
        .trim(),
      body("latitude")
        .if(body("latitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("product_name")
        .if(body("product_name").exists())
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .if(body("device_manufacturer").exists())
        .notEmpty()
        .trim(),
    ],
  ]),
  deviceController.encryptKeys
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
        .if(query("device_number").exists())
        .notEmpty()
        .trim()
        .isInt()
        .withMessage("device_number must be an integer")
        .bail()
        .toInt(),
      query("id")
        .if(query("id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("site_id")
        .if(query("site_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .if(query("name").exists())
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
        .if(body("device_number").exists())
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
        .if(body("mountType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .if(body("powerType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("latitude")
        .if(body("latitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("product_name")
        .if(body("product_name").exists())
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .if(body("device_manufacturer").exists())
        .notEmpty()
        .trim(),
      body("isActive")
        .if(body("isActive").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .if(body("isRetired").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .if(body("mobility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .if(body("nextMaintenance").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .if(body("isPrimaryInLocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .if(body("isUsedForCollocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .if(body("owner").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .if(body("host_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .if(body("phoneNumber").exists())
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
        .if(body("height").exists())
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .if(body("elevation").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .if(body("writeKey").exists())
        .notEmpty()
        .trim(),
      body("readKey")
        .if(body("readKey").exists())
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
        .if(body("visibility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .if(body("long_name").exists())
        .notEmpty()
        .trim(),
      body("mountType")
        .if(body("mountType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("status")
        .if(body("status").exists())
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
        ])
        .withMessage(
          "the status value is not among the expected ones which include: recalled, ready, deployed, undeployed, decommissioned, assembly "
        ),
      body("powerType")
        .if(body("powerType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .if(body("isActive").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .if(body("isRetired").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .if(body("mobility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .if(body("nextMaintenance").exists())
        .notEmpty()
        .withMessage("nextMaintenance date cannot be empty")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance date must be a valid datetime."),
      body("isPrimaryInLocation")
        .if(body("isPrimaryInLocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .if(body("isUsedForCollocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .if(body("owner").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .if(body("host_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .if(body("phoneNumber").exists())
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
        .if(body("height").exists())
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .if(body("elevation").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .if(body("writeKey").exists())
        .notEmpty()
        .trim(),
      body("readKey")
        .if(body("readKey").exists())
        .notEmpty()
        .trim(),
      body("latitude")
        .if(body("latitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .if(body("description").exists())
        .trim(),
      body("product_name")
        .if(body("product_name").exists())
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .if(body("device_manufacturer").exists())
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
        .if(body("device_number").exists())
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
        .if(body("mountType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .if(body("powerType").exists())
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
        .if(body("visibility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("long_name")
        .if(body("long_name").exists())
        .notEmpty()
        .trim(),
      body("mountType")
        .if(body("mountType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("powerType")
        .if(body("powerType").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("isActive")
        .if(body("isActive").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isActive must be Boolean"),
      body("isRetired")
        .if(body("isRetired").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isRetired must be Boolean"),
      body("mobility")
        .if(body("mobility").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("mobility must be Boolean"),
      body("nextMaintenance")
        .if(body("nextMaintenance").exists())
        .notEmpty()
        .withMessage("nextMaintenance cannot be empty")
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("nextMaintenance must be a valid datetime."),
      body("isPrimaryInLocation")
        .if(body("isPrimaryInLocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean"),
      body("isUsedForCollocation")
        .if(body("isUsedForCollocation").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean"),
      body("owner")
        .if(body("owner").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the owner must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("host_id")
        .if(body("host_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the host_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("phoneNumber")
        .if(body("phoneNumber").exists())
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
        .if(body("height").exists())
        .notEmpty()
        .trim()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("height must be a number between 0 and 100")
        .bail()
        .toFloat(),
      body("elevation")
        .if(body("elevation").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("elevation must be a float")
        .bail()
        .toFloat(),
      body("writeKey")
        .if(body("writeKey").exists())
        .notEmpty()
        .trim(),
      body("readKey")
        .if(body("readKey").exists())
        .notEmpty()
        .trim(),
      body("latitude")
        .if(body("latitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("product_name")
        .if(body("product_name").exists())
        .notEmpty()
        .trim(),
      body("device_manufacturer")
        .if(body("device_manufacturer").exists())
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
      .if(query("include_site").exists())
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
        .if(body("device_number").exists())
        .notEmpty()
        .withMessage("the device number cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .if(body("device_id").exists())
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
        .if(body("device_name").exists())
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
        .if(body("device_number").exists())
        .notEmpty()
        .withMessage("the device number is missing in the request")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .if(body("device_id").exists())
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
        .if(body("device_name").exists())
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
        .if(body("photos").exists())
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
        .if(query("device_number").exists())
        .notEmpty()
        .withMessage("this device identifier cannot be empty")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      query("device_name")
        .if(query("device_name").exists())
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
        .if(query("device_id").exists())
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
        .if(query("id").exists())
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
        .if(body("device_number").exists())
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
        .if(body("tags").exists())
        .notEmpty()
        .withMessage("the tags cannot be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .if(body("metadata").exists())
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
        .if(body("metadata.url").exists())
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
        .if(body("metadata.public_id").exists())
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
        .if(body("device_number").exists())
        .notEmpty()
        .withMessage("the device number is missing in the request")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
      body("device_id")
        .if(body("device_id").exists())
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
        .if(body("device_name").exists())
        .notEmpty()
        .withMessage("the device name is missing in request")
        .bail()
        .trim()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("device_name should not have spaces in it"),
      body("image_url")
        .if(body("image_url").exists())
        .notEmpty()
        .withMessage("the image_url cannot be empty")
        .bail()
        .isURL()
        .withMessage("the image_url is not a valid URL"),
      body("description")
        .if(body("description").exists())
        .trim(),
      body("image_code")
        .if(body("image_code").exists())
        .trim(),
      body("tags")
        .if(body("tags").exists())
        .notEmpty()
        .withMessage("the tags cannot be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("metadata")
        .if(body("metadata").exists())
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
        .if(body("metadata.url").exists())
        .notEmpty()
        .withMessage("metadata should not be empty")
        .bail()
        .isURL()
        .withMessage("metadata should be a valid URL")
        .bail()
        .trim(),
      body("metadata.public_id")
        .if(body("metadata.public_id").exists())
        .notEmpty()
        .withMessage("public_id should not be empty")
        .bail()
        .trim(),
      body("metadata.version")
        .if(body("metadata.version").exists())
        .notEmpty()
        .withMessage("version should not be empty")
        .bail()
        .isFloat()
        .withMessage("version should be a number")
        .bail()
        .trim(),
      body("metadata.signature")
        .if(body("metadata.signature").exists())
        .notEmpty()
        .withMessage("signature should not be empty")
        .trim(),
      body("metadata.width")
        .if(body("metadata.width").exists())
        .notEmpty()
        .withMessage("width should not be empty")
        .isFloat()
        .withMessage("the width should be a number")
        .bail()
        .trim(),
      body("metadata.height")
        .if(body("metadata.height").exists())
        .notEmpty()
        .withMessage("height should not be empty")
        .isFloat()
        .withMessage("the height should be a number")
        .bail()
        .trim(),
      body("metadata.format")
        .if(body("metadata.format").exists())
        .trim(),
      body("metadata.resource_type")
        .if(body("metadata.resource_type").exists())
        .trim(),
      body("metadata.created_at")
        .if(body("metadata.created_at").exists())
        .trim(),
      body("metadata.bytes")
        .if(body("metadata.bytes").exists())
        .notEmpty()
        .withMessage("bytes should not be empty")
        .isFloat()
        .withMessage("the bytes should be a number")
        .bail()
        .trim(),
      body("metadata.type")
        .if(body("metadata.type").exists())
        .trim(),
      body("metadata.secure_url")
        .if(body("metadata.secure_url").exists())
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
router.post(
  "/upload-images",
  imageUpload.array("image"),
  photoController.uploadManyPhotosOnCloudinary
);

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
        .if(body("airqlouds").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .if(body("airqlouds.*").exists())
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
        .if(body("status").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["active", "decommissioned"])
        .withMessage(
          "the status value is not among the expected ones which include: decommissioned, active"
        ),
      body("nearest_tahmo_station")
        .if(body("nearest_tahmo_station").exists())
        .notEmpty()
        .custom((value) => {
          return typeof value === "object";
        })
        .bail()
        .withMessage("the nearest_tahmo_station should be an object"),
      body("createdAt")
        .if(body("createdAt").exists())
        .notEmpty()
        .withMessage("createdAt cannot be empty when provided")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("createdAt date must be a valid datetime."),
      body("location_id")
        .if(body("location_id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("the location_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("distance_to_nearest_road")
        .if(body("distance_to_nearest_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_primary_road")
        .if(body("distance_to_nearest_primary_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_primary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_secondary_road")
        .if(body("distance_to_nearest_secondary_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_secondary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_tertiary_road")
        .if(body("distance_to_nearest_tertiary_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_tertiary_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_unclassified_road")
        .if(body("distance_to_nearest_unclassified_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_unclassified_road must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .if(body("distance_to_nearest_residential_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body("bearing_to_kampala_center")
        .if(body("bearing_to_kampala_center").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("bearing_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_kampala_center")
        .if(body("distance_to_kampala_center").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_kampala_center must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_residential_road")
        .if(body("distance_to_nearest_residential_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_residential_road must be a number")
        .bail()
        .toFloat(),
      body(" distance_to_nearest_city")
        .if(body(" distance_to_nearest_city").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage(" distance_to_nearest_city must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_motorway")
        .if(body("distance_to_nearest_motorway").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_motorway must be a number")
        .bail()
        .toFloat(),
      body("distance_to_nearest_road")
        .if(body("distance_to_nearest_road").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("distance_to_nearest_road must be a number")
        .bail()
        .toFloat(),
      body("landform_270")
        .if(body("landform_270").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_270 must be a number")
        .bail()
        .toFloat(),
      body("landform_90")
        .if(body("landform_90").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("landform_90 must be a number")
        .bail()
        .toFloat(),
      body("greenness")
        .if(body("greenness").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("greenness must be a number")
        .bail()
        .toFloat(),
      body("altitude")
        .if(body("altitude").exists())
        .notEmpty()
        .trim()
        .isFloat()
        .withMessage("altitude must be a number")
        .bail()
        .toFloat(),
      body("city")
        .if(body("city").exists())
        .notEmpty()
        .trim(),
      body("street")
        .if(body("street").exists())
        .notEmpty()
        .trim(),
      body("latitude")
        .if(body("latitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("please provide valid latitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value")
        .bail()
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the longitude must have atleast 5 decimal places in it"),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("airqlouds")
        .if(body("airqlouds").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the airqlouds should be an array")
        .bail()
        .notEmpty()
        .withMessage("the airqlouds should not be empty"),
      body("airqlouds.*")
        .if(body("airqlouds.*").exists())
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
        .customSanitizer((value) => {
          return numeral(value).format("0.00000");
        })
        .isDecimal({ decimal_digits: 5 })
        .withMessage("the latitude must have atleast 5 decimal places in it"),
    ],
  ]),
  siteController.findNearestSite
);

/******************* create-component use-case **************************/
router.get("/list/components/", componentController.listAll);
router.post("/add/components/", componentController.addComponent);
router.delete("/delete/components/", componentController.deleteComponent);
router.put("/update/components/", componentController.updateComponent);
router.post("/add/components/types", componentController.createType);
router.get("/list/components/types", componentController.getTypes);

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
        .if(body("*.is_device_primary").exists())
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
        .if(body("*.is_test_data").exists())
        .notEmpty()
        .trim()
        .isBoolean()
        .withMessage("is_test_data should be boolean"),
      body("*.device")
        .if(body("*.device").exists())
        .notEmpty()
        .trim(),
      body("*.site")
        .if(body("*.site").exists())
        .notEmpty()
        .trim(),
      body("*.device_number")
        .if(body("*.device_number").exists())
        .notEmpty()
        .isInt()
        .withMessage("the device_number should be an integer value")
        .bail()
        .trim(),
    ],
  ]),
  eventController.addValues
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
        .if(query("startTime").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("startTime must be a valid datetime."),
      query("endTime")
        .if(query("endTime").exists())
        .notEmpty()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("endTime must be a valid datetime."),
      query("frequency")
        .if(query("frequency").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["hourly", "daily", "raw", "minute"])
        .withMessage(
          "the frequency value is not among the expected ones which include: hourly, daily, minute and raw"
        ),
      query("external")
        .if(query("external").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage(
          "the external value is not among the expected ones which include: no and yes"
        ),
      query("device")
        .if(query("device").exists())
        .notEmpty()
        .trim(),
      query("device_id")
        .if(query("device_id").exists())
        .notEmpty()
        .trim(),
      query("device_number")
        .if(query("device_number").exists())
        .notEmpty()
        .trim(),
      query("site")
        .if(query("site").exists())
        .notEmpty()
        .trim(),
      query("site_id")
        .if(query("site_id").exists())
        .notEmpty()
        .trim(),
      query("primary")
        .if(query("primary").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
      query("metadata")
        .if(query("metadata").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["site", "site_id", "device", "device_id"])
        .withMessage(
          "valid values include: site, site_id, device and device_id"
        ),
      query("test")
        .if(query("test").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["yes", "no"])
        .withMessage("valid values include: YES and NO"),
    ],
  ]),
  eventController.getValues
);
router.post("/events/transmit", eventController.transmitValues);
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
        .if(body("metadata").exists())
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
        .if(body("description").exists())
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
        .if(body("location_tags").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("isCustom")
        .if(body("isCustom").exists())
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
        .if(query("id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .if(query("name").exists())
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .if(query("admin_level").exists())
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
        .if(body("name").exists())
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
        .if(body("admin_level").exists())
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
        .if(body("description").exists())
        .trim(),
      body("metadata")
        .if(body("metadata").exists())
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
        .if(body("long_name").exists())
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .if(body("isCustom").exists())
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .if(body("location").exists())
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
        .if(body("location.coordinates").exists())
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .if(body("location.type").exists())
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("location_tags")
        .if(body("location_tags").exists())
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
        .if(body("metadata").exists())
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
        .if(body("isCustom").exists())
        .notEmpty()
        .withMessage("isCustom cannot be empty")
        .isBoolean()
        .withMessage("isCustom must be Boolean")
        .trim(),
      body("description")
        .if(body("description").exists())
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
        .if(body("airqloud_tags").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("sites")
        .if(body("sites").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .if(body("sites.*").exists())
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
    ],
  ]),
  airqloudController.register
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
        .if(query("id").exists())
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .if(query("name").exists())
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .if(query("admin_level").exists())
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
        .if(body("name").exists())
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
        .if(body("admin_level").exists())
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
        .if(body("description").exists())
        .trim(),
      body("sites")
        .if(body("sites").exists())
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .if(body("sites.*").exists())
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
      body("metadata")
        .if(body("metadata").exists())
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
        .if(body("long_name").exists())
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .if(body("isCustom").exists())
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .if(body("location").exists())
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
        .if(body("location.coordinates").exists())
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .if(body("location.type").exists())
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("airqloud_tags")
        .if(body("airqloud_tags").exists())
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

module.exports = router;
