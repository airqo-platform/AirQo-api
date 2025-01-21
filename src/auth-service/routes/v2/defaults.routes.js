// defaults.routes.js
const express = require("express");
const router = express.Router();
const createDefaultController = require("@controllers/default.controller");
const defaultValidations = require("@validators/defaults.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

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
router.use(defaultValidations.pagination);

router.put("/", defaultValidations.update, createDefaultController.update);

router.post("/", defaultValidations.create, createDefaultController.create);

router.get("/", defaultValidations.list, createDefaultController.list);

router.delete(
  "/",
  defaultValidations.deleteDefault,
  setJWTAuth,
  authJWT,
  createDefaultController.delete
);

module.exports = router;
