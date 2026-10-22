// middleware/accessRequestAuth.js
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const AccessRequestModel = require("@models/AccessRequest");
const { requireGroupManagerAccess } = require("@middleware/groupNetworkAuth");
const { requireGroupAccess } = require("@middleware/adminAccess");
const RBACService = require("@services/rbac.service");

/**
 * Resolves :request_id to its underlying AccessRequest, then authorizes the
 * caller against the request's target group before allowing
 * approve/reject/cancel/update/delete.
 * @param {string} requestIdParam - Parameter name containing the access request ID
 * @returns {Function} Express middleware
 */
const requireAccessRequestManagerAccess = (requestIdParam = "request_id") => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;
      const requestId = req.params[requestIdParam];

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          })
        );
      }

      if (!requestId) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "request_id is required",
          })
        );
      }

      if (!mongoose.Types.ObjectId.isValid(requestId)) {
        return next(
          new HttpError("Bad Request", httpStatus.BAD_REQUEST, {
            message: "request_id is not a valid Object ID",
          })
        );
      }

      const accessRequest = await AccessRequestModel(tenant)
        .findById(requestId)
        .lean();

      if (!accessRequest) {
        return next(
          new HttpError("Not Found", httpStatus.NOT_FOUND, {
            message: "Access request does not exist",
          })
        );
      }

      req.accessRequest = accessRequest;

      if (accessRequest.requestType === "group") {
        req.params.grp_id = accessRequest.targetId.toString();
        return requireGroupManagerAccess("grp_id")(req, res, next);
      }

      return next(
        new HttpError("Not Implemented", httpStatus.NOT_IMPLEMENTED, {
          message: `Access requests of type "${accessRequest.requestType}" are not supported`,
        })
      );
    } catch (error) {
      return next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        })
      );
    }
  };
};

/**
 * For the cross-group listings (GET /requests, /requests/pending): AirQo
 * system super admins see every request; everyone else only sees requests
 * they made themselves. Previously any logged-in user could list every
 * group's requests, including requester emails.
 * Sets req.isSystemSuperAdmin for downstream handlers.
 * @returns {Function} Express middleware
 */
const scopeAccessRequestListToCaller = () => {
  return async (req, res, next) => {
    try {
      const user = req.user;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      if (!user || !user._id) {
        return next(
          new HttpError("Authentication required", httpStatus.UNAUTHORIZED, {
            message: "You must be logged in to access this resource",
          }),
        );
      }

      const isSystemSuperAdmin =
        await RBACService.getInstance(tenant).isSystemSuperAdmin(user._id);
      req.isSystemSuperAdmin = isSystemSuperAdmin;

      if (!isSystemSuperAdmin) {
        // Query params override body values in generateFilter.requests, so
        // this cannot be widened by the caller.
        req.query.user_id = user._id.toString();
      }
      return next();
    } catch (error) {
      return next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: error.message,
        }),
      );
    }
  };
};

/**
 * For per-group listings (GET /requests/groups/:grp_id, /requests/groups?grp_id=):
 * requires MEMBER_VIEW (or a manager/admin role) in that group, matching
 * the permission Nexus gates its member-requests page on. System super
 * admins always pass.
 * @returns {Function} Express middleware
 */
const requireGroupAccessRequestViewAccess = () =>
  requireGroupAccess([constants.MEMBER_VIEW]);

module.exports = {
  requireAccessRequestManagerAccess,
  scopeAccessRequestListToCaller,
  requireGroupAccessRequestViewAccess,
};
