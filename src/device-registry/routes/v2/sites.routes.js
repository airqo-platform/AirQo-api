const express = require("express");
const router = express.Router();
const siteController = require("@controllers/site.controller");

const {
  validateTenant,
  validateSiteQueryParams,
  validateMandatorySiteIdentifier,
  validateCreateSite,
  validateSiteMetadata,
  validateUpdateSite,
  validateRefreshSite,
  validateDeleteSite,
  validateCreateApproximateCoordinates,
  validateGetApproximateCoordinates,
  validateNearestSite,
  validateBulkUpdateSites,
} = require("@validators/site.validators");
const { headers, pagination } = require("@validators/common");

router.use(headers);

/****************************** create sites use-case *************** */
router.get(
  "/",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  siteController.list
);
router.get(
  "/summary",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  siteController.listSummary
);
router.get(
  "/weather",
  validateTenant,
  pagination(),
  siteController.listWeatherStations
);
router.get(
  "/weather/nearest",
  validateTenant,
  validateMandatorySiteIdentifier,
  pagination(),
  siteController.listNearestWeatherStation
);
router.get(
  "/airqlouds/",
  validateTenant,
  validateMandatorySiteIdentifier,
  pagination(),
  siteController.findAirQlouds
);
router.post("/", validateTenant, validateCreateSite, siteController.register);
router.post(
  "/metadata",
  validateTenant,
  validateSiteMetadata,
  siteController.generateMetadata
);
router.put(
  "/",
  validateTenant,
  validateMandatorySiteIdentifier,
  validateUpdateSite,
  siteController.update
);
router.put("/refresh", validateRefreshSite, siteController.refresh);
router.delete("/", validateDeleteSite, siteController.delete);
router.post(
  "/approximate",
  validateCreateApproximateCoordinates,
  siteController.createApproximateCoordinates
);
router.get(
  "/approximate",
  validateGetApproximateCoordinates,
  pagination(),
  siteController.createApproximateCoordinates
);
router.get(
  "/nearest",
  validateNearestSite,
  pagination(),
  siteController.findNearestSite
);
router.put("/bulk", validateBulkUpdateSites, siteController.updateManySites);
module.exports = router;
