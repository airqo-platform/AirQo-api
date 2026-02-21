// inquiries.validators.js
const { query, body, param, oneOf } = require("express-validator");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const constants = require("@config/constants");

const validateTenant = oneOf([
  query("tenant")
    .optional()
    .notEmpty()
    .withMessage("tenant should not be empty if provided")
    .trim()
    .toLowerCase()
    .bail()
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
        "assistance",
      ])
      .withMessage(
        "the category value is not among the expected ones which are: general, data, feedback, monitors, partners,researchers,policy,champions,developers,assistance",
      ),
    body("message")
      .exists()
      .withMessage("the message should be provided")
      .bail()
      .trim(),
    body("fullName")
      .exists()
      .withMessage("the fullName should be provided")
      .bail()
      .trim(),
  ],
];

const list = [validateTenant];

const deleteInquiry = [
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
];

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
  deleteInquiry,
  update,
};
