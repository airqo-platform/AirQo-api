// src/auth-service/routes/v2/migration.routes.js
const express = require("express");
const router = express.Router();
const migrationController = require("@controllers/migration.controller");
const { setJWTAuth, authJWT } = require("@middleware/passport"); // Adjust to your auth middleware

// Apply authentication middleware (adjust as needed for your app)
router.use(setJWTAuth);
router.use(authJWT);

// GET endpoints (safe to run anytime)
router.get(
  "/audit-deprecated-fields",
  migrationController.auditDeprecatedFields
);
router.get("/migration-status", migrationController.getMigrationStatus);
router.get("/migration-plan", migrationController.getMigrationPlan);

// POST endpoint (requires confirmation and likely admin privileges)
router.post(
  "/migrate-deprecated-fields",
  migrationController.migrateDeprecatedFields
);

module.exports = router;
