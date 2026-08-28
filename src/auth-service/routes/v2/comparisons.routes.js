// comparisons.routes.js
const express = require("express");
const router = express.Router();
const createComparisonController = require("@controllers/comparison.controller");
const comparisonValidations = require("@validators/comparisons.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { headers } = require("@validators/common");

router.use(headers);

router.post(
  "/",
  comparisonValidations.create,
  enhancedJWTAuth,
  createComparisonController.create
);

router.get(
  "/",
  comparisonValidations.list,
  enhancedJWTAuth,
  createComparisonController.list
);

router.get(
  "/:comparison_id",
  comparisonValidations.getById,
  enhancedJWTAuth,
  createComparisonController.getById
);

router.patch(
  "/:comparison_id",
  comparisonValidations.update,
  enhancedJWTAuth,
  createComparisonController.update
);

router.delete(
  "/:comparison_id",
  comparisonValidations.deleteComparison,
  enhancedJWTAuth,
  createComparisonController.delete
);

module.exports = router;
