const express = require("express");
const router = express.Router();
const siteController = require("@controllers/site.controller");

const {
  validateTenant,
  validateSiteQueryParams,
  validateMandatorySiteIdentifier,
  validateCreateSite,
  validateSiteIdParam,
  validateSiteMetadata,
  validateUpdateSite,
  validateRefreshSite,
  validateDeleteSite,
  validateCreateApproximateCoordinates,
  validateGetApproximateCoordinates,
  validateNearestSite,
  validateBulkUpdateSites,
} = require("@validators/site.validators");
const { validate } = require("@validators/common");
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

// STATUS-BASED LISTING ENDPOINTS
router.get(
  "/status/operational",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  validate,
  siteController.listOperationalSites
);

router.get(
  "/status/transmitting",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  validate,
  siteController.listTransmittingSites
);

router.get(
  "/status/data-available",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  validate,
  siteController.listDataAvailableSites
);

router.get(
  "/status/not-transmitting",
  validateTenant,
  validateSiteQueryParams,
  pagination(),
  validate,
  siteController.listNotTransmittingSites
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
router.put(
  "/refresh",
  validateMandatorySiteIdentifier,
  validateRefreshSite,
  siteController.refresh
);
router.delete(
  "/",
  validateMandatorySiteIdentifier,
  validateDeleteSite,
  siteController.delete
);
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
router.get(
  "/:id",
  validateTenant,
  validateSiteIdParam,
  validate,
  siteController.getSiteDetailsById
);
module.exports = router;
