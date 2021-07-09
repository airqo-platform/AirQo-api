const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/create-site");
const middlewareConfig = require("../config/router.middleware");
const componentController = require("../controllers/create-component");
const eventController = require("../controllers/create-event");
const imageUpload = require("../utils/multer");
const imageController = require("../controllers/process-image");
const { checkTenancy } = require("../utils/validators/auth");
const { validateRequestQuery } = require("../utils/validators/requestQuery");
const { validateRequestBody } = require("../utils/validators/requestBody");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("../config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

middlewareConfig(router);

/******************* create device ***************************/
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant parameter should be provided")
        .trim()
        .toLowerCase(),
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
  deviceController.listAll
);
router.post(
  "/ts",
  oneOf([
    [
      query("tenant")
        .trim()
        .toLowerCase()
        .exists()
        .withMessage("tenant parameter should be provided"),
      body("visibility")
        .trim()
        .exists()
        .withMessage("visibility should be provided")
        .bail()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("name")
        .trim()
        .exists()
        .withMessage("the name should be part of the request body")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device name should not have spaces in it")
        .bail()
        .isLength({ min: 5, max: 9 })
        .withMessage(
          "minimum length should be 5 characters and maximum length should be 9 characters"
        ),
      body("device_number")
        .trim()
        .exists()
        .withMessage("device_number should be part of the request body")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device_number should not have spaces in it"),
      body("mountType")
        .trim()
        .if(body("mountType").exists())
        .notEmpty()
        .isIn(["pole", "wall", "faceboard", "suspended", "rooftop"])
        .withMessage(
          "the mountType value is not among the expected ones of pole, wall, rooftop, suspended and faceboard"
        ),
      body("powerType")
        .trim()
        .if(body("powerType").exists())
        .notEmpty()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones of solar, mains and alternator"
        ),
    ],
  ]),
  deviceController.createThing
);
router.delete(
  "/ts/delete",
  oneOf([[query("tenant").exists(), query("name").exists()]]),
  deviceController.deleteThing
);
router.delete(
  "/ts/clear",
  oneOf([[query("tenant").exists(), query("name").exists()]]),
  deviceController.clearThing
);
router.put(
  "/ts/update",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant does not exist"),
      query("device")
        .exists()
        .withMessage("device does not exist"),
      body("mountType")
        .isIn(["pole", "wall", "motor"])
        .withMessage(
          "the mountType value is not among the expected ones of pole, walll and motor"
        ),
      body("powerType")
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones of solar, mains and alternator"
        ),
    ],
  ]),
  deviceController.updateThingSettings
);
router.get("/by/location", deviceController.listAllByLocation);
router.get(
  "/by/nearest-coordinates",
  deviceController.listAllByNearestCoordinates
);
router.post(
  "/soft",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .trim()
        .toLowerCase(),
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
        .trim()
        .toLowerCase(),
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
router.delete("/photos", deviceController.deletePhotos);
router.delete(
  "/delete/soft",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .trim()
      .toLowerCase(),
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
router.put(
  "/soft",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .trim()
      .toLowerCase(),
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
        .trim()
        .toLowerCase(),
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
  deviceController.updateOnPlatform
);

/****************** manage site *************************/
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
  imageController.uploadMany
);
router.get("/sites", oneOf([check("tenant").exists()]), siteController.list);
router.post(
  "/sites",
  oneOf([
    [
      check("tenant").exists(),
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
    check("tenant").exists(),
    check("id").exists(),
    check("lat_long").exists(),
    check("generated_name").exists(),
  ]),
  siteController.update
);
router.delete(
  "/sites",
  check("tenant").exists(),
  oneOf([
    check("id").exists(),
    check("lat_long").exists(),
    check("generated_name").exists(),
  ]),
  siteController.delete
);
router.post("/sites/nearest", siteController.findNearestSite);

/******************* create component **************************/
router.get("/list/components/", componentController.listAll);
router.post("/add/components/", componentController.addComponent);
router.delete("/delete/components/", componentController.deleteComponent);
router.put("/update/components/", componentController.updateComponent);
router.post("/add/components/types", componentController.createType);
router.get("/list/components/types", componentController.getTypes);

/******************* create event *******************************/
router.post("/events/add", eventController.addValues);
router.get("/events", eventController.getValues);
router.post("/events/transmit", eventController.transmitValues);

module.exports = router;
