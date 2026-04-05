// scopes.routes.js
const express = require("express");
const router = express.Router();
const createScopeController = require("@controllers/scope.controller");
const scopeValidations = require("@validators/scopes.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

// Bulk create scopes — before /:scope_id to avoid route collision
router.post(
  "/bulk",
  scopeValidations.list, // tenant validation
  enhancedJWTAuth,
  createScopeController.bulkCreate
);

// Initialize default subscription-tier scopes
router.post(
  "/initialize",
  scopeValidations.list, // tenant validation
  enhancedJWTAuth,
  createScopeController.initializeDefaults
);

router.get(
  "/",
  scopeValidations.list,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createScopeController.list
);

router.post(
  "/",
  scopeValidations.create,
  enhancedJWTAuth,
  createScopeController.create
);

router.put(
  "/:scope_id",
  scopeValidations.update,
  enhancedJWTAuth,
  createScopeController.update
);

router.delete(
  "/:scope_id",
  scopeValidations.deleteScope,
  enhancedJWTAuth,
  createScopeController.delete
);

router.get(
  "/:scope_id",
  scopeValidations.getById,
  pagination(), // Apply pagination here as it calls list
  enhancedJWTAuth,
  createScopeController.list
);

module.exports = router;
