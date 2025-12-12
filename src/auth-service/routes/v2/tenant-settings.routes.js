const express = require("express");
const router = express.Router();
const tenantSettingsController = require("@controllers/tenant-settings.controller");
const tenantSettingsValidations = require("@validators/tenant-settings.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.get(
  "/",
  tenantSettingsValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  tenantSettingsController.list
);

router.post(
  "/",
  tenantSettingsValidations.create,
  enhancedJWTAuth,
  tenantSettingsController.create
);

router.put(
  "/:id",
  tenantSettingsValidations.update,
  enhancedJWTAuth,
  tenantSettingsController.update
);

router.delete(
  "/:id",
  tenantSettingsValidations.delete,
  enhancedJWTAuth,
  tenantSettingsController.delete
);

router.get(
  "/:id",
  tenantSettingsValidations.listInformation,
  pagination(), // Apply pagination here as it calls list
  enhancedJWTAuth,
  tenantSettingsController.list
);

module.exports = router;
