const express = require("express");
const router = express.Router();
const airqloudController = require("@controllers/create-airqloud");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const createAirQloudUtil = require("@utils/create-location");
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
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

/************************** airqlouds usecase  *******************/
router.post(
  "/",
  oneOf([
    [
      query("tenant")
        .exists()
        .withMessage("tenant should be provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(constants.NETWORKS)
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    body("location_id")
      .exists()
      .withMessage(
        "location details are missing in your request, consider using location_id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("location_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    [
      body("location")
        .exists()
        .withMessage(
          "location details are missing in your request, consider using location"
        )
        .bail()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .exists()
        .withMessage("location.coordinates is missing in your request")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .exists()
        .withMessage("location.type is is missing in your request")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
    ],
  ]),
  oneOf([
    [
      body("long_name")
        .exists()
        .withMessage("the long_name is is missing in your request")
        .bail()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("isCustom")
        .optional()
        .notEmpty()
        .withMessage("isCustom cannot be empty")
        .isBoolean()
        .withMessage("isCustom must be Boolean")
        .trim(),
      body("description")
        .optional()
        .notEmpty()
        .trim(),
      body("admin_level")
        .exists()
        .withMessage("admin_level is missing in your request")
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
      body("airqloud_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array")
        .bail()
        .notEmpty()
        .withMessage("the tags should not be empty"),
      body("sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .optional()
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
    ],
  ]),
  airqloudController.register
);

router.put(
  "/refresh",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
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
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using name"
      )
      .bail()
      .trim(),
  ]),
  airqloudController.refresh
);

router.get(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  airqloudController.list
);

router.get(
  "/summary",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  airqloudController.listSummary
);

router.get(
  "/dashboard",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
      .bail()
      .trim()
      .toLowerCase()
      .isIn(constants.NETWORKS)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    [
      query("id")
        .optional()
        .notEmpty()
        .trim()
        .isMongoId()
        .withMessage("id must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      query("name")
        .optional()
        .notEmpty()
        .withMessage("name cannot be empty")
        .trim(),
      query("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  airqloudController.listDashboard
);

router.get(
  "/sites",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
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
        "the airqloud identifier is missing in request, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using name"
      )
      .bail()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim(),
    query("admin_level")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request, consider using admin_level"
      )
      .trim()
      .bail()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
        "state",
        "province",
      ])
      .withMessage(
        "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
      ),
  ]),
  airqloudController.findSites
);

router.put(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
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
        "the airqloud identifier is missing in request, consider using id"
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
      body("name")
        .optional()
        .notEmpty()
        .withMessage("the name should not be empty")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return createAirQloudUtil.hasNoWhiteSpace(value);
        })
        .withMessage("the name should not have whitespace in it")
        .trim(),
      body("admin_level")
        .optional()
        .notEmpty()
        .withMessage(
          "admin_level is empty, should not be if provided in request"
        )
        .bail()
        .toLowerCase()
        .isIn([
          "village",
          "district",
          "parish",
          "division",
          "county",
          "subcounty",
          "country",
          "state",
          "province",
        ])
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
      body("description")
        .optional()
        .trim(),
      body("sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the sites should not be empty"),
      body("sites.*")
        .optional()
        .isMongoId()
        .withMessage("each site should be a mongo ID"),
      body("metadata")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the metadata should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the metadata should not be empty if provided"),
      body("long_name")
        .optional()
        .notEmpty()
        .withMessage("the long_name should not be empty")
        .trim(),
      body("isCustom")
        .optional()
        .isBoolean()
        .withMessage("isCustom must be a boolean value")
        .trim(),
      body("location")
        .optional()
        .custom((value) => {
          return typeof value === "object";
        })
        .withMessage("the location should be an object")
        .bail()
        .custom((value) => {
          return !isEmpty(value);
        })
        .withMessage("the location should not be empty when provided"),
      body("location.coordinates")
        .optional()
        .notEmpty()
        .withMessage("the location.coordinates should not be empty")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the location.coordinates should be an array"),
      body("location.type")
        .optional()
        .notEmpty()
        .withMessage("the location.type should not be empty")
        .bail()
        .isIn(["Polygon", "Point"])
        .withMessage(
          "the location.type value is not among the expected ones which include: Polygon and Point"
        ),
      body("airqloud_tags")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the tags should be an array"),
    ],
  ]),
  airqloudController.update
);

router.delete(
  "/",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
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
        "the airqloud identifier is missing in request, consider using id"
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
  airqloudController.delete
);

router.get(
  "/center",
  oneOf([
    query("tenant")
      .exists()
      .withMessage("tenant should be provided")
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
        "the airqloud identifier is missing in request query, consider using id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("name")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in your request query, consider using name"
      )
      .bail()
      .notEmpty()
      .withMessage("name cannot be empty")
      .trim(),
    body("coordinates")
      .exists()
      .withMessage(
        "a required field is missing in your request body, consider using coordinates"
      )
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage(
        "the coordinates should be an array or arrays, each containing a pair of coordinates"
      )
      .notEmpty()
      .withMessage("the coordinates cannot be empty"),
    query("admin_level")
      .exists()
      .withMessage(
        "the airqloud identifier is missing in request query, consider using admin_level"
      )
      .trim()
      .bail()
      .notEmpty()
      .withMessage("admin_level is empty, should not be if provided in request")
      .bail()
      .toLowerCase()
      .isIn([
        "village",
        "district",
        "parish",
        "division",
        "county",
        "subcounty",
        "country",
        "state",
        "province",
      ])
      .withMessage(
        "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
      ),
  ]),
  airqloudController.calculateGeographicalCenter
);

router.get(
  "/combined/:net_id/summary",
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
    param("net_id")
      .exists()
      .withMessage("the network ID param is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the network ID cannot be empty"),
  ]),
  airqloudController.listCohortsAndGridsSummary
);

router.get(
  "/combined/:net_id",
  oneOf([
    query("tenant")
      .optional()
      .notEmpty()
      .withMessage("tenant should not be empty IF provided")
      .bail()
      .trim()
      .toLowerCase()
      .custom(validateNetwork)
      .withMessage("the tenant value is not among the expected ones"),
  ]),
  oneOf([
    param("net_id")
      .trim()
      .exists()
      .withMessage("the network is is missing in your request")
      .bail()
      .notEmpty()
      .withMessage("the network should not be empty"),
  ]),
  airqloudController.listCohortsAndGrids
);

module.exports = router;
