const express = require("express");
const router = express.Router();
const forecastController = require("@controllers/create-forecast");
const forecastValidations = require("@validators/forecast.validators");
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

/******************* forecasts use-case ***************/
router.post("/", oneOf(forecastValidations.create), forecastController.create);
router.get(
  "/devices/:deviceId",
  oneOf(forecastValidations.listByDevice),
  forecastController.listByDevice
);
router.get(
  "/sites/:siteId",
  oneOf(forecastValidations.listBySite),
  forecastController.listBySite
);

module.exports = router;
