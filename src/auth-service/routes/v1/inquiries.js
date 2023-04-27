const express = require("express");
const router = express.Router();
const createInquiryController = require("@controllers/create-inquiry");
const { check, oneOf, query, body, param } = require("express-validator");

const { setJWTAuth, authJWT } = require("@middleware/passport");

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
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      body("email")
        .exists()
        .withMessage("the email should be provided")
        .bail()
        .trim()
        .isEmail()
        .withMessage("this is not a valid email address"),
      body("category")
        .exists()
        .withMessage("the category should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn([
          "general",
          "data",
          "feedback",
          "monitors",
          "partners",
          "researchers",
          "policy",
          "champions",
          "developers",
        ])
        .withMessage(
          "the category value is not among the expected ones which are: general, data, feedback, monitors, partners,researchers,policy,champions,developers"
        ),
      body("message")
        .exists()
        .withMessage("the message should be provided")
        .bail()
        .trim(),
      body("fullName")
        .optional()
        .notEmpty()
        .withMessage("the fullName should not be empty if provided")
        .bail()
        .trim(),
      body("firstName")
        .optional()
        .notEmpty()
        .withMessage("the firstName should not be empty if provided")
        .bail()
        .trim(),
      body("lastName")
        .optional()
        .notEmpty()
        .withMessage("the lastName should not be empty if provided")
        .bail()
        .trim(),
    ],
  ]),
  createInquiryController.create
);
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createInquiryController.list
);

router.delete(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
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
  setJWTAuth,
  authJWT,
  createInquiryController.delete
);
router.put(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
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
  createInquiryController.update
);

module.exports = router;
