const express = require("express");
const router = express.Router();
const createScopeController = require("@controllers/create-scope");
const { check, oneOf, query, body, param } = require("express-validator");
const { setJWTAuth, authJWT } = require("@middleware/passport");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validatePagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

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
router.use(validatePagination);

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
  createScopeController.list
);

router.post(
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
    [
      body("scope")
        .exists()
        .withMessage("scope is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the scope must not be empty")
        .bail()
        .trim()
        .escape()
        .customSanitizer((value) => {
          return value.replace(/ /g, "_").toUpperCase();
        }),
      body("network_id")
        .exists()
        .withMessage("network_id should be provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("description")
        .exists()
        .withMessage("description is missing in your request")
        .bail()
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createScopeController.create
);

router.put(
  "/:scope_id",
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ errors: "request body is empty" });
    }
    next();
  },
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
      param("scope_id")
        .exists()
        .withMessage("the scope_id param is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("scope")
        .not()
        .exists()
        .withMessage("scope should not exist in the request body"),
      body("network_id")
        .optional()
        .notEmpty()
        .withMessage("network_id should not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("description")
        .optional()
        .notEmpty()
        .withMessage("description should not be empty if provided")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createScopeController.update
);

router.delete(
  "/:scope_id",
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
      param("scope_id")
        .exists()
        .withMessage("the scope_id param is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createScopeController.delete
);

router.get(
  "/:scope_id",
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
      param("scope_id")
        .exists()
        .withMessage("the scope_id param is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createScopeController.list
);

module.exports = router;
