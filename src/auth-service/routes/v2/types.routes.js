// types.routes.js
const express = require("express");
const router = express.Router();
const createUserTypeController = require("@controllers/user-type.controller");
const typeValidations = require("@validators/types.validators");
const { enhancedJWTAuth } = require("@middleware/passport");

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
router.use(typeValidations.pagination);

router.get(
  "/:user_type/users",
  typeValidations.listUsersWithUserType,
  enhancedJWTAuth,
  createUserTypeController.listUsersWithUserType
);

router.get(
  "/:user_type/available_users",
  typeValidations.listAvailableUsersForUserType,
  enhancedJWTAuth,
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
