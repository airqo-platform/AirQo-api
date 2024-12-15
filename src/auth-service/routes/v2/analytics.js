const express = require("express");
const router = express.Router();
const { check, oneOf, query, body, param } = require("express-validator");
const createAnalyticsController = require("@controllers/create-analytics");
const validateTenant = require("@middleware/validateTenant");

// Route to manually trigger year-end emails
router.post(
  "/send",
  validateTenant(),
  body("emails")
    .isArray()
    .withMessage("Emails must be provided as an array")
    .bail(),
  createAnalyticsController.send
);

// Route to schedule year-end emails (optional)
router.post("/schedule", validateTenant(), createAnalyticsController.schedule);

module.exports = router;
