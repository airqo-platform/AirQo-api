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
  validateBulkUpdateDevices,
} = require("@validators/site.validators");

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  res.setHeader(
    "Access-Control-Allow-Origin",
    "https://analytics.airqo.net, https://staging-analytics.airqo.net",
    "https://platform.airqo.net",
    "https://staging-platform.airqo.net"
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  // Check if the request method is OPTIONS (preflight request)
  if (req.method === "OPTIONS") {
    res.sendStatus(200); // Respond with a 200 status for preflight requests
  } else {
    next(); // Continue to the next middleware for non-preflight requests
  }
};

router.use(headers);
router.use(validatePagination);

/****************************** create sites use-case *************** */
router.get("/", validateTenant, validateSiteQueryParams, siteController.list);
router.get(
  "/summary",
  validateTenant,
  validateSiteQueryParams,
  siteController.listSummary
);
router.get("/weather", validateTenant, siteController.listWeatherStations);
router.get(
  "/weather/nearest",
  validateTenant,
  validateMandatorySiteIdentifier,
  siteController.listNearestWeatherStation
);
router.get(
  "/airqlouds/",
  validateTenant,
  validateMandatorySiteIdentifier,
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
  siteController.createApproximateCoordinates
);
router.get("/nearest", validateNearestSite, siteController.findNearestSite);
router.put("/bulk", validateBulkUpdateDevices, siteController.updateManySites);
module.exports = router;
