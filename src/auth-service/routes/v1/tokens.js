const express = require("express");
const router = express.Router();
const createUserController = require("@controllers/create-user");
const requestAccessController = require("@controllers/request-access");
const createInquiryController = require("@controllers/create-inquiry");
const createDefaultController = require("@controllers/create-default");
const createNetworkController = require("@controllers/create-network");
const createRoleController = require("@controllers/create-role");
const createPermissionController = require("@controllers/create-permission");
const { check, oneOf, query, body, param } = require("express-validator");

const {
  setJWTAuth,
  authJWT,
  setLocalAuth,
  authLocal,
  authToken,
  setAuthToken,
} = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);

module.exports = router;
