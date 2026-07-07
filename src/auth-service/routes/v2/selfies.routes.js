const express = require("express");
const router = express.Router();
const selfieController = require("@controllers/selfie.controller");
const selfieValidations = require("@validators/selfie.validators");
const { enhancedJWTAuth, optionalJWTAuth } = require("@middleware/passport");
const { requirePermissions } = require("@middleware/permissionAuth");
const constants = require("@config/constants");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers);

router.post(
  "/",
  selfieValidations.create,
  optionalJWTAuth,
  validate,
  selfieController.create
);

router.get(
  "/",
  selfieValidations.list,
  pagination(),
  validate,
  selfieController.list
);

router.patch(
  "/:id",
  selfieValidations.hide,
  enhancedJWTAuth,
  requirePermissions([constants.SYSTEM_ADMIN]),
  validate,
  selfieController.hide
);

module.exports = router;
