const express = require("express");
const router = express.Router();
const requestAccessController = require("@controllers/request-access");
const { check, oneOf, query, body, param } = require("express-validator");

const { setJWTAuth, authJWT } = require("@middleware/passport");
const constants = require("@config/constants");

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

router.post(
  "/register",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email should be provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("firstName")
        .exists()
        .withMessage("the firstName should be provided")
        .trim(),
      body("lastName")
        .exists()
        .withMessage("the lastName should be provided")
        .trim(),
      body("category")
        .exists()
        .withMessage("the category should be provided")
        .trim(),
      body("website")
        .exists()
        .withMessage("the website should be provided")
        .trim(),
      body("description")
        .exists()
        .withMessage("the description should be provided")
        .trim(),
      body("long_organization")
        .exists()
        .withMessage("the long_organization should be provided")
        .trim(),
      body("jobTitle")
        .exists()
        .withMessage("the jobTitle should be provided")
        .trim(),
    ],
  ]),
  requestAccessController.create
);
router.get(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  requestAccessController.list
);
router.post(
  "/confirm",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  requestAccessController.confirm
);
router.delete(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  setJWTAuth,
  authJWT,
  requestAccessController.delete
);
router.put(
  "/",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the candidate identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("status")
        .if(body("status").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pending", "rejected"])
        .withMessage(
          "the status value is not among the expected ones which include: rejected and pending"
        ),
    ],
  ]),
  setJWTAuth,
  authJWT,
  requestAccessController.update
);

module.exports = router;
