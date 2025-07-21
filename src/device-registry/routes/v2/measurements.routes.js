// measurements.routes.js
const express = require("express");
const router = express.Router();
const eventController = require("@controllers/event.controller");
const measurementsValidations = require("@validators/measurements.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

router.get(
  "/",
  measurementsValidations.listMeasurements,
  pagination(),
  eventController.list
);

router.get(
  "/historical",
  measurementsValidations.listHistoricalMeasurements,
  pagination(),
  eventController.listHistorical
);

router.get(
  "/recent",
  measurementsValidations.listRecentMeasurements,
  pagination(),
  eventController.listRecent
);

router.get(
  "/latest",
  measurementsValidations.listLatestMeasurements,
  pagination(),
  eventController.listRecent
);

router.get(
  "/location/:latitude/:longitude",
  measurementsValidations.listMeasurementsByLocation,
  pagination(),
  eventController.listByLatLong
);

router.get(
  "/sites/:site_id/historical",
  measurementsValidations.listHistoricalSiteMeasurements,
  pagination(),
  eventController.listHistorical
);

router.get(
  "/sites/:site_id/recent",
  measurementsValidations.listRecentSiteMeasurements,
  pagination(),
  eventController.listRecent
);

router.get(
  "/sites/:site_id/averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAverages,
  pagination(),
  eventController.listAverages
);

router.get(
  "/sites/:site_id/v2-averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAveragesV2,
  pagination(),
  eventController.listAveragesV2
);

router.get(
  "/sites/:site_id/v3-averages",
  measurementsValidations.averagesLimiter,
  measurementsValidations.listSiteAveragesV3,
  pagination(),
  eventController.listAveragesV3
);

router.get(
  "/sites/:site_id",
  measurementsValidations.listSiteMeasurements,
  pagination(),
  eventController.list
);

router.get(
  "/airqlouds/:airqloud_id/historical",
  measurementsValidations.listHistoricalAirqloudMeasurements,
  pagination(),
  eventController.listByAirQloudHistorical
);

router.get(
  "/airqlouds/:airqloud_id/recent",
  measurementsValidations.listRecentAirqloudMeasurements,
  pagination(),
  eventController.listByAirQloud
);

router.get(
  "/airqlouds/:airqloud_id",
  measurementsValidations.listAirqloudMeasurements,
  pagination(),
  eventController.listByAirQloud
);

router.get(
  "/grids/:grid_id/historical",
  measurementsValidations.listHistoricalGridMeasurements,
  pagination(),
  eventController.listByGridHistorical
);

router.get(
  "/grids/:grid_id/recent",
  measurementsValidations.listRecentGridMeasurements,
  pagination(),
  eventController.listByGrid
);

router.get(
  "/grids/:grid_id",
  measurementsValidations.listGridMeasurements,
  pagination(),
  eventController.listByGrid
);

router.get(
  "/cohorts/:cohort_id/historical",
  measurementsValidations.listHistoricalCohortMeasurements,
  pagination(),
  eventController.listByCohortHistorical
);

router.get(
  "/cohorts/:cohort_id/recent",
  measurementsValidations.listRecentCohortMeasurements,
  pagination(),
  eventController.listByCohort
);

router.get(
  "/cohorts/:cohort_id",
  measurementsValidations.listCohortMeasurements,
  pagination(),
  eventController.listByCohort
);

router.get(
  "/devices/:device_id/historical",
  measurementsValidations.listHistoricalDeviceMeasurements,
  pagination(),
  eventController.listHistorical
);

router.get(
  "/devices/:device_id/recent",
  measurementsValidations.listRecentDeviceMeasurements,
  pagination(),
  eventController.listRecent
);

router.get(
  "/devices/:device_id",
  measurementsValidations.listDeviceMeasurements,
  pagination(),
  eventController.list
);

module.exports = router;
