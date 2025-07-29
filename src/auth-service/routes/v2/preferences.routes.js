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

router.post(
  "/validate",
  preferenceValidations.validatePreferenceData,
  preferenceController.validatePreferenceData
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
// ===========================================
// INDIVIDUAL USER THEME ROUTES
// ===========================================

// Personal theme (user's default theme across all contexts)
router.get(
  "/theme/user/:user_id",
  preferenceValidations.getUserPersonalTheme,
  authenticateJWT,
  preferenceController.getUserPersonalTheme
);

router.put(
  "/theme/user/:user_id",
  preferenceValidations.updateUserPersonalTheme,
  authenticateJWT,
  preferenceController.updateUserPersonalTheme
);

// User theme within group context
router.get(
  "/theme/user/:user_id/group/:group_id",
  preferenceValidations.getUserGroupTheme,
  authenticateJWT,
  preferenceController.getUserGroupTheme
);

router.put(
  "/theme/user/:user_id/group/:group_id",
  preferenceValidations.updateUserGroupTheme,
  authenticateJWT,
  preferenceController.updateUserGroupTheme
);

// User theme within group context (using default group when no group_id provided)
router.get(
  "/theme/user/:user_id/group",
  preferenceValidations.getUserDefaultGroupTheme,
  authenticateJWT,
  preferenceController.getUserDefaultGroupTheme
);

router.put(
  "/theme/user/:user_id/group",
  preferenceValidations.updateUserDefaultGroupTheme,
  authenticateJWT,
  preferenceController.updateUserDefaultGroupTheme
);

// User theme within network context
router.get(
  "/theme/user/:user_id/network/:network_id",
  preferenceValidations.getUserNetworkTheme,
  authenticateJWT,
  preferenceController.getUserNetworkTheme
);

router.put(
  "/theme/user/:user_id/network/:network_id",
  preferenceValidations.updateUserNetworkTheme,
  authenticateJWT,
  preferenceController.updateUserNetworkTheme
);

// User theme within network context (using default network when no network_id provided)
router.get(
  "/theme/user/:user_id/network",
  preferenceValidations.getUserDefaultNetworkTheme,
  authenticateJWT,
  preferenceController.getUserDefaultNetworkTheme
);

router.put(
  "/theme/user/:user_id/network",
  preferenceValidations.updateUserDefaultNetworkTheme,
  authenticateJWT,
  preferenceController.updateUserDefaultNetworkTheme
);

// ===========================================
// ORGANIZATION THEME ROUTES
// ===========================================

// Group organization themes
router.get(
  "/theme/organization/group/:group_id",
  preferenceValidations.getGroupTheme,
  authenticateJWT,
  preferenceController.getGroupTheme
);

router.put(
  "/theme/organization/group/:group_id",
  preferenceValidations.updateGroupTheme,
  authenticateJWT,
  preferenceController.updateGroupTheme
);

// Network organization themes
router.get(
  "/theme/organization/network/:network_id",
  preferenceValidations.getNetworkTheme,
  authenticateJWT,
  preferenceController.getNetworkTheme
);

router.put(
  "/theme/organization/network/:network_id",
  preferenceValidations.updateNetworkTheme,
  authenticateJWT,
  preferenceController.updateNetworkTheme
);

// ===========================================
// EFFECTIVE THEME ROUTE (THEME RESOLUTION)
// ===========================================

// Get effective theme based on context and hierarchy
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
