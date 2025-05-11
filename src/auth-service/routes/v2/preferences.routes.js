// preferences.routes.js
const express = require("express");
const router = express.Router();
const preferenceController = require("@controllers/preference.controller");
const preferenceValidations = require("@validators/preferences.validators");
const { authenticateJWT } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};
router.use(headers);
router.use(preferenceValidations.pagination(100, 1000));

router.post(
  "/upsert",
  preferenceValidations.upsert,
  preferenceController.upsert
);

router.patch(
  "/replace",
  preferenceValidations.replace,
  preferenceController.replace
);

router.put(
  "/:user_id",
  preferenceValidations.update,
  preferenceController.update
);

router.post("/", preferenceValidations.create, preferenceController.create);

router.get("/", preferenceValidations.list, preferenceController.list);

router.delete(
  "/:user_id",
  preferenceValidations.deletePreference,
  authenticateJWT,
  preferenceController.delete
);

router.get(
  "/selected-sites",
  preferenceValidations.getSelectedSites,
  preferenceController.listSelectedSites
);

router.post(
  "/selected-sites",
  preferenceValidations.addSelectedSites,
  authenticateJWT,
  preferenceController.addSelectedSites
);

router.put(
  "/selected-sites/:site_id",
  preferenceValidations.updateSelectedSite,
  authenticateJWT,
  preferenceController.updateSelectedSite
);

router.delete(
  "/selected-sites/:site_id",
  preferenceValidations.deleteSelectedSite,
  authenticateJWT,
  preferenceController.deleteSelectedSite
);

router.get(
  "/recent/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  preferenceController.getMostRecent
);

router.get(
  "/all/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  preferenceController.listAll
);

router.post(
  "/:deviceId/charts",
  authenticateJWT,
  preferenceValidations.createChart,
  preferenceController.createChart
);

router.put(
  "/:deviceId/charts/:chartId",
  authenticateJWT,
  preferenceValidations.updateChart,
  preferenceController.updateChart
);

router.delete(
  "/:deviceId/charts/:chartId",
  authenticateJWT,
  preferenceValidations.deleteChart,
  preferenceController.deleteChart
);

router.get(
  "/:deviceId/charts",
  authenticateJWT,
  preferenceValidations.getChartConfigurations,
  preferenceController.getChartConfigurations
);

router.post(
  "/:deviceId/charts/:chartId/copy",
  authenticateJWT,
  preferenceValidations.copyChart,
  preferenceController.copyChart
);

router.get(
  "/:deviceId/charts/:chartId",
  authenticateJWT,
  preferenceValidations.getChartConfigurationById,
  preferenceController.getChartConfigurationById
);

// Theme routes
router.get(
  "/theme/user/:user_id",
  preferenceValidations.getUserTheme,
  authenticateJWT,
  preferenceController.getTheme
);

router.put(
  "/theme/user/:user_id",
  preferenceValidations.updateUserTheme,
  authenticateJWT,
  preferenceController.updateUserTheme
);

router.get(
  "/theme/organization/:group_id",
  preferenceValidations.getOrganizationTheme,
  authenticateJWT,
  preferenceController.getTheme
);

router.put(
  "/theme/organization/:group_id",
  preferenceValidations.updateOrganizationTheme,
  authenticateJWT,
  preferenceController.updateOrganizationTheme
);

router.get(
  "/theme/effective/:user_id",
  preferenceValidations.getEffectiveTheme,
  authenticateJWT,
  preferenceController.getEffectiveTheme
);

router.get(
  "/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  preferenceController.list
);

module.exports = router;
