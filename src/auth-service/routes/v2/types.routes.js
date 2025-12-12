// types.routes.js
const express = require("express");
const router = express.Router();
const createUserTypeController = require("@controllers/user-type.controller");
const typeValidations = require("@validators/types.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global

router.get(
  "/:user_type/users",
  typeValidations.listUsersWithUserType,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createUserTypeController.listUsersWithUserType
);

router.get(
  "/:user_type/available_users",
  typeValidations.listAvailableUsersForUserType,
  enhancedJWTAuth,
  pagination(), // Apply pagination here
  createUserTypeController.listAvailableUsersForUserType
);

router.post(
  "/:user_type/users",
  typeValidations.assignManyUsersToUserType,
  enhancedJWTAuth,
  createUserTypeController.assignManyUsersToUserType
);

router.post(
  "/:user_type/user",
  typeValidations.assignUserType,
  enhancedJWTAuth,
  createUserTypeController.assignUserType
);

router.put(
  "/:user_type/user/:user_id",
  typeValidations.assignUserTypePut,
  enhancedJWTAuth,
  createUserTypeController.assignUserType
);

module.exports = router;
