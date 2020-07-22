const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/device");
const { authJWT } = require("../services/auth");
const middlewareConfig = require("../config/router.middleware");
const deviceValidation = require("../utils/validations");
const validate = require("express-validation");
const mqttBridge = require("../controllers/mqtt-bridge");
const httpBridge = require("../controllers/http-bridge");
const sensorController = require("../controllers/sense");

middlewareConfig(router);

router.get("/", deviceController.listAll);
router.get("/gcp", deviceController.listAllGcp);

router.post(
  "/",
  validate(deviceValidation.createDevice),
  deviceController.createOne
);
router.post("/gcp/", deviceController.createOneGcp);

router.get("/:id", deviceController.listOne);
router.get("/:name/gcp", deviceController.listOneGcp);

router.delete("/:id", authJWT, deviceController.delete);
router.delete("/:name/gcp", deviceController.deleteGcp);

router.put(
  "/:id",
  authJWT,
  validate(deviceValidation.updateDevice),
  deviceController.updateDevice
);
router.put("/:name/gcp", deviceController.updateDeviceGcp);

/*** creation of Things   *********/
router.post("/ts", deviceController.createThing);
router.delete("/ts/delete", deviceController.deleteThing);
router.delete("/ts/clear", deviceController.clearThing);
router.put("/ts/update", deviceController.updateThingSettings);
router.post("/ts/deploy/device", deviceController.deployDevice);
router.get("/get/sensors", sensorController.listAll);
router.get("/get/loc", deviceController.listAllByLocation);

//configuration of devices
// router.get('/mqtt/config/gcp', mqttBridge.reviewConfigs);
// router.get('/http/config/gcp', httpBridge.reviewConfigs);
// router.put('/mqtt/config/gcp', mqttBridge.updateConfigs);
// router.put('/http/config/gcp', httpBridge.updateConfigs);

//publish telemetry
// router.push('/mqtt/publish/gcp', mqttBridge.publish);
// router.push('/http/publish/gcp', httpBridge.publish);

module.exports = router;
