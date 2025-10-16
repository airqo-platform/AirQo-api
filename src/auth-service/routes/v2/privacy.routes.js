const express = require("express");
const router = express.Router();
const privacyController = require("@controllers/privacy.controller");
const { setJWTAuth, authJWT } = require("@middleware/passport");
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
router.use(setJWTAuth);
router.use(authJWT);

// Location Tracking Preferences
router.get("/location-preferences", privacyController.getLocationPreferences);
router.put(
  "/location-preferences",
  privacyController.updateLocationPreferences
);

// Privacy Zones
router.post(
  "/privacy-zones",
  privacyValidator.validateCreatePrivacyZone,
  privacyController.createPrivacyZone
);
router.get("/privacy-zones", privacyController.listPrivacyZones);
router.put(
  "/privacy-zones/:zoneId",
  privacyValidator.validateUpdatePrivacyZone,
  privacyController.updatePrivacyZone
);
router.delete(
  "/privacy-zones/:zoneId",
  privacyValidator.validateUpdatePrivacyZone,
  privacyController.deletePrivacyZone
);

// Location Data Management
router.get(
  "/location-data",
  privacyValidator.validateListLocationData,
  privacyController.listLocationData
);
router.delete(
  "/location-data/:pointId",
  privacyValidator.validateDeleteLocationPoint,
  privacyController.deleteLocationPoint
);
router.delete(
  "/location-data/range",
  privacyValidator.validateDeleteLocationDataRange,
  privacyController.deleteLocationDataRange
);
router.delete("/location-data", privacyController.clearAllLocationData);

module.exports = router;
