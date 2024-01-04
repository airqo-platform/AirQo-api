const httpStatus = require("http-status");
const createAccessRequestUtil = require("@utils/create-request");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-request-controller`
);
const { logObject } = require("@utils/log");

const createAccessRequest = {
  requestAccessToGroup: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRequestAccessToGroup =
        await createAccessRequestUtil.requestAccessToGroup(request, next);

      if (responseFromRequestAccessToGroup.success === true) {
        const status = responseFromRequestAccessToGroup.status
          ? responseFromRequestAccessToGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRequestAccessToGroup.message,
          request: responseFromRequestAccessToGroup.data,
        });
      } else if (responseFromRequestAccessToGroup.success === false) {
        const status = responseFromRequestAccessToGroup.status
          ? responseFromRequestAccessToGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRequestAccessToGroup.message,
          error: responseFromRequestAccessToGroup.error
            ? responseFromRequestAccessToGroup.error
            : "",
          errors: responseFromRequestAccessToGroup.errors
            ? responseFromRequestAccessToGroup.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  requestAccessToGroupByEmail: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRequestAccessToGroup =
        await createAccessRequestUtil.requestAccessToGroupByEmail(
          request,
          next
        );

      if (responseFromRequestAccessToGroup.success === true) {
        const status = responseFromRequestAccessToGroup.status
          ? responseFromRequestAccessToGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRequestAccessToGroup.message,
          request: responseFromRequestAccessToGroup.data,
        });
      } else if (responseFromRequestAccessToGroup.success === false) {
        const status = responseFromRequestAccessToGroup.status
          ? responseFromRequestAccessToGroup.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRequestAccessToGroup.message,
          errors: responseFromRequestAccessToGroup.errors
            ? responseFromRequestAccessToGroup.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  acceptInvitation: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromAcceptGroupInvitation =
        await createAccessRequestUtil.acceptInvitation(request, next);

      if (responseFromAcceptGroupInvitation.success === true) {
        const status = responseFromAcceptGroupInvitation.status
          ? responseFromAcceptGroupInvitation.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromAcceptGroupInvitation.message,
          invite: responseFromAcceptGroupInvitation.data,
        });
      } else if (responseFromAcceptGroupInvitation.success === false) {
        const status = responseFromAcceptGroupInvitation.status
          ? responseFromAcceptGroupInvitation.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAcceptGroupInvitation.message,
          errors: responseFromAcceptGroupInvitation.errors
            ? responseFromAcceptGroupInvitation.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  requestAccessToNetwork: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromRequestAccessToNetwork =
        await createAccessRequestUtil.requestAccessToNetwork(request, next);

      if (responseFromRequestAccessToNetwork.success === true) {
        const status = responseFromRequestAccessToNetwork.status
          ? responseFromRequestAccessToNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRequestAccessToNetwork.message,
          request: responseFromRequestAccessToNetwork.data,
        });
      } else if (responseFromRequestAccessToNetwork.success === false) {
        const status = responseFromRequestAccessToNetwork.status
          ? responseFromRequestAccessToNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromRequestAccessToNetwork.message,
          error: responseFromRequestAccessToNetwork.error
            ? responseFromRequestAccessToNetwork.error
            : "",
          errors: responseFromRequestAccessToNetwork.errors
            ? responseFromRequestAccessToNetwork.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  approveAccessRequest: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromApproveAccessRequest =
        await createAccessRequestUtil.approveAccessRequest(request, next);

      if (responseFromApproveAccessRequest.success === true) {
        const status = responseFromApproveAccessRequest.status
          ? responseFromApproveAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromApproveAccessRequest.message,
          requests: responseFromApproveAccessRequest.data,
        });
      } else if (responseFromApproveAccessRequest.success === false) {
        const status = responseFromApproveAccessRequest.status
          ? responseFromApproveAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromApproveAccessRequest.message,
          error: responseFromApproveAccessRequest.error
            ? responseFromApproveAccessRequest.error
            : "",
          errors: responseFromApproveAccessRequest.errors
            ? responseFromApproveAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  rejectAccessRequest: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.body.status = "rejected";

      const responseFromRejectAccessRequest =
        await createAccessRequestUtil.update(request, next);

      if (responseFromRejectAccessRequest.success === true) {
        const status = responseFromRejectAccessRequest.status
          ? responseFromRejectAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRejectAccessRequest.message,
          requests: responseFromRejectAccessRequest.data,
        });
      } else if (responseFromRejectAccessRequest.success === false) {
        const status = responseFromRejectAccessRequest.status
          ? responseFromRejectAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromRejectAccessRequest.message,
          error: responseFromRejectAccessRequest.error
            ? responseFromRejectAccessRequest.error
            : "",
          errors: responseFromRejectAccessRequest.errors
            ? responseFromRejectAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listPendingAccessRequests: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;
      request.query.status = "pending";

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request,
        next
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          requests: responseFromListAccessRequest.data,
        });
      } else if (responseFromListAccessRequest.success === false) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAccessRequest.message,
          errors: responseFromListAccessRequest.errors
            ? responseFromListAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAccessRequestsForGroup: async (req, res, next) => {
    try {
      const { grp_id } = req.query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.targetId = grp_id;
      request.query.requestType = "group";

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request,
        next
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          requests: responseFromListAccessRequest.data,
        });
      } else if (responseFromListAccessRequest.success === false) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAccessRequest.message,
          error: responseFromListAccessRequest.error
            ? responseFromListAccessRequest.error
            : "",
          errors: responseFromListAccessRequest.errors
            ? responseFromListAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAccessRequestsForNetwork: async (req, res, next) => {
    try {
      const { net_id } = req.query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      request.query.targetId = net_id;
      request.query.requestType = "network";

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request,
        next
      );

      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          requests: responseFromListAccessRequest.data,
        });
      } else if (responseFromListAccessRequest.success === false) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAccessRequest.message,
          error: responseFromListAccessRequest.error
            ? responseFromListAccessRequest.error
            : "",
          errors: responseFromListAccessRequest.errors
            ? responseFromListAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  list: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request,
        next
      );

      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          requests: responseFromListAccessRequest.data,
        });
      } else if (responseFromListAccessRequest.success === false) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAccessRequest.message,
          errors: responseFromListAccessRequest.errors
            ? responseFromListAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromDeleteAccessRequest =
        await createAccessRequestUtil.delete(request, next);

      if (responseFromDeleteAccessRequest.success === true) {
        const status = responseFromDeleteAccessRequest.status
          ? responseFromDeleteAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteAccessRequest.message,
          request: responseFromDeleteAccessRequest.data,
        });
      } else if (responseFromDeleteAccessRequest.success === false) {
        const status = responseFromDeleteAccessRequest.status
          ? responseFromDeleteAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteAccessRequest.message,
          errors: responseFromDeleteAccessRequest.errors
            ? responseFromDeleteAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (req, res, next) => {
    try {
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        next(
          new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
        );
      }
      const request = req;
      const defaultTenant = constants.DEFAULT_TENANT || "airqo";
      request.query.tenant = isEmpty(req.query.tenant)
        ? defaultTenant
        : req.query.tenant;

      const responseFromUpdateAccessRequest =
        await createAccessRequestUtil.update(request, next);

      if (responseFromUpdateAccessRequest.success === true) {
        const status = responseFromUpdateAccessRequest.status
          ? responseFromUpdateAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateAccessRequest.message,
          request: responseFromUpdateAccessRequest.data,
        });
      } else if (responseFromUpdateAccessRequest.success === false) {
        const status = responseFromUpdateAccessRequest.status
          ? responseFromUpdateAccessRequest.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateAccessRequest.message,
          errors: responseFromUpdateAccessRequest.errors
            ? responseFromUpdateAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = createAccessRequest;
