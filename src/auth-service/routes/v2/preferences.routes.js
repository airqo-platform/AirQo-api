// preferences.routes.js
const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/preference.controller");
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
  createPreferenceController.upsert
);

router.patch(
  "/replace",
  preferenceValidations.replace,
  createPreferenceController.replace
);

router.put(
  "/:user_id",
  preferenceValidations.update,
  createPreferenceController.update
);

router.post(
  "/",
  preferenceValidations.create,
  createPreferenceController.create
);

router.get("/", preferenceValidations.list, createPreferenceController.list);

router.delete(
  "/:user_id",
  preferenceValidations.deletePreference,
  authenticateJWT,
  createPreferenceController.delete
);

router.get(
  "/selected-sites",
  preferenceValidations.getSelectedSites,
  createPreferenceController.listSelectedSites
);

router.post(
  "/selected-sites",
  preferenceValidations.addSelectedSites,
  authenticateJWT,
  createPreferenceController.addSelectedSites
);

router.put(
  "/selected-sites/:site_id",
  preferenceValidations.updateSelectedSite,
  authenticateJWT,
  createPreferenceController.updateSelectedSite
);

router.delete(
  "/selected-sites/:site_id",
  preferenceValidations.deleteSelectedSite,
  authenticateJWT,
  createPreferenceController.deleteSelectedSite
);

router.get(
  "/recent/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  createPreferenceController.getMostRecent
);

router.get(
  "/all/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  createPreferenceController.listAll
);

router.post(
  "/:deviceId/charts",
  authenticateJWT,
  preferenceValidations.createChart, // Add new validation
  createPreferenceController.createChart
);

router.put(
  "/:deviceId/charts/:chartId",
  authenticateJWT,
  preferenceValidations.updateChart, // Add new validation
  createPreferenceController.updateChart
);

router.delete(
  "/:deviceId/charts/:chartId",
  authenticateJWT,
  preferenceValidations.deleteChart, // Add new validation
  createPreferenceController.deleteChart
);

router.get(
  "/:deviceId/charts",
  authenticateJWT,
  preferenceValidations.getChartConfigurations, // Add new validation
  createPreferenceController.getChartConfigurations
);

router.get(
  "/:deviceId/export",
  authenticateJWT,
  preferenceValidations.exportData, // Add new validation
  createPreferenceController.exportData
);

router.get(
  "/:user_id",
  preferenceValidations.getPreferenceByUserId,
  authenticateJWT,
  createPreferenceController.list
);

module.exports = router;
