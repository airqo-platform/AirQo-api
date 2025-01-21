// preferences.routes.js
const express = require("express");
const router = express.Router();
const createPreferenceController = require("@controllers/preference.controller");
const preferenceValidations = require("@validators/preferences.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(preferenceValidations.pagination);

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
  setJWTAuth,
  authJWT,
  createPreferenceController.delete
);

router.get(
  "/selected-sites",
  preferenceValidations.listSelectedSites,
  createPreferenceController.listSelectedSites
);

router.post(
  "/selected-sites",
  preferenceValidations.addSelectedSites,
  setJWTAuth,
  authJWT,
  createPreferenceController.addSelectedSites
);

router.put(
  "/selected-sites/:site_id",
  preferenceValidations.updateSelectedSite,
  setJWTAuth,
  authJWT,
  createPreferenceController.updateSelectedSite
);

router.delete(
  "/selected-sites/:site_id",
  preferenceValidations.deleteSelectedSite,
  setJWTAuth,
  authJWT,
  createPreferenceController.deleteSelectedSite
);

router.get(
  "/:user_id",
  preferenceValidations.getPreferenceByUserId,
  setJWTAuth,
  authJWT,
  createPreferenceController.list
);

module.exports = router;
