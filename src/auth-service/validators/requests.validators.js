// requests.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty IF provided")
    .bail()
    .trim()
    .toLowerCase()
    .isIn(["kcca", "airqo", "airqount"])
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const requestAccessToGroup = [
  validateTenant,
  [
    param("grp_id")
      .exists()
      .withMessage("the grp_ids should be provided")
      .bail()
      .notEmpty()
      .withMessage("the grp_id cannot be empty")
      .bail()
      .isMongoId()
      .withMessage("the grp_id is not a valid Object")
      .trim(),
  ],
];

const requestAccessToGroupByEmail = [
  validateTenant,
  [
    param("grp_id")
      .exists()
      .withMessage("the grp_ids should be provided")
      .bail()
      .notEmpty()
      .withMessage("the grp_id cannot be empty")
      .bail()
      .isMongoId()
      .withMessage("the grp_id is not a valid Object")
      .trim(),
  ],
  [
    body("emails")
      .exists()
      .withMessage("the emails should be provided")
      .bail()
      .custom((value) => {
        return Array.isArray(value);
      })
      .withMessage("the emails should be an array")
      .bail()
      .notEmpty()
      .withMessage("the emails should not be empty"),
    body("emails.*")
      .notEmpty()
      .withMessage("the email cannot be empty")
      .bail()
      .isEmail()
      .withMessage("the email is not valid"),
  ],
];

const acceptInvitation = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email should be provided")
      .bail()
      .notEmpty()
      .withMessage("the email should not be empty")
      .bail()
      .isEmail()
      .withMessage("the email is not valid"),
    body("target_id")
      .exists()
      .withMessage("the target_id is missing in request")
      .bail()
      .trim()
      .isMongoId()
      .withMessage("target_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),

    body("firstName")
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("firstName must be between 1 and 50 characters"),
    body("lastName")
      .optional()
      .trim()
      .isLength({ min: 1, max: 50 })
      .withMessage("lastName must be between 1 and 50 characters"),
    body("password")
      .optional()
      .isLength({ min: 6 })
      .withMessage("password must be at least 6 characters")
      .matches(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@#?!$%^&*,.]{6,}$/)
      .withMessage(
        "password must contain at least one letter and one number, and only allowed special characters: @#?!$%^&*,."
      ),
  ],
];

const requestAccessToNetwork = [
  validateTenant,
  [
    param("net_id")
      .exists()
      .withMessage("the net_id should be provided")
      .bail()
      .notEmpty()
      .withMessage("the net_id cannot be empty")
      .bail()
      .isMongoId()
      .withMessage("the net_id is not a valid Object")
      .trim(),
  ],
];

const list = [validateTenant];

const listPending = [validateTenant];

const approveAccessRequest = [
  validateTenant,
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
];

const rejectAccessRequest = [
  validateTenant,
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
];

const listForGroup = [validateTenant];
const listForNetwork = [validateTenant];

const deleteRequest = [
  validateTenant,
  [
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
  ],
];

const updateRequest = [
  validateTenant,
  [
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
  ],
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
];

const listAccessRequestsForGroup = [
  validateTenant,
  [
    param("grp_id")
      .exists()
      .withMessage("the grp_id should be provided")
      .bail()
      .notEmpty()
      .withMessage("grp_id should not be empty")
      .bail()
      .isMongoId()
      .withMessage("the grp_id should be an object ID")
      .trim(),
  ],
];

const listAccessRequestsForNetwork = [
  validateTenant,
  [
    param("net_id")
      .exists()
      .withMessage("the net_id should be provided")
      .bail()
      .notEmpty()
      .withMessage("net_id should not be empty")
      .bail()
      .isMongoId()
      .withMessage("the net_id should be an object ID")
      .trim(),
  ],
];

const getRequestId = [
  validateTenant,
  [
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
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  requestAccessToGroup,
  requestAccessToGroupByEmail,
  acceptInvitation,
  requestAccessToNetwork,
  list,
  listPending,
  approveAccessRequest,
  rejectAccessRequest,
  listForGroup,
  listForNetwork,
  deleteRequest,
  updateRequest,
  listAccessRequestsForGroup,
  listAccessRequestsForNetwork,
  getRequestId,
};
