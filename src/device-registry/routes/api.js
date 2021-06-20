const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/manage-site");
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
router.get("/", deviceController.listAll);
router.post("/ts", deviceController.createThing);
router.delete("/ts/delete", deviceController.deleteThing);
router.delete("/ts/clear", deviceController.clearThing);
router.put("/ts/update", deviceController.updateThingSettings);
router.get("/by/location", deviceController.listAllByLocation);
router.get(
  "/by/nearest-coordinates",
  deviceController.listAllByNearestCoordinates
);
router.post("/", deviceController.createOne);
router.delete("/photos", deviceController.deletePhotos);
router.delete("/delete", deviceController.delete);
router.put("/update", deviceController.updateDevice);

/****************** manage site *************************/
router.post(
  "/sites/activities/recall",
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  siteController.recallDevice
);
router.post(
  "/sites/activities/deploy",
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  validateRequestBody(siteController.deploymentFields),
  siteController.deployDevice
);
router.post(
  "/sites/activities/maintain",
  checkTenancy,
  validateRequestQuery(["deviceName"]),
  validateRequestBody(siteController.maintenanceField),
  siteController.maintainDevice
);
router.get("/sites/activities", siteController.getActivities);
router.put("/sites/activities", siteController.updateActivity);
router.delete("/sites/activities", siteController.deleteActivity);
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
