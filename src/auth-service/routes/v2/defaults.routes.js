// defaults.routes.js
const express = require("express");
const router = express.Router();
const createDefaultController = require("@controllers/default.controller");
const defaultValidations = require("@validators/defaults.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.put("/", defaultValidations.update, createDefaultController.update);

router.post("/", defaultValidations.create, createDefaultController.create);

router.get("/", defaultValidations.list, createDefaultController.list);

// No pagination for DELETE
router.delete(
  "/",
  defaultValidations.deleteDefault,
  enhancedJWTAuth,
  createDefaultController.delete
);

module.exports = router;
