const express = require("express");
const router = express.Router();
const logController = require("@controllers/log.controller");
const logValidator = require("@validators/log.validators");
const { headers, pagination, validate } = require("@validators/common");

router.use(headers);

// GET / - List all logs with optional filters
router.get("/", pagination(), logValidator.list, validate, logController.list);

module.exports = router;
