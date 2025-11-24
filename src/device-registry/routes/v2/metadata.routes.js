// metadata.routes.js
const express = require("express");
const router = express.Router();
const siteController = require("@controllers/site.controller");
const airqloudController = require("@controllers/airqloud.controller");
const cohortController = require("@controllers/cohort.controller");
const gridController = require("@controllers/grid.controller");
const deviceController = require("@controllers/device.controller");
const metadataValidations = require("@validators/metadata.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);
router.use(metadataValidations.addCategoryQueryParam);

/** Nearest Locations */

router.post(
  "/routes/nearest-locations",
  metadataValidations.findNearestLocations,
  pagination(),
  siteController.findNearestLocations
);

router.get(
  "/sites",
  metadataValidations.listSites,
  pagination(),
  siteController.list
);

router.get(
  "/airqlouds",
  metadataValidations.listAirQloud,
  pagination(),
  airqloudController.list
);

router.get(
  "/grids",
  metadataValidations.listGrids,
  pagination(),
  gridController.list
);

router.get(
  "/cohorts",
  metadataValidations.listCohorts,
  pagination(),
  cohortController.list
);

router.get(
  "/devices",
  metadataValidations.listDevices,
  pagination(),
  deviceController.list
);

router.get(
  "/sites/:site_id",
  metadataValidations.getSite,
  pagination(),
  siteController.list
);

router.get(
  "/airqlouds/:airqloud_id",
  metadataValidations.getAirqloud,
  pagination(),
  airqloudController.list
);

router.get(
  "/grids/:grid_id",
  metadataValidations.getGrid,
  pagination(),
  gridController.list
);

router.get(
  "/cohorts/:cohort_id",
  metadataValidations.getCohort,
  pagination(),
  cohortController.list
);

router.get(
  "/devices/:device_id",
  metadataValidations.getDevice,
  pagination(),
  deviceController.list
);

module.exports = router;
