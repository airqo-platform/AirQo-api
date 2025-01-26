// metadata.routes.js
const express = require("express");
const router = express.Router();
const siteController = require("@controllers/site.controller");
const airqloudController = require("@controllers/airqloud.controller");
const cohortController = require("@controllers/cohort.controller");
const gridController = require("@controllers/grid.controller");
const deviceController = require("@controllers/device.controller");
const metadataValidations = require("@validators/metadata.validators");

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);
router.use(metadataValidations.pagination());
router.use(metadataValidations.addCategoryQueryParam);

router.get("/sites", metadataValidations.listSites, siteController.list);

router.get(
  "/airqlouds",
  metadataValidations.listAirQloud,
  airqloudController.list
);

router.get("/grids", metadataValidations.listGrids, gridController.list);

router.get("/cohorts", metadataValidations.listCohorts, cohortController.list);

router.get("/devices", metadataValidations.listDevices, deviceController.list);

router.get("/sites/:site_id", metadataValidations.getSite, siteController.list);

router.get(
  "/airqlouds/:airqloud_id",
  metadataValidations.getAirqloud,
  airqloudController.list
);

router.get("/grids/:grid_id", metadataValidations.getGrid, gridController.list);

router.get(
  "/cohorts/:cohort_id",
  metadataValidations.getCohort,
  cohortController.list
);

router.get(
  "/devices/:device_id",
  metadataValidations.getDevice,
  deviceController.list
);

module.exports = router;
