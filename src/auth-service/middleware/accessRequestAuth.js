// middleware/accessRequestAuth.js
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const { HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const AccessRequestModel = require("@models/AccessRequest");
const { requireGroupManagerAccess } = require("@middleware/groupNetworkAuth");

/**
 * Resolves :request_id to its underlying AccessRequest, then authorizes the
 * caller against the request's target group before allowing approve/reject.
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
          message:
            "Approving/rejecting network access requests is not yet supported",
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

module.exports = { requireAccessRequestManagerAccess };
