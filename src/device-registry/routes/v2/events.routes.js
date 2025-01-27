// events.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const eventValidations = require("@validators/events.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get(
  "/running",
  eventValidations.listRunningDevices,
  pagination(),
  eventController.listRunningDevices
);
router.get(
  "/good",
  eventValidations.listGoodEvents,
  pagination(),
  eventController.listGood
);
router.get(
  "/moderate",
  eventValidations.listModerateEvents,
  pagination(),
  eventController.listModerate
);
router.get(
  "/u4sg",
  eventValidations.listU4sgEvents,
  pagination(),
  eventController.listU4sg
);
router.get(
  "/unhealthy",
  eventValidations.listUnhealthyEvents,
  pagination(),
  eventController.listUnhealthy
);
router.get(
  "/very_unhealthy",
  eventValidations.listVeryUnhealthyEvents,
  pagination(),
  eventController.listVeryUnhealthy
);
router.get(
  "/hazardous",
  eventValidations.listHazardousEvents,
  pagination(),
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
  pagination(),
  eventController.listRecent
);
router.get(
  "/all",
  eventValidations.listAllEvents,
  pagination(),
  eventController.listEventsForAllDevices
);
router.get(
  "/",
  eventValidations.listEvents,
  pagination(),
  eventController.list
);

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
