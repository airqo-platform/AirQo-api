const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/user.controller");
const { check, oneOf, query, body, param } = require("express-validator");

const { enhancedJWTAuth } = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(pagination());

module.exports = router;
