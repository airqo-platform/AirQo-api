const express = require("express");
const router = express.Router();
const tenantSettingsController = require("@controllers/tenant-settings.controller");
const tenantSettingsValidations = require("@validators/tenant-settings.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

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
router.use(tenantSettingsValidations.pagination);

router.get(
  "/",
  tenantSettingsValidations.list,
  enhancedJWTAuth,
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
  enhancedJWTAuth,
  tenantSettingsController.list
);

module.exports = router;
