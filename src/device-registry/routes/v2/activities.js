const express = require("express");
const router = express.Router();
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const activityController = require("@controllers/create-activity");
const { check, oneOf, query, body, param } = require("express-validator");
const { getModelByTenant } = require("@config/database");

const NetworkSchema = require("@models/Network");
const NetworkModel = (tenant) => {
  try {
    const networks = mongoose.model("networks");
    return networks;
  } catch (error) {
    const networks = getModelByTenant(tenant, "network", NetworkSchema);
    return networks;
  }
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

logObject("validateNetwork", validateNetwork);

const headers = (req, res, next) => {
  // const allowedOrigins = constants.DOMAIN_WHITELIST;
  // const origin = req.headers.origin;
  // if (allowedOrigins.includes(origin)) {
  //   res.setHeader("Access-Control-Allow-Origin", origin);
  // }
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE");
  next();
};
router.use(headers);

/****************** create activities use-case *************************/
router.post(
  "/recall",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the provided deviceName cannot be empty")
        .trim(),
      body("recallType")
        .exists()
        .withMessage("recallType should be provided")
        .bail()
        .notEmpty()
        .withMessage("recallType should not be empty")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.RECALL_TYPES)
        .withMessage("the recallType value is not among the expected ones"),
      body("firstName")
        .optional()
        .notEmpty()
        .withMessage("firstName should not be empty if provided")
        .trim(),
      body("lastName")
        .optional()
        .notEmpty()
        .withMessage("lastName should not be empty if provided")
        .trim(),
      body("userName")
        .optional()
        .notEmpty()
        .withMessage("userName should not be empty if provided")
        .trim(),
      body("email")
        .optional()
        .notEmpty()
        .withMessage("email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
    ],
  ]),
  activityController.recall
);
router.post(
  "/deploy",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the provided deviceName cannot be empty")
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("powerType")
        .exists()
        .withMessage("the powerType is is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["solar", "mains", "alternator"])
        .withMessage(
          "the powerType value is not among the expected ones which include: solar, mains and alternator"
        ),
      body("mountType")
        .exists()
        .withMessage("the mountType is is missing in your request")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["pole", "wall", "faceboard", "rooftop", "suspended"])
        .withMessage(
          "the mountType value is not among the expected ones which include: pole, wall, faceboard, suspended and rooftop "
        ),
      body("height")
        .exists()
        .withMessage("the height is is missing in your request")
        .bail()
        .isFloat({ gt: 0, lt: 100 })
        .withMessage("the height must be a number between 0 and 100")
        .trim(),
      body("isPrimaryInLocation")
        .exists()
        .withMessage("the isPrimaryInLocation is is missing in your request")
        .bail()
        .isBoolean()
        .withMessage("isPrimaryInLocation must be Boolean")
        .trim(),
      body("site_id")
        .exists()
        .withMessage("site_id is missing")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site_id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("date")
        .exists()
        .withMessage("date is missing")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("date must be a valid datetime."),
      body("firstName")
        .optional()
        .notEmpty()
        .withMessage("firstName should not be empty if provided")
        .trim(),
      body("lastName")
        .optional()
        .notEmpty()
        .withMessage("lastName should not be empty if provided")
        .trim(),
      body("userName")
        .optional()
        .notEmpty()
        .withMessage("userName should not be empty if provided")
        .trim(),
      body("email")
        .optional()
        .notEmpty()
        .withMessage("email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
    ],
  ]),
  activityController.deploy
);
router.post(
  "/maintain",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("deviceName")
        .exists()
        .withMessage("the deviceName is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the provided deviceName cannot be empty")
        .trim(),
    ],
  ]),
  oneOf([
    [
      body("maintenanceType")
        .optional()
        .notEmpty()
        .withMessage("maintenanceType should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.MAINTENANCE_TYPES)
        .withMessage(
          "the maintenanceType value is not among the expected ones"
        ),
      body("description")
        .exists()
        .withMessage("the description is missing in your request")
        .trim(),
      body("tags")
        .exists()
        .withMessage("the tags are missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
      body("date")
        .exists()
        .withMessage("date is missing")
        .bail()
        .trim()
        .toDate()
        .isISO8601({ strict: true, strictSeparator: true })
        .withMessage("date must be a valid datetime."),
      body("firstName")
        .optional()
        .notEmpty()
        .withMessage("firstName should not be empty if provided")
        .trim(),
      body("lastName")
        .optional()
        .notEmpty()
        .withMessage("lastName should not be empty if provided")
        .trim(),
      body("userName")
        .optional()
        .notEmpty()
        .withMessage("userName should not be empty if provided")
        .trim(),
      body("email")
        .optional()
        .notEmpty()
        .withMessage("email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address"),
    ],
  ]),
  activityController.maintain
);
router.get(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      query("device")
        .optional()
        .notEmpty()
        .withMessage("device should not be empty IF provided")
        .bail()
        .trim(),
      query("id")
        .optional()
        .notEmpty()
        .withMessage("id should not be empty IF provided")
        .bail()
        .isMongoId()
        .withMessage("the id should be an Object String")
        .trim(),
      query("activity_type")
        .optional()
        .notEmpty()
        .withMessage("activity_type should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.ACTIVITY_TYPES)
        .withMessage(
          "the activity_type value is not among the expected ones which are: recallment, deployment and maintenance"
        ),
      query("activity_tags")
        .optional()
        .notEmpty()
        .withMessage("activity_tags should not be empty IF provided")
        .trim(),
      query("maintenance_type")
        .optional()
        .notEmpty()
        .withMessage("maintenance_type should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.MAINTENANCE_TYPES)
        .withMessage(
          "the maintenance_type value is not among the expected ones which are: corrective and preventive"
        ),
      query("recall_type")
        .optional()
        .notEmpty()
        .withMessage("recall_type should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.RECALL_TYPES)
        .withMessage(
          `the maintenance_type value is not among the expected ones which are: ${JSON.stringify(
            constants.RECALL_TYPES
          )}`
        ),
      query("site_id")
        .optional()
        .notEmpty()
        .withMessage("site_id should not be empty IF provided")
        .bail()
        .isMongoId()
        .withMessage("the site_id should be an Object String")
        .trim(),
      query("network")
        .optional()
        .notEmpty()
        .withMessage("network should not be empty IF provided")
        .bail()
        .trim()
        .toLowerCase()
        .custom(validateNetwork)
        .withMessage("the network value is not among the expected ones"),
      query("activity_codes")
        .optional()
        .notEmpty()
        .withMessage("activity_codes should not be empty IF provided")
        .bail()
        .trim(),
      query("id")
        .optional()
        .notEmpty()
        .withMessage("id should not be empty IF provided")
        .bail()
        .isMongoId()
        .withMessage("the id should be an Object String")
        .trim(),
    ],
  ]),
  activityController.list
);
router.put(
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
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the activity identifier is missing in request, consider using the activity id"
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
  activityController.update
);
router.put(
  "/bulk/",
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
    query("id")
      .exists()
      .withMessage(
        "the activity identifier is missing in request, consider using the activity id"
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
  activityController.bulkUpdate
);
router.post(
  "/bulk/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the activity identifier is missing in request, consider using the activity id"
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
  activityController.bulkAdd
);
router.delete(
  "/",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant should not be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    query("id")
      .exists()
      .withMessage(
        "the activity identifier is missing in request, consider using the activity id"
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
  activityController.delete
);

module.exports = router;
