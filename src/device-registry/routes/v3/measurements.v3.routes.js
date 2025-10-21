const express = require("express");
const router = express.Router();
const eventControllerV3 = require("@controllers/event.v3.controller");
const measurementsValidations = require("@validators/measurements.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

// V3 Routes - With intelligent routing
router.get(
  "/",
  measurementsValidations.listMeasurements,
  pagination(),
  eventControllerV3.listV3
);

router.get(
  "/historical",
  measurementsValidations.listHistoricalMeasurements,
  pagination(),
  eventControllerV3.listHistoricalV3
);

router.get(
  "/recent",
  measurementsValidations.listRecentMeasurements,
  pagination(),
  eventControllerV3.listRecentV3
);

router.get(
  "/grids/:grid_id/historical",
  measurementsValidations.listHistoricalGridMeasurements,
  pagination(),
  eventControllerV3.listByGridHistoricalV3
);

router.get(
  "/grids/:grid_id",
  measurementsValidations.listGridMeasurements,
  pagination(),
  eventControllerV3.listByGridV3
);

// ... Add other V3 routes ...

module.exports = router;
