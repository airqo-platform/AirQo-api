// readings.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const readingsValidations = require("@validators/readings.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get("/map", pagination(), eventController.readingsForMap);

router.get(
  "/best-air-quality",
  readingsValidations.bestAirQuality,
  pagination(),
  eventController.getBestAirQuality
);

router.get(
  "/recent",
  readingsValidations.recent,
  pagination(),
  eventController.recentReadings
);

router.get(
  "/worst/devices",
  readingsValidations.worstReadingForDevices,
  eventController.getWorstReadingForDevices
);

router.get(
  "/worst/sites",
  readingsValidations.worstReadingForSites,
  eventController.getWorstReadingForSites
);

router.get(
  "/sites/:site_id/averages",
  readingsValidations.listAverages,
  pagination(),
  eventController.listReadingAverages
);

router.get(
  "/fetchAndStoreData",
  pagination(),
  eventController.fetchAndStoreData
);

module.exports = router;
