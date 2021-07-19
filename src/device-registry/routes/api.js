const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/create-site");
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
const ObjectId = mongoose.Types.ObjectId;

middlewareConfig(router);

/******************* create device use-case ***************************/
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
        .trim()
        .isLowercase()
        .withMessage("device name should be lower case")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device names do not have spaces in them"),
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
        .exists()
        .withMessage("device_number should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value")
        .toInt(),
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
        .withMessage("please provide valid latitude value"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value"),
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
        .isFloat()
        .withMessage("height must be a float")
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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
        .isFloat()
        .withMessage("height must be a float")
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
        .withMessage("please provide valid latitude value"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value"),
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
        .exists()
        .withMessage("device_number should be provided")
        .bail()
        .trim()
        .isInt()
        .withMessage("the device_number should be an integer value")
        .toInt(),
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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
        .isFloat()
        .withMessage("height must be a float")
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
        .withMessage("please provide valid latitude value"),
      body("longitude")
        .if(body("longitude").exists())
        .notEmpty()
        .trim()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("please provide valid longitude value"),
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  siteController.recallDevice
);
router.post(
  "/activities/deploy",
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  validateRequestBody(siteController.deploymentFields),
  siteController.deployDevice
);
router.post(
  "/activities/maintain",
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  validateRequestBody(siteController.maintenanceField),
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
      body("latitude").exists(),
      body("longitude").exists(),
      body("latitude").matches(constants.LATITUDE_REGEX, "i"),
      body("longitude").matches(constants.LONGITUDE_REGEX, "i"),
    ],
  ]),
  siteController.register
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
    check("id").exists(),
    check("lat_long").exists(),
    check("generated_name").exists(),
  ]),
  siteController.update
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
    check("id").exists(),
    check("lat_long").exists(),
    check("generated_name").exists(),
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
        .isISO8601()
        .withMessage("time must be a valid ISO 8601 date."),
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
      body("*.device")
        .if(body("*.device").exists())
        .notEmpty()
        .trim()
        .toLowerCase(),
      body("*.site")
        .if(body("*.site").exists())
        .notEmpty()
        .trim()
        .toLowerCase(),
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
      .withMessage("the device_number should be an integer value")
      .toInt(),
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

module.exports = router;
