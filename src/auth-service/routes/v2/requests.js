const express = require("express");
const router = express.Router();
const createRequestController = require("@controllers/create-request");
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

router.post(
  "/groups/:group_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("group_id")
        .exists()
        .withMessage("the group_ids should be provided")
        .bail()
        .notEmpty()
        .withMessage("the group_id cannot be empty")
        .bail()
        .isMongoId.withMessage("the group_id is not a valid Object")
        .trim(),
    ],
  ]),
  createRequestController.requestAccessToGroup
);
router.post(
  "/networks/:network_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("network_id")
        .exists()
        .withMessage("the network_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("the network_id cannot be empty")
        .bail()
        .isMongoId.withMessage("the network_id is not a valid Object")
        .trim(),
    ],
  ]),
  createRequestController.requestAccessToNetwork
);
router.get(
  "/pending",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  createRequestController.listPendingAccessRequests
);
router.post(
  "/:request_id/approve",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("request_id")
        .exists()
        .withMessage("the request_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("request_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the request_id should be an object ID")
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("status")
        .if(body("status").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pending", "rejected", "approved"])
        .withMessage(
          "the status value is not among the expected ones which include: rejected, approved and pending"
        ),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRequestController.approveAccessRequest
);
router.post(
  "/:request_id/reject",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("request_id")
        .exists()
        .withMessage("the request_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("request_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the request_id should be an object ID")
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("status")
        .if(body("status").exists())
        .notEmpty()
        .trim()
        .toLowerCase()
        .isIn(["pending", "rejected", "approved"])
        .withMessage(
          "the status value is not among the expected ones which include: rejected, approved and pending"
        ),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRequestController.rejectAccessRequest
);
router.get(
  "/groups/:group_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("group_id")
        .exists()
        .withMessage("the group_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("group_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the group_id should be an object ID")
        .trim(),
    ],
  ]),
  createRequestController.listAccessRequestsForGroups
);
router.get(
  "/networks/:network_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("network_id")
        .exists()
        .withMessage("the network_id should be provided")
        .bail()
        .notEmpty()
        .withMessage("network_id should not be empty")
        .bail()
        .isMongoId()
        .withMessage("the network_id should be an object ID")
        .trim(),
    ],
  ]),
  createRequestController.listAccessRequestsForNetwork
);
router.delete(
  "/:request_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("request_id")
      .exists()
      .withMessage(
        "the request identifier is missing in request, consider using the request_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("request_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  setJWTAuth,
  authJWT,
  createRequestController.delete
);
router.put(
  "/:request_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .trim()
        .toLowerCase()
        .bail()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("request_id")
      .exists()
      .withMessage(
        "the request identifier is missing in request, consider using the request_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("request_id must be an object ID")
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
        .isIn(["pending", "rejected", "approved"])
        .withMessage(
          "the status value is not among the expected ones which include: rejected, approved and pending"
        ),
    ],
  ]),
  setJWTAuth,
  authJWT,
  createRequestController.update
);

module.exports = router;
