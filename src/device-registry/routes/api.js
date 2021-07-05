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

middlewareConfig(router);

/******************* create device ***************************/
router.get("/", oneOf([[query("tenant").exists()]]), deviceController.listAll);
router.post(
  "/ts",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant does not exist"),
      body("visibility")
        .exists()
        .withMessage("visibility does not exist"),
      body("name")
        .exists()
        .withMessage("name does not exist"),
      body("device_number")
        .exists()
        .withMessage("device_number does not exist"),
      body("name")
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device name should not have spaces in it"),
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
      body("name")
        .isLength({ min: 5, max: 9 })
        .withMessage(
          "minimum length should be 5 characters and maximum length should be 9 characters"
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
  "/",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided"),
      body("visibility")
        .exists()
        .withMessage("visibility should be provided")
        .bail()
        .isBoolean()
        .withMessage("visibility must be Boolean"),
      body("device_number")
        .exists()
        .withMessage("device_number should be provided")
        .bail()
        .isInt()
        .withMessage("the generation should be an integer between 1 and 99 "),
      body("name")
        .exists()
        .withMessage("name should be provided")
        .bail()
        .matches(constants.WHITE_SPACES_REGEX, "i")
        .withMessage("the device name should not have white spaces in it")
        .isLength({ min: 5, max: 9 })
        .withMessage(
          "minimum length should be 5 characters and maximum length should be 9 characters"
        ),
      body("generation")
        .exists()
        .withMessage("the generation number should be provided")
        .bail()
        .isInt({ min: 1, max: 99 })
        .withMessage("the generation should be an integer between 1 and 99 "),
      body("generation_count")
        .exists()
        .withMessage("the generation_count should be provided")
        .bail()
        .isInt({ min: 1, max: 99 })
        .withMessage("the generation should be an integer between 1 and 99 "),
      body("mountType")
        .if(body("mountType").exists())
        .notEmpty()
        .isIn(["pole", "wall", "faceboard", "rooftop"])
        .withMessage(
          "the mountType value is not among the expected ones which include pole, wall, faceboard and rooftop "
        ),
      body("powerType")
        .if(body("powerType").exists())
        .notEmpty()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include solar, mains and alternator"
        ),
    ],
  ]),
  deviceController.createOne
);
router.delete("/photos", deviceController.deletePhotos);
router.delete("/delete", deviceController.delete);
router.put("/update", deviceController.updateDevice);

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
