const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/user.controller");
const { check, oneOf, query, body, param } = require("express-validator");

const { enhancedJWTAuth } = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const { validate, headers, pagination } = require("@validators/common");

router.use(headers);
router.use(validatePagination);

module.exports = router;
