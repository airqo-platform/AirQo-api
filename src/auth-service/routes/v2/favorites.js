const express = require("express");
const router = express.Router();
const createFavoriteController = require("@controllers/create-favorite");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");

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
  createFavoriteController.list
);

router.get(
  "/users/:user_id",
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
      param("user_id")
        .exists()
        .withMessage(
          "the user_id param is missing in request path, consider using user_id"
        )
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createFavoriteController.list
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
      body("name")
        .exists()
        .withMessage("name is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the name must not be empty")
        .bail()
        .trim(),
      body("location")
        .exists()
        .withMessage("location is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the location must not be empty")
        .bail()
        .trim(),
      body("place_id")
        .exists()
        .withMessage("place_id is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the place_id must not be empty")
        .bail()
        .trim(),
      body("reference_site")
        .optional()
        .notEmpty()
        .withMessage("the reference_site should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("reference_site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("user_id")
        .exists()
        .withMessage("the user_id is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("latitude")
        .exists()
        .withMessage("the latitude is is missing in your request")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail(),
      // .custom((value) => {
      //   let dp = decimalPlaces(value);
      //   if (dp < 5) {
      //     return Promise.reject(
      //       "the latitude must have 5 or more characters"
      //     );
      //   }
      //   return Promise.resolve("latitude validation test has passed");
      // })
      // .bail()
      // .customSanitizer((value) => {
      //   return numeral(value).format("0.00000000000000");
      // })
      // .isDecimal({ decimal_digits: 14 })
      // .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .exists()
        .withMessage("the longitude is is missing in your request")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail(),
      // .custom((value) => {
      //   let dp = decimalPlaces(value);
      //   if (dp < 5) {
      //     return Promise.reject(
      //       "the longitude must have 5 or more characters"
      //     );
      //   }
      //   return Promise.resolve("longitude validation test has passed");
      // })
      // .bail()
      // .customSanitizer((value) => {
      //   return numeral(value).format("0.00000000000000");
      // })
      // .isDecimal({ decimal_digits: 14 })
      // .withMessage("the longitude must have atleast 5 decimal places in it"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createFavoriteController.create
);

router.put(
  "/:favorite_id",
  (req, res, next) => {
    if (!Object.keys(req.body).length) {
      return res.status(400).json({ errors: "request body is empty" });
    }
    next();
  },
  oneOf([
    param("favorite_id")
      .exists()
      .withMessage(
        "the favorite param is missing in request path, consider using favorite_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("favorite_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
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
      body("name")
        .optional()
        .notEmpty()
        .withMessage("name should not be empty IF provided")
        .bail()
        .notEmpty()
        .withMessage("the favorite must not be empty")
        .bail()
        .trim(),
      body("location")
        .optional()
        .notEmpty()
        .withMessage("location should not be empty IF provided")
        .bail()
        .notEmpty()
        .withMessage("the location must not be empty")
        .bail()
        .trim(),
      body("place_id")
        .optional()
        .notEmpty()
        .withMessage("place_id should not be empty IF provided")
        .bail()
        .notEmpty()
        .withMessage("the place_id must not be empty")
        .bail()
        .trim(),
      body("reference_site")
        .optional()
        .notEmpty()
        .withMessage("reference_site should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("reference_site must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("user_id")
        .optional()
        .notEmpty()
        .withMessage("the user_id should not be empty IF provided")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("user_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("latitude")
        .optional()
        .notEmpty()
        .withMessage("the latitude should not be empty IF provided")
        .bail()
        .matches(constants.LATITUDE_REGEX, "i")
        .withMessage("the latitude provided is not valid")
        .bail(),
      // .custom((value) => {
      //   let dp = decimalPlaces(value);
      //   if (dp < 5) {
      //     return Promise.reject(
      //       "the latitude must have 5 or more characters"
      //     );
      //   }
      //   return Promise.resolve("latitude validation test has passed");
      // })
      // .bail()
      // .customSanitizer((value) => {
      //   return numeral(value).format("0.00000000000000");
      // })
      // .isDecimal({ decimal_digits: 14 })
      // .withMessage("the latitude must have atleast 5 decimal places in it"),
      body("longitude")
        .optional()
        .notEmpty()
        .withMessage("the longitude should not be empty IF provided")
        .bail()
        .matches(constants.LONGITUDE_REGEX, "i")
        .withMessage("the longitude provided is not valid")
        .bail(),
      // .custom((value) => {
      //   let dp = decimalPlaces(value);
      //   if (dp < 5) {
      //     return Promise.reject(
      //       "the longitude must have 5 or more characters"
      //     );
      //   }
      //   return Promise.resolve("longitude validation test has passed");
      // })
      // .bail()
      // .customSanitizer((value) => {
      //   return numeral(value).format("0.00000000000000");
      // })
      // .isDecimal({ decimal_digits: 14 })
      // .withMessage("the longitude must have atleast 5 decimal places in it"),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createFavoriteController.update
);

router.delete(
  "/:favorite_id",
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
    param("favorite_id")
      .exists()
      .withMessage(
        "the favorite param is missing in request path, consider using favorite_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("favorite_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createFavoriteController.delete
);

router.get(
  "/:favorite_id",
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
      param("favorite_id")
        .exists()
        .withMessage(
          "the favorite param is missing in request path, consider using favorite_id"
        )
        .bail()
        .trim()
        .isMongoId()
        .withMessage("favorite_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createFavoriteController.list
);

module.exports = router;
