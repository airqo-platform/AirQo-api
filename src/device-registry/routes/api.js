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

/******************* creation of Things   *****************/
router.post("/ts", deviceController.createThing);
router.delete("/ts/delete", deviceController.deleteThing);
router.delete("/ts/clear", deviceController.clearThing);
router.put("/ts/update", deviceController.updateThingSettings);
router.post("/ts/activity", deviceController.doActivity);
router.get("/by/location", deviceController.listAllByLocation);

/********************** photo uploads ***************************/
router.post(
  "/upload-images",
  imageUpload.array("image"),
  imageController.uploadMany
);

/******************* components ************************* */
router.get("/list/components/", componentController.listAll);
router.post("/add/components/", componentController.addComponent);
router.delete("/delete/components/", componentController.deleteComponent);
router.put("/update/components/", componentController.updateComponent);
router.post("/add/components/types", componentController.createType);
router.get("/list/components/types", componentController.getTypes);

/******************* loading transformed values ******************************/
router.post("/components/add/values", componentController.addValues);
router.post("/components/add/values/bulk", componentController.addBulk);

/********************** push values from device ***************************/
router.post("/components/push/ts", componentController.writeToThing);
router.post("/components/push/ts/json", componentController.writeToThingJSON);

//configuration of devices
// router.get('/mqtt/config/gcp', mqttBridge.reviewConfigs);
// router.get('/http/config/gcp', httpBridge.reviewConfigs);
// router.put('/mqtt/config/gcp', mqttBridge.updateConfigs);
// router.put('/http/config/gcp', httpBridge.updateConfigs);

//publish telemetry
// router.push('/mqtt/publish/gcp', mqttBridge.publish);
// router.push('/http/publish/gcp', httpBridge.publish);

module.exports = router;
