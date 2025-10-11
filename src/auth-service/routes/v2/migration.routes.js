// src/auth-service/routes/v2/migration.routes.js
const express = require("express");
const router = express.Router();
const migrationController = require("@controllers/migration.controller");
const migrationValidations = require("@validators/migration.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");
router.use(headers);

router.use(enhancedJWTAuth);

// GET endpoints (safe to run anytime)
router.get(
  "/audit-deprecated-fields",
  migrationValidations.auditDeprecatedFields,
  migrationController.auditDeprecatedFields
);

router.get(
  "/migration-status",
  migrationValidations.getMigrationStatus,
  migrationController.getMigrationStatus
);

router.get(
  "/migration-plan",
  migrationValidations.getMigrationPlan,
  migrationController.getMigrationPlan
);

// POST endpoint (requires confirmation and likely admin privileges)
router.post(
  "/migrate-deprecated-fields",
  migrationValidations.migrateDeprecatedFields,
  migrationController.migrateDeprecatedFields
);

module.exports = router;
