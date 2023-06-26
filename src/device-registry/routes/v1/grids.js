const express = require("express");
const router = express.Router();
const createGridController = require("@controllers/create-grid");
const { check, oneOf, query, body, param } = require("express-validator");
const constants = require("@config/constants");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const { logElement, logText, logObject } = require("@utils/log");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- geogroups-route-v1`
);
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { getModelByTenant } = require("@config/database");

const NetworkSchema = require("@models/Network");
const AdminLevelSchema = require("@models/AdminLevel");

const NetworkModel = (tenant) => {
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
    const grids = getModelByTenant(tenant, "grid", NetworkSchema);
    return grids;
  }
};

const AdminLevelModel = (tenant) => {
  try {
    const adminlevels = mongoose.model("adminlevels");
    return adminlevels;
  } catch (error) {
    const adminlevels = getModelByTenant(
      tenant,
      "adminlevel",
      AdminLevelSchema
    );
    return adminlevels;
  }
};

const validAdminLevels = async () => {
  await AdminLevelModel("airqo").distinct("name");
};
const validNetworks = async () => {
  await NetworkModel("airqo").distinct("name");
};

const initialIsCapital = function(word) {
  try {
    return word[0] !== word[0].toLowerCase();
  } catch (error) {
    logger.error(
      `internal server error -- hasNoWhiteSpace -- ${error.message}`
    );
  }
};
const hasNoWhiteSpace = function(word) {
  try {
    const hasWhiteSpace = word.indexOf(" ") >= 0;
    return !hasWhiteSpace;
  } catch (e) {
    logger.error(`internal server error -- hasNoWhiteSpace -- ${e.message}`);
  }
};

const validatePagination = (req, res, next) => {
  // Retrieve the limit and skip values from the query parameters
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);

  // Validate and sanitize the limit value
  req.query.limit = isNaN(limit) || limit < 1 ? 1000 : limit;

  // Validate and sanitize the skip value
  req.query.skip = isNaN(skip) || skip < 0 ? 0 : skip;

  next();
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

/************************ grids ********************/
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
        .isIn(validNetworks())
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
        .isIn(validAdminLevels())
        // .isIn([
        //   "village",
        //   "district",
        //   "parish",
        //   "division",
        //   "county",
        //   "subcounty",
        //   "country",
        //   "state",
        //   "province",
        //   "region",
        //   "municipality",
        //   "city",
        //   "town",
        //   "ward",
        //   "neighborhood",
        //   "community",
        //   "census tract",
        //   "block",
        //   "postal code",
        //   "zip code",
        // ])
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
  createGridController.register
);
router.post(
  "/upload-shapefile",
  upload.single("shapefile"),
  createGridController.createGridFromShapefile
);
router.post(
  "/nearby",
  oneOf([
    [
      body("latitude")
        .trim()
        .exists()
        .withMessage("the latitude is missing")
        .notEmpty()
        .withMessage("the latitude should not be empty"),
      body("longitude")
        .trim()
        .exists()
        .withMessage("the longitude is missing")
        .notEmpty()
        .withMessage("the longitude should not be empty"),
    ],
  ]),
  createGridController.findGridUsingGPSCoordinates
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
      .isIn(validNetworks())
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
        .isIn(validAdminLevels())
        .withMessage(
          "admin_level values include: province, state, village, county, subcounty, village, parish, country, division and district"
        ),
    ],
  ]),
  createGridController.list
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
      .isIn(validNetworks())
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
          return initialIsCapital(value);
        })
        .withMessage("the name should start with a capital letter")
        .bail()
        .custom((value) => {
          return hasNoWhiteSpace(value);
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
        .isIn(validAdminLevels())
        .withMessage(
          "admin_level values include:province, state, village, county, subcounty, village, parish, country, division and district"
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
  createGridController.update
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
      .isIn(validNetworks())
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
  createGridController.delete
);
/*** NEW approaches for paths */
router.get(
  "/:grid_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .optional()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGridController.list
);
router.delete(
  "/:grid_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .exists()
      .withMessage(
        "the record's identifier is missing in request, consider using the id"
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),

  createGridController.delete
);
router.put(
  "/:grid_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .exists()
      .withMessage("the grid_ids is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("net_email")
        .optional()
        .notEmpty()
        .withMessage("the email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("net_website")
        .optional()
        .notEmpty()
        .withMessage("the net_website should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("the net_website is not a valid URL")
        .trim(),
      body("net_status")
        .optional()
        .notEmpty()
        .withMessage("the net_status should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the net_status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("net_phoneNumber")
        .optional()
        .notEmpty()
        .withMessage("the phoneNumber should not be empty if provided")
        .bail()
        .isMobilePhone()
        .withMessage("the phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("net_category")
        .optional()
        .notEmpty()
        .withMessage("the net_category should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn([
          "business",
          "research",
          "policy",
          "awareness",
          "school",
          "others",
        ])
        .withMessage(
          "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
        )
        .trim(),
      body("net_name")
        .if(body("net_name").exists())
        .notEmpty()
        .withMessage("the net_name should not be empty")
        .trim(),
      body("net_sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the net_sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the net_sites should not be empty"),
      body("net_sites.*")
        .optional()
        .isMongoId()
        .withMessage("each use should be an object ID"),
    ],
  ]),

  createGridController.update
);
router.patch(
  "/:grid_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .exists()
      .withMessage("the grid_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  oneOf([
    [
      body("net_email")
        .optional()
        .notEmpty()
        .withMessage("the email should not be empty if provided")
        .bail()
        .isEmail()
        .withMessage("this is not a valid email address")
        .trim(),
      body("net_website")
        .optional()
        .notEmpty()
        .withMessage("the net_website should not be empty if provided")
        .bail()
        .isURL()
        .withMessage("the net_website is not a valid URL")
        .trim(),
      body("net_status")
        .optional()
        .notEmpty()
        .withMessage("the net_status should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn(["active", "inactive", "pending"])
        .withMessage(
          "the net_status value is not among the expected ones which include: active, inactive, pending"
        )
        .trim(),
      body("net_phoneNumber")
        .optional()
        .notEmpty()
        .withMessage("the phoneNumber should not be empty if provided")
        .bail()
        .isMobilePhone()
        .withMessage("the phoneNumber is not a valid one")
        .bail()
        .trim(),
      body("net_category")
        .optional()
        .notEmpty()
        .withMessage("the net_category should not be empty if provided")
        .bail()
        .toLowerCase()
        .isIn([
          "business",
          "research",
          "policy",
          "awareness",
          "school",
          "others",
        ])
        .withMessage(
          "the status value is not among the expected ones which include: business, research, policy, awareness, school, others"
        )
        .trim(),
      body("net_name")
        .if(body("net_name").exists())
        .notEmpty()
        .withMessage("the net_name should not be empty")
        .trim(),
      body("net_sites")
        .optional()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the net_sites should be an array")
        .bail()
        .notEmpty()
        .withMessage("the net_sites should not be empty"),
      body("net_sites.*")
        .optional()
        .isMongoId()
        .withMessage("each use should be an object ID"),
    ],
  ]),

  createGridController.refresh
);
/************************ managing grids ********************/
router.put(
  "/:grid_id/assign-site/:site_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("site_id")
        .exists()
        .withMessage("the site ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the site ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),

  createGridController.assignOneSiteToGrid
);
router.get(
  "/:grid_id/assigned-sites",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .optional()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGridController.listAssignedSites
);
router.get(
  "/:grid_id/available-sites",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    param("grid_id")
      .optional()
      .isMongoId()
      .withMessage("grid_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ]),
  createGridController.listAvailableSites
);
router.post(
  "/:grid_id/assign-sites",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid ID param is missing in the request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("site_ids")
        .exists()
        .withMessage("the site_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the site_ids should not be empty"),
      body("site_ids.*")
        .isMongoId()
        .withMessage("site_id provided must be an object ID"),
    ],
  ]),

  createGridController.assignManySitesToGrid
);
router.delete(
  "/:grid_id/unassign-many-sites",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      body("site_ids")
        .exists()
        .withMessage("the site_ids should be provided")
        .bail()
        .custom((value) => {
          return Array.isArray(value);
        })
        .withMessage("the site_ids should be an array")
        .bail()
        .notEmpty()
        .withMessage("the site_ids should not be empty"),
      body("site_ids.*")
        .isMongoId()
        .withMessage("site_id provided must be an object ID"),
    ],
  ]),

  createGridController.unAssignManySitesFromGrid
);
router.delete(
  "/:grid_id/unassign-site/:site_id",
  oneOf([
    [
      query("tenant")
        .optional()
        .notEmpty()
        .withMessage("tenant cannot be empty if provided")
        .bail()
        .trim()
        .toLowerCase()
        .isIn(["kcca", "airqo"])
        .withMessage("the tenant value is not among the expected ones"),
    ],
  ]),
  oneOf([
    [
      param("grid_id")
        .exists()
        .withMessage("the grid ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("the grid ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
      param("site_id")
        .exists()
        .withMessage("the site ID is missing in request")
        .bail()
        .trim()
        .isMongoId()
        .withMessage("site ID must be an object ID")
        .bail()
        .customSanitizer((value) => {
          return ObjectId(value);
        }),
    ],
  ]),

  createGridController.unAssignOneSiteFromGrid
);

/************************ admin levels ********************/
router.post("/levels", createGridController.createAdminLevel);
router.put("/levels", createGridController.updateAdminLevel);
router.delete("/levels", createGridController.deleteAdminLevel);
router.get("/levels", createGridController.listAdminLevels);

module.exports = router;
