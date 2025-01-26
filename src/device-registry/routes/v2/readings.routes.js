// readings.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const readingsValidations = require("@validators/readings.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.get("/map", eventController.readingsForMap);

router.get(
  "/best-air-quality",
  readingsValidations.bestAirQuality,
  eventController.getBestAirQuality
);

router.get(
  "/recent",
  readingsValidations.recent,
  eventController.recentReadings
);

router.get(
  "/sites/:site_id/averages",
  readingsValidations.listAverages,
  eventController.listReadingAverages
);

router.get("/fetchAndStoreData", eventController.fetchAndStoreData);

module.exports = router;
