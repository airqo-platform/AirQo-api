// measurements.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const measurementsValidations = require("@validators/measurements.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

router.get("/", measurementsValidations.listMeasurements, eventController.list);

router.get(
  "/historical",
  measurementsValidations.listHistoricalMeasurements,
  eventController.listHistorical
);

router.get(
  "/recent",
  measurementsValidations.listRecentMeasurements,
  eventController.listRecent
);

router.get(
  "/latest",
  measurementsValidations.listLatestMeasurements,
  eventController.listRecent
);

router.get(
  "/location/:latitude/:longitude",
  measurementsValidations.listMeasurementsByLocation,
  eventController.listByLatLong
);

router.get(
  "/sites/:site_id/historical",
  measurementsValidations.listHistoricalSiteMeasurements,
  eventController.listHistorical
);

router.get(
  "/sites/:site_id/recent",
  measurementsValidations.listRecentSiteMeasurements,
  eventController.listRecent
);

router.get(
  "/sites/:site_id/averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAverages,
  eventController.listAverages
);

router.get(
  "/sites/:site_id/v2-averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAveragesV2,
  eventController.listAveragesV2
);

router.get(
  "/sites/:site_id/v3-averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAveragesV3,
  eventController.listAveragesV3
);

router.get(
  "/sites/:site_id",
  measurementsValidations.listSiteMeasurements,
  eventController.list
);

router.get(
  "/airqlouds/:airqloud_id/historical",
  measurementsValidations.listHistoricalAirqloudMeasurements,
  eventController.listByAirQloudHistorical
);

router.get(
  "/airqlouds/:airqloud_id/recent",
  measurementsValidations.listRecentAirqloudMeasurements,
  eventController.listByAirQloud
);

router.get(
  "/airqlouds/:airqloud_id",
  measurementsValidations.listAirqloudMeasurements,
  eventController.listByAirQloud
);

router.get(
  "/grids/:grid_id/historical",
  measurementsValidations.listHistoricalGridMeasurements,
  eventController.listByGridHistorical
);

router.get(
  "/grids/:grid_id/recent",
  measurementsValidations.listRecentGridMeasurements,
  eventController.listByGrid
);

router.get(
  "/grids/:grid_id",
  measurementsValidations.listGridMeasurements,
  eventController.listByGrid
);

router.get(
  "/cohorts/:cohort_id/historical",
  measurementsValidations.listHistoricalCohortMeasurements,
  eventController.listByCohortHistorical
);

router.get(
  "/cohorts/:cohort_id/recent",
  measurementsValidations.listRecentCohortMeasurements,
  eventController.listByCohort
);

router.get(
  "/cohorts/:cohort_id",
  measurementsValidations.listCohortMeasurements,
  eventController.listByCohort
);

router.get(
  "/devices/:device_id/historical",
  measurementsValidations.listHistoricalDeviceMeasurements,
  eventController.listHistorical
);

router.get(
  "/devices/:device_id/recent",
  measurementsValidations.listRecentDeviceMeasurements,
  eventController.listRecent
);

router.get(
  "/devices/:device_id",
  measurementsValidations.listDeviceMeasurements,
  eventController.list
);

module.exports = router;
