// clients.routes.js
const express = require("express");
const router = express.Router();
const createClientController = require("@controllers/client.controller");
const clientValidations = require("@validators/clients.validators");
const { enhancedJWTAuth } = require("@middleware/passport");
const { validate, headers, pagination } = require("@validators/common");
const { HttpError } = require("@utils/shared");
const ClientModel = require("@models/Client");
const RBACService = require("@services/rbac.service");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

router.use(headers);

// Non-admins may only list their own clients.
// Admins (isSystemSuperAdmin) may list across all users via ?user_id=.
const scopeListToUser = async (req, res, next) => {
  try {
    const tenant = req.query.tenant || constants.DEFAULT_TENANT;
    const isAdmin = await RBACService.getInstance(tenant).isSystemSuperAdmin(req.user._id);
    if (!isAdmin) req.query.user_id = req.user._id.toString();
    next();
  } catch (error) {
    next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
  }
};

// Non-admins may only create clients for themselves.
// Silently overrides any body.user_id supplied by a non-admin.
const scopeCreateToUser = async (req, res, next) => {
  try {
    const tenant = req.query.tenant || constants.DEFAULT_TENANT;
    const isAdmin = await RBACService.getInstance(tenant).isSystemSuperAdmin(req.user._id);
    if (!isAdmin) req.body.user_id = req.user._id.toString();
    next();
  } catch (error) {
    next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
  }
};

// Non-admins may only operate on clients they own.
// Must run after enhancedJWTAuth (needs req.user) and after validation (needs req.params.client_id).
const requireClientOwnership = async (req, res, next) => {
  try {
    const { user } = req;
    const tenant = req.query.tenant || constants.DEFAULT_TENANT;
    const { client_id } = req.params;

    const isAdmin = await RBACService.getInstance(tenant).isSystemSuperAdmin(user._id);
    if (isAdmin) return next();

    if (!mongoose.isValidObjectId(client_id)) {
      return next(new HttpError("Bad Request", httpStatus.BAD_REQUEST, { message: "Invalid client_id" }));
    }

    const client = await ClientModel(tenant.toLowerCase()).findById(client_id).lean();

    if (!client) {
      return next(new HttpError("Not Found", httpStatus.NOT_FOUND, { message: "Client not found" }));
    }

    if (!client.user_id || client.user_id.toString() !== user._id.toString()) {
      return next(new HttpError("Forbidden", httpStatus.FORBIDDEN, { message: "You do not have access to this client" }));
    }

    next();
  } catch (error) {
    next(new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, { message: error.message }));
  }
};

router.get(
  "/",
  clientValidations.list,
  enhancedJWTAuth,
  scopeListToUser,
  pagination(),
  createClientController.list
);

router.post(
  "/",
  clientValidations.create,
  enhancedJWTAuth,
  scopeCreateToUser,
  createClientController.create
);

router.patch(
  "/:client_id/secret",
  clientValidations.updateClientSecret,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.updateClientSecret
);

router.put(
  "/:client_id",
  clientValidations.update,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.update
);

router.post(
  "/activate/:client_id",
  clientValidations.activateClient,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.activateClient
);

router.get(
  "/activate-request/:client_id",
  clientValidations.activateClientRequest,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.activateClientRequest
);

router.delete(
  "/:client_id",
  clientValidations.deleteClient,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.delete
);

router.get(
  "/:client_id",
  clientValidations.getClientById,
  enhancedJWTAuth,
  requireClientOwnership,
  createClientController.getById
);

module.exports = router;
