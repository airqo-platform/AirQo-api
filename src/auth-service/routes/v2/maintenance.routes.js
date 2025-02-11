// maintenance.routes.js
const express = require("express");
const router = express.Router();
const createMaintenanceController = require("@controllers/maintenance.controller");
const maintenanceValidations = require("@validators/maintenance.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

const headers = (req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH");
  next();
};

router.use(headers);
router.use(maintenanceValidations.pagination);
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
    setJWTAuth,
    authJWT,
    createMaintenanceController.create
  );

  router.put(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.update,
    setJWTAuth,
    authJWT,
    createMaintenanceController.update
  );

  router.get(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.list,
    createMaintenanceController.list
  );

  router.delete(
    `/${product}`,
    setProductQueryParam(product),
    maintenanceValidations.deleteMaintenance,
    setJWTAuth,
    authJWT,
    createMaintenanceController.delete
  );
});

module.exports = router;
