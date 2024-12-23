const express = require("express");
const router = express.Router();
const { check, oneOf, query, body, param } = require("express-validator");
const createAnalyticsController = require("@controllers/create-analytics");
const validateTenant = require("@middleware/validateTenant");

// trigger year-end emails
router.post(
  "/send",
  validateTenant(),
  body("emails")
    .exists()
    .withMessage("the emails array field must be provided in the request body")
    .bail()
    .isArray()
    .withMessage("emails must be provided as an array")
    .bail(),
  createAnalyticsController.send
);

module.exports = router;
