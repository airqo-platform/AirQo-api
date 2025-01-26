// events.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const eventValidations = require("@validators/events.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.get(
  "/running",
  eventValidations.listRunningDevices,
  eventController.listRunningDevices
);
router.get("/good", eventValidations.listGoodEvents, eventController.listGood);
router.get(
  "/moderate",
  eventValidations.listModerateEvents,
  eventController.listModerate
);
router.get("/u4sg", eventValidations.listU4sgEvents, eventController.listU4sg);
router.get(
  "/unhealthy",
  eventValidations.listUnhealthyEvents,
  eventController.listUnhealthy
);
router.get(
  "/very_unhealthy",
  eventValidations.listVeryUnhealthyEvents,
  eventController.listVeryUnhealthy
);
router.get(
  "/hazardous",
  eventValidations.listHazardousEvents,
  eventController.listHazardous
);

router.post("/", eventValidations.addEvents, eventController.addValues);
router.post(
  "/transform",
  eventValidations.transformEvents,
  eventController.transform
);

router.get(
  "/latest",
  eventValidations.listRecentEvents,
  eventController.listRecent
);
router.get(
  "/all",
  eventValidations.listAllEvents,
  eventController.listEventsForAllDevices
);
router.get("/", eventValidations.listEvents, eventController.list);

router.post(
  "/transmit/single",
  eventValidations.transmitMultipleSensorValues,
  eventController.transmitMultipleSensorValues
);

router.post(
  "/transmit/bulk",
  eventValidations.bulkTransmitMultipleSensorValues,
  eventController.bulkTransmitMultipleSensorValues
);

router.delete(
  "/",
  eventValidations.deleteValuesOnPlatform,
  eventController.deleteValuesOnPlatform
);

module.exports = router;
