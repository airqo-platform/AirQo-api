const express = require("express");
const router = express.Router();
const logController = require("@controllers/log.controller");
const logValidator = require("@validators/log.validators");
const { validate } = require("@validators/common");

// Middleware for all routes in this file
router.use((req, res, next) => {
  // You can add any middleware specific to activities here
  next();
});

// GET / - List all activities with optional filters
router.get("/", logValidator.list, validate, logController.list);

module.exports = router;
