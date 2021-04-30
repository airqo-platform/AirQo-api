const express = require("express");
const router = express.Router();
const deviceController = require("../controllers/create-device");
const siteController = require("../controllers/manage-site");
const middlewareConfig = require("../config/router.middleware");
const validate = require("express-validation");
const componentController = require("../controllers/create-component");
const eventController = require("../controllers/create-event");
const imageUpload = require("../utils/multer");
const imageController = require("../controllers/process-image");

middlewareConfig(router);

/******************* create device ***************************/
router.get("/", deviceController.listAll);
router.post("/ts", deviceController.createThing);
router.delete("/ts/delete", deviceController.deleteThing);
router.delete("/ts/clear", deviceController.clearThing);
router.put("/ts/update", deviceController.updateThingSettings);
router.get("/by/location", deviceController.listAllByLocation);
router.get("/by/nearest-coordinates", deviceController.listAllByNearestCoordinates);
router.post("/", deviceController.createOne);
router.delete("/photos", deviceController.deletePhotos);
router.delete("/delete", deviceController.delete);
router.put("/update", deviceController.updateDevice);

/****************** manage site *************************/
router.post("/ts/activity", siteController.doActivity);
router.get("/ts/activity", siteController.getActivities);
router.put("/ts/activity/update", siteController.updateActivity);
router.delete("/ts/activity/delete", siteController.deleteActivity);
router.post(
  "/upload-images",
  imageUpload.array("image"),
  imageController.uploadMany
);

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
