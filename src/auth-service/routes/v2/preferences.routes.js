// preferences.routes.js
const express = require("express");
const router = express.Router();
const preferenceController = require("@controllers/preference.controller");
const preferenceValidations = require("@validators/preferences.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

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

// No pagination for DELETE
router.delete(
  "/:user_id",
  preferenceValidations.deletePreference,
  enhancedJWTAuth,
  preferenceController.delete
);

router.get(
  "/selected-sites",
  preferenceValidations.getSelectedSites,
  pagination(), // Apply pagination here
  preferenceController.listSelectedSites
);

router.post(
  "/selected-sites",
  preferenceValidations.addSelectedSites,
  enhancedJWTAuth,
  preferenceController.addSelectedSites
);

router.put(
  "/selected-sites/:site_id",
  preferenceValidations.updateSelectedSite,
  enhancedJWTAuth,
  preferenceController.updateSelectedSite
);

router.delete(
  "/selected-sites/:site_id",
  preferenceValidations.deleteSelectedSite,
  enhancedJWTAuth,
  preferenceController.deleteSelectedSite
);

router.get(
  "/recent/:user_id",
  preferenceValidations.getPreferenceByUserId,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  preferenceController.getMostRecent
);

router.get(
  "/all/:user_id",
  preferenceValidations.getPreferenceByUserId,
  pagination(), // Apply pagination here
  enhancedJWTAuth,
  preferenceController.listAll
);

router.post(
  "/:deviceId/charts",
  enhancedJWTAuth,
  preferenceValidations.createChart,
  preferenceController.createChart
);

router.put(
  "/:deviceId/charts/:chartId",
  enhancedJWTAuth,
  preferenceValidations.updateChart,
  preferenceController.updateChart
);

router.delete(
  "/:deviceId/charts/:chartId",
  enhancedJWTAuth,
  preferenceValidations.deleteChart,
  preferenceController.deleteChart
);

router.get(
  "/:deviceId/charts",
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  preferenceValidations.getChartConfigurations,
  preferenceController.getChartConfigurations
);

router.post(
  "/:deviceId/charts/:chartId/copy",
  enhancedJWTAuth,
  preferenceValidations.copyChart,
  preferenceController.copyChart
);

router.get(
  "/:deviceId/charts/:chartId",
  enhancedJWTAuth,
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
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getUserPersonalTheme
);

router.put(
  "/theme/user/:user_id",
  preferenceValidations.updateUserPersonalTheme,
  enhancedJWTAuth,
  preferenceController.updateUserPersonalTheme
);

// User theme within group context
router.get(
  "/theme/user/:user_id/group/:group_id",
  preferenceValidations.getUserGroupTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getUserGroupTheme
);

router.put(
  "/theme/user/:user_id/group/:group_id",
  preferenceValidations.updateUserGroupTheme,
  enhancedJWTAuth,
  preferenceController.updateUserGroupTheme
);

// User theme within group context (using default group when no group_id provided)
router.get(
  "/theme/user/:user_id/group",
  preferenceValidations.getUserDefaultGroupTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getUserDefaultGroupTheme
);

router.put(
  "/theme/user/:user_id/group",
  preferenceValidations.updateUserDefaultGroupTheme,
  enhancedJWTAuth,
  preferenceController.updateUserDefaultGroupTheme
);

// User theme within network context
router.get(
  "/theme/user/:user_id/network/:network_id",
  preferenceValidations.getUserNetworkTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getUserNetworkTheme
);

router.put(
  "/theme/user/:user_id/network/:network_id",
  preferenceValidations.updateUserNetworkTheme,
  enhancedJWTAuth,
  preferenceController.updateUserNetworkTheme
);

// User theme within network context (using default network when no network_id provided)
router.get(
  "/theme/user/:user_id/network",
  preferenceValidations.getUserDefaultNetworkTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getUserDefaultNetworkTheme
);

router.put(
  "/theme/user/:user_id/network",
  preferenceValidations.updateUserDefaultNetworkTheme,
  enhancedJWTAuth,
  preferenceController.updateUserDefaultNetworkTheme
);

// ===========================================
// ORGANIZATION THEME ROUTES
// ===========================================

// Group organization themes
router.get(
  "/theme/organization/group/:group_id",
  preferenceValidations.getGroupTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getGroupTheme
);

router.put(
  "/theme/organization/group/:group_id",
  preferenceValidations.updateGroupTheme,
  enhancedJWTAuth,
  preferenceController.updateGroupTheme
);

// Network organization themes
router.get(
  "/theme/organization/network/:network_id",
  preferenceValidations.getNetworkTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getNetworkTheme
);

router.put(
  "/theme/organization/network/:network_id",
  preferenceValidations.updateNetworkTheme,
  enhancedJWTAuth,
  preferenceController.updateNetworkTheme
);

// ===========================================
// EFFECTIVE THEME ROUTE (THEME RESOLUTION)
// ===========================================

// Get effective theme based on context and hierarchy
router.get(
  "/theme/effective/:user_id",
  preferenceValidations.getEffectiveTheme,
  // No pagination for single item retrieval
  enhancedJWTAuth,
  preferenceController.getEffectiveTheme
);

router.get(
  "/:user_id",
  preferenceValidations.getPreferenceByUserId,
  pagination(), // Apply pagination here as it calls list
  enhancedJWTAuth,
  preferenceController.list
);

module.exports = router;
