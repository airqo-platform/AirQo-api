// routes/v2/transmit.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const transmitValidations = require("@validators/transmit.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get("/", pagination(), eventController.list);

router.post(
  "/transform",
  transmitValidations.transformEvents,
  eventController.transform
);

router.post(
  "/single",
  transmitValidations.transmitSingleEvent,
  eventController.transmitMultipleSensorValues
);

router.post(
  "/bulk",
  transmitValidations.transmitBulkEvents,
  eventController.bulkTransmitMultipleSensorValues
);

module.exports = router;
