// candidates.validators.js
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
    .isIn(constants.TENANTS)
    .withMessage("the tenant value is not among the expected ones"),
]);

const pagination = (req, res, next) => {
  const limit = parseInt(req.query.limit, 10);
  const skip = parseInt(req.query.skip, 10);
  req.query.limit = Number.isNaN(limit) || limit < 1 ? 100 : limit;
  req.query.skip = Number.isNaN(skip) || skip < 0 ? 0 : skip;
  next();
};

const create = [
  validateTenant,
  [
    body("email")
      .exists()
      .withMessage("the email should be provided")
      .bail()
      .notEmpty()
      .withMessage("the email cannot be empty")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    body("firstName")
      .exists()
      .withMessage("the firstName should be provided")
      .bail()
      .notEmpty()
      .withMessage("the firstName cannot be empty")
      .bail()
      .trim(),
    body("lastName")
      .exists()
      .withMessage("the lastName should be provided")
      .bail()
      .notEmpty()
      .withMessage("the lastName cannot be empty")
      .bail()
      .trim(),
    body("country")
      .exists()
      .withMessage("the country should be provided")
      .bail()
      .notEmpty()
      .withMessage("the country cannot be empty")
      .bail()
      .trim(),
    body("category")
      .exists()
      .withMessage("the category should be provided")
      .bail()
      .notEmpty()
      .withMessage("the category cannot be empty")
      .bail()
      .trim(),
    body("website")
      .exists()
      .withMessage("the website should be provided")
      .bail()
      .notEmpty()
      .withMessage("the website cannot be empty")
      .bail()
      .isURL()
      .withMessage("the website must be a valid URL")
      .trim(),
    body("description")
      .exists()
      .withMessage("the description should be provided")
      .bail()
      .notEmpty()
      .withMessage("the description cannot be empty")
      .bail()
      .trim(),
    body("long_organization")
      .exists()
      .withMessage("the long_organization should be provided")
      .bail()
      .notEmpty()
      .withMessage("long_organization cannot be empty")
      .bail()
      .trim(),
    body("jobTitle")
      .exists()
      .withMessage("the jobTitle should be provided")
      .bail()
      .notEmpty()
      .withMessage("jobTitle cannot be empty")
      .bail()
      .trim(),
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("the network_id cannot be empty if provided")
      .bail()
      .isMongoId()
      .withMessage("the network_id must be a MongoID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const list = [
  validateTenant,
  [
    query("network_id")
      .optional()
      .notEmpty()
      .withMessage("the network_id cannot be empty IF provided")
      .bail()
      .isMongoId()
      .withMessage("the network_id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("id")
      .optional()
      .notEmpty()
      .withMessage("the id cannot be empty IF provided")
      .bail()
      .isMongoId()
      .withMessage("the id must be an object ID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
    query("email")
      .optional()
      .notEmpty()
      .withMessage("the email cannot be empty IF provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
    query("email_address")
      .optional()
      .notEmpty()
      .withMessage("the email_address cannot be empty IF provided")
      .bail()
      .isEmail()
      .withMessage("this is not a valid email address")
      .trim(),
  ],
];

const confirm = [
  validateTenant,
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
    body("network_id")
      .optional()
      .notEmpty()
      .withMessage("the network_id cannot be empty if provided")
      .bail()
      .isMongoId()
      .withMessage("the network_id must be a MongoID")
      .bail()
      .customSanitizer((value) => {
        return ObjectId(value);
      }),
  ],
];

const deleteCandidate = [validateTenant];

const update = [
  validateTenant,
  [
    query("id")
      .exists()
      .withMessage(
        "the candidate identifier is missing in request, consider using the id",
      )
      .bail()
      .trim()
      .isMongoId()
      .withMessage("id must be an object ID")
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
      .isIn(["pending", "rejected"])
      .withMessage(
        "the status value is not among the expected ones which include: rejected and pending",
      ),
  ],
];

module.exports = {
  tenant: validateTenant,
  pagination,
  create,
  list,
  confirm,
  deleteCandidate,
  update,
};
