const express = require("express");
const router = express.Router();
const privacyController = require("@controllers/privacy.controller");
const { enhancedJWTAuth } = require("@middleware/passport");
const privacyValidator = require("@validators/privacy.validators");

const headers = (req, res, next) => {
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);

// Location Tracking Preferences
router.get(
  "/location-preferences",
  enhancedJWTAuth,
  privacyController.getLocationPreferences
);
router.put(
  "/location-preferences",
  enhancedJWTAuth,
  privacyController.updateLocationPreferences
);

// Privacy Zones
router.post(
  "/privacy-zones",
  enhancedJWTAuth,
  privacyValidator.validateCreatePrivacyZone,
  privacyController.createPrivacyZone
);
router.get(
  "/privacy-zones",
  enhancedJWTAuth,
  privacyController.listPrivacyZones
);
router.put(
  "/privacy-zones/:zoneId",
  enhancedJWTAuth,
  privacyValidator.validateUpdatePrivacyZone,
  privacyController.updatePrivacyZone
);
router.delete(
  "/privacy-zones/:zoneId",
  enhancedJWTAuth,
  privacyValidator.validateUpdatePrivacyZone,
  privacyController.deletePrivacyZone
);

// Location Data Management
router.get(
  "/location-data",
  enhancedJWTAuth,
  privacyValidator.validateListLocationData,
  privacyController.listLocationData
);
router.delete(
  "/location-data/:pointId",
  enhancedJWTAuth,
  privacyValidator.validateDeleteLocationPoint,
  privacyController.deleteLocationPoint
);
router.delete(
  "/location-data/range",
  enhancedJWTAuth,
  privacyValidator.validateDeleteLocationDataRange,
  privacyController.deleteLocationDataRange
);
router.delete(
  "/location-data",
  enhancedJWTAuth,
  privacyController.clearAllLocationData
);

module.exports = router;
