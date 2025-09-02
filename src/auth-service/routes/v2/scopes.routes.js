// scopes.routes.js
const express = require("express");
const router = express.Router();
const createScopeController = require("@controllers/scope.controller");
const scopeValidations = require("@validators/scopes.validators");
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
router.use(scopeValidations.pagination);

router.get(
  "/",
  scopeValidations.list,
  enhancedJWTAuth,
  createScopeController.list
);

router.post(
  "/",
  scopeValidations.create,
  enhancedJWTAuth,
  createScopeController.create
);

router.put(
  "/:scope_id",
  scopeValidations.update,
  enhancedJWTAuth,
  createScopeController.update
);

router.delete(
  "/:scope_id",
  scopeValidations.deleteScope,
  enhancedJWTAuth,
  createScopeController.delete
);

router.get(
  "/:scope_id",
  scopeValidations.getById,
  enhancedJWTAuth,
  createScopeController.list
);

module.exports = router;
