const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/create-site");
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
        .isDate()
        .withMessage("nextMaintenance must be a Date"),
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
        .isInt()
        .withMessage("phoneNumber must be an integer")
        .bail()
        .toInt(),
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
        .isInt()
        .withMessage("phoneNumber must be an integer")
        .bail()
        .toInt(),
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
        .trim()
        .isDate()
        .withMessage("nextMaintenance must be a Date"),
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
        .isInt()
        .withMessage("phoneNumber must be an integer")
        .bail()
        .toInt(),
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
/**** delete photos */
router.delete("/photos", photoController.deletePhotos);

/****************** create-site use-case *************************/
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
        .isFloat({ gt: 0, lt: 10 })
        .withMessage("the height must be a number between 0 and 10")
        .trim(),
      body("isPrimaryInLocation")
        .exists()
        .withMessage("the isPrimaryInLocation is is missing in your request")
        .bail()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean")
        .trim(),
      body("isUsedForCollocation")
        .exists()
        .withMessage("the isUsedForCollocation is is missing in your request")
        .bail()
        .isBoolean()
        .withMessage("isUsedForCollocation must be Boolean")
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
      body("maintenanceType")
        .exists()
        .withMessage("the maintenanceType is is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["preventive", "corrective"])
        .withMessage(
          "the mountType value is not among the expected ones which include: corrective and preventive"
        ),
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
    ],
  ]),
  siteController.register
);

router.post(
  "/sites/metadata",
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
router.post("/sites/nearest", siteController.findNearestSite);

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
      body()
        .isArray()
        .withMessage("the request body should be an array"),
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
        .if(query("*.device_number").exists())
        .notEmpty()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value"),
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
    [
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name should not be empty")
        .trim(),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("location")
        .exists()
        .withMessage("the location is is missing in your request"),
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
        .toLowerCase()
        .isIn(["polygon", "point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: polygon and point"
        ),
      body("airqloud_tags")
        .if(body("airqloud_tags").exists())
        .notEmpty()
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
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
    ],
  ]),
  airqloudController.list
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
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using name"
      )
      .bail()
      .trim()
      .custom((value) => {
        return createSiteUtil.validateSiteName(value);
      })
      .withMessage(
        "The name should be greater than 5 and less than 50 in length"
      ),
  ]),
  oneOf([
    [
      body("name")
        .if(body("name").exists())
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .customSanitizer((value) => {
          return createSiteUtil.sanitiseName(value);
        })
        .trim(),
      body("description")
        .if(body("description").exists())
        .notEmpty()
        .trim(),
      body("location")
        .if(body("location").exists())
        .notEmpty()
        .withMessage("the location should not be empty"),
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
        .toLowerCase()
        .isIn(["polygon", "point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: polygon and point"
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

    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using the name "
      )
      .bail()
      .trim()
      .isLowercase()
      .withMessage("device name should be lower case")
      .bail()
      .matches(constants.WHITE_SPACES_REGEX, "i")
      .withMessage("the device names do not have spaces in them"),
  ]),
  airqloudController.delete
);

module.exports = router;
