const express = require("express");
const router = express.Router();
const createPermissionController = require("@controllers/create-permission");
const { check, oneOf, query, body, param } = require("express-validator");

const { setJWTAuth, authJWT } = require("@middleware/passport");

const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
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
  createPermissionController.list
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
      body("permission")
        .exists()
        .withMessage("permission is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the permission must not be empty")
        .bail()
        .trim()
        .escape()
        .customSanitizer((value) => {
          const sanitizedValue = value.replace(/[^a-zA-Z]/g, " ");
          const processedValue = sanitizedValue
            .toUpperCase()
            .replace(/ /g, "_");

          return processedValue;
        }),
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
        .exists()
        .withMessage("description is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the description must not be empty")
        .trim(),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createPermissionController.create
);

router.put(
  "/:permission_id",
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
      param("permission_id")
        .exists()
        .withMessage("the permission_id param is missing in the request")
        .bail()
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("permission")
        .not()
        .exists()
        .withMessage("permission should not exist in the request body"),
      body("network_id")
        .optional()
        .notEmpty()
        .withMessage("network_id should not be empty if provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("network_id must be an object ID")
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
  createPermissionController.update
);

router.delete(
  "/:permission_id",
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
  createPermissionController.delete
);

router.get(
  "/:permission_id",
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
  createPermissionController.list
);

module.exports = router;
