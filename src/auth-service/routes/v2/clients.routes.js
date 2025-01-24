// clients.routes.js
const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/client.controller");
const clientValidations = require("@validators/clients.validators");
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
router.use(clientValidations.pagination);

router.get(
  "/",
  clientValidations.list,
  setJWTAuth,
  authJWT,
  createClientController.list
);

router.post(
  "/",
  clientValidations.create,
  setJWTAuth,
  authJWT,
  createClientController.create
);

router.patch(
  "/:client_id/secret",
  clientValidations.updateClientSecret,
  setJWTAuth,
  authJWT,
  createClientController.updateClientSecret
);

router.put(
  "/:client_id",
  clientValidations.update,
  setJWTAuth,
  authJWT,
  createClientController.update
);

router.post(
  "/activate/:client_id",
  clientValidations.activateClient,
  setJWTAuth,
  authJWT,
  createClientController.activateClient
);

router.get(
  "/activate-request/:client_id",
  clientValidations.activateClientRequest,
  setJWTAuth,
  authJWT,
  createClientController.activateClientRequest
);

router.delete(
  "/:client_id",
  clientValidations.deleteClient,
  setJWTAuth,
  authJWT,
  createClientController.delete
);

router.get(
  "/:client_id",
  clientValidations.getClientById,
  setJWTAuth,
  authJWT,
  createClientController.list
);

module.exports = router;
