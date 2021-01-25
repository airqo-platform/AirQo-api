const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device");
const { authJWT } = require("../services/auth");
const middlewareConfig = require("../config/router.middleware");
const deviceValidation = require("../utils/validations");
const validate = require("express-validation");
const mqttBridge = require("../controllers/mqtt-bridge");
const httpBridge = require("../controllers/http-bridge");
const componentController = require("../controllers/component");
const imageUpload = require("../utils/multer");
const imageController = require("../controllers/process-image");

middlewareConfig(router);

/******************* Devices using ThingSpeak  *************************************/
router.get("/", deviceController.listAll);
router.post("/ts", deviceController.createThing);
router.delete("/ts/delete", deviceController.deleteThing);
router.delete("/ts/clear", deviceController.clearThing);
router.put("/ts/update", deviceController.updateThingSettings);
router.get("/by/location", deviceController.listAllByLocation);
//location activities
router.post("/ts/activity", deviceController.doActivity);
router.get("/ts/activity", deviceController.getActivities);
router.put("/ts/activity/update", deviceController.updateActivity);
router.delete("/ts/activity/delete", deviceController.deleteActivity);
router.post(
  "/upload-images",
  imageUpload.array("image"),
  imageController.uploadMany
);

/******************* components or sensors **************************/
router.get("/list/components/", componentController.listAll);
router.post("/add/components/", componentController.addComponent);
router.delete("/delete/components/", componentController.deleteComponent);
router.put("/update/components/", componentController.updateComponent);
router.post("/add/components/types", componentController.createType);
router.get("/list/components/types", componentController.getTypes);

/******************* Events *****************************************/
router.post("/events/add", componentController.addValues);
router.post("/events/add/bulk", componentController.addBulk);
router.get("/events", componentController.getValues);
router.post("/events/push/one", componentController.writeToThing);
router.post("/events/push", componentController.writeToThingJSON);

/************************** using GCP tools  *********************************/
//configuration of devices
// router.get('/mqtt/config/gcp', mqttBridge.reviewConfigs);
// router.get('/http/config/gcp', httpBridge.reviewConfigs);
// router.put('/mqtt/config/gcp', mqttBridge.updateConfigs);
// router.put('/http/config/gcp', httpBridge.updateConfigs);

//publish telemetry
// router.push('/mqtt/publish/gcp', mqttBridge.publish);
// router.push('/http/publish/gcp', httpBridge.publish);
// router.get("/gcp", deviceController.listAllGcp);

// router.post(
//   "/",
//   validate(deviceValidation.createDevice),
//   deviceController.createOne
// );
// router.post("/gcp/", deviceController.createOneGcp);

// router.get("/:id", deviceController.listOne);
// router.get("/:name/gcp", deviceController.listOneGcp);

// router.delete("/:id", authJWT, deviceController.delete);
// router.delete("/:name/gcp", deviceController.deleteGcp);

// router.put(
//   "/:id",
//   authJWT,
//   validate(deviceValidation.updateDevice),
//   deviceController.updateDevice
// );
// router.put("/:name/gcp", deviceController.updateDeviceGcp);

module.exports = router;
