// maintenance.routes.js
const express = require("express");
const router = express.Router();
const createMaintenanceController = require("@controllers/maintenance.controller");
const maintenanceValidations = require("@validators/maintenance.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");

router.use(headers); // Keep headers global
router.use(maintenanceValidations.setDefaultTenant);

const products = ["mobile", "website", "analytics"];

const setProductQueryParam = (product) => (req, res, next) => {
  req.query.product = product;
  next();
};

products.forEach((product) => {
  router.post(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.create,
    enhancedJWTAuth,
    createMaintenanceController.create
  );

  router.put(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.update,
    enhancedJWTAuth,
    createMaintenanceController.update
  );

  router.get(
    `/${product}`,
    setProductQueryParam(product),
    pagination(), // Apply pagination here
    maintenanceValidations.list,
    createMaintenanceController.list
  );

  router.delete(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.deleteMaintenance,
    enhancedJWTAuth,
    createMaintenanceController.delete
  );
});

module.exports = router;
