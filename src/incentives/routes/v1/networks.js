const express = require("express");
const router = express.Router();
const createNetworkController = require("@controllers/create-network");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const phoneUtil =
  require("google-libphonenumber").PhoneNumberUtil.getInstance();
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logObject } = require("@utils/log");
const NetworkModel = require("@models/Network");
const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const validNetworks = async () => {
  const networks = await NetworkModel("airqo").distinct("name");
  return networks.map((network) => network.toLowerCase());
};

const validateNetwork = async (value) => {
  const networks = await validNetworks();
  if (!networks.includes(value.toLowerCase())) {
    throw new Error("Invalid network");
  }
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
/************************ networks ******************************/
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("name")
        .exists()
        .withMessage("the name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name should not be empty")
        .trim(),
      body("description").optional().notEmpty().trim(),
    ],
  ]),
  createNetworkController.create
);
router.put("/:net_id", createNetworkController.update);
router.delete("/:net_id", createNetworkController.delete);
router.get("/", createNetworkController.list);
router.get("/:net_id", createNetworkController.list);

module.exports = router;
