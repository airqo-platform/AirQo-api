const express = require("express");
const router = express.Router();
const healthTipController = require("@controllers/health-tips.controller");
const healthTipValidations = require("@validators/tips.validators");
const { oneOf } = require("express-validator");

const validatePagination = (req, res, next) => {
  let limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  if (isNaN(limit) || limit < 1) {
    limit = 1000;
  }
  if (limit > 2000) {
    limit = 2000;
  }
  if (isNaN(skip) || skip < 0) {
    req.query.skip = 0;
  }
  req.query.limit = limit;

  next();
};

const headers = (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};

router.use(headers);
router.use(validatePagination);

/******************* create-health-tip use-case ***************/
router.get("/", oneOf(healthTipValidations.list), healthTipController.list);
router.post(
  "/",
  oneOf(healthTipValidations.create),
  healthTipController.create
);
router.put("/", oneOf(healthTipValidations.update), healthTipController.update);
router.delete(
  "/",
  oneOf(healthTipValidations.delete),
  healthTipController.delete
);

module.exports = router;
