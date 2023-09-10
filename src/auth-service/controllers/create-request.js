const httpStatus = require("http-status");
const createAccessRequestUtil = require("@utils/create-request");
const generateFilter = require("@utils/generate-filter");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-request-controller`
);
const { logText, logObject, logElement } = require("@utils/log");

const createAccessRequest = {
  requestAccessToGroup: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      //might need to add some required details here

      const responseFromRequestAccessToGroup =
        await createAccessRequestUtil.requestAccessToGroup(request);
      logObject(
        "responseFromRequestAccessToGroup",
        responseFromRequestAccessToGroup
      );
      if (responseFromRequestAccessToGroup.success === true) {
        const status = responseFromRequestAccessToGroup.status
          ? responseFromRequestAccessToGroup.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRequestAccessToGroup.message,
          candidates: responseFromRequestAccessToGroup.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  requestAccessToNetwork: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      //might need to add some required details here

      const responseFromRequestAccessToNetwork =
        await createAccessRequestUtil.requestAccessToNetwork(request);
      logObject(
        "responseFromRequestAccessToNetwork",
        responseFromRequestAccessToNetwork
      );
      if (responseFromRequestAccessToNetwork.success === true) {
        const status = responseFromRequestAccessToNetwork.status
          ? responseFromRequestAccessToNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRequestAccessToNetwork.message,
          candidates: responseFromRequestAccessToNetwork.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  approveAccessRequest: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      //might need to add some required details here

      const responseFromApproveAccessRequest =
        await createAccessRequestUtil.approveAccessRequest(request);
      logObject(
        "responseFromApproveAccessRequest",
        responseFromApproveAccessRequest
      );
      if (responseFromApproveAccessRequest.success === true) {
        const status = responseFromApproveAccessRequest.status
          ? responseFromApproveAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromApproveAccessRequest.message,
          candidates: responseFromApproveAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  rejectAccessRequest: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      //might need to add some required details here

      const responseFromRejectAccessRequest =
        await createAccessRequestUtil.rejectAccessRequest(request);
      logObject(
        "responseFromRejectAccessRequest",
        responseFromRejectAccessRequest
      );
      if (responseFromRejectAccessRequest.success === true) {
        const status = responseFromRejectAccessRequest.status
          ? responseFromRejectAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromRejectAccessRequest.message,
          candidates: responseFromRejectAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  listPendingAccessRequests: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      //add some qualifier for pending access requests

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          candidates: responseFromListAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  listAccessRequestsForGroup: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      //list something specific for a group

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          candidates: responseFromListAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  listAccessRequestsForNetwork: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      // add some thing specific for Network

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          candidates: responseFromListAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  create: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req.body);
      request["tenant"] = tenant.toLowerCase();

      const responseFromCreateAccessUtil = await createAccessRequestUtil.create(
        request
      );

      if (responseFromCreateAccessUtil.success === true) {
        const status = responseFromCreateAccessUtil.status
          ? responseFromCreateAccessUtil.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateAccessUtil.message,
          request: responseFromCreateAccessUtil.data,
        });
      } else if (responseFromCreateAccessUtil.success === false) {
        const status = responseFromCreateAccessUtil.status
          ? responseFromCreateAccessUtil.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateAccessUtil.message,
          errors: responseFromCreateAccessUtil.errors
            ? responseFromCreateAccessUtil.errors
            : { message: "Internal Server Errors" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAccessRequest = await createAccessRequestUtil.list(
        request
      );
      logObject("responseFromListAccessRequest", responseFromListAccessRequest);
      if (responseFromListAccessRequest.success === true) {
        const status = responseFromListAccessRequest.status
          ? responseFromListAccessRequest.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListAccessRequest.message,
          candidates: responseFromListAccessRequest.data,
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
    } catch (e) {
      logger.error(`Internal Server Error ${e.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      const request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromDeleteAccessRequest =
        await createAccessRequestUtil.delete(request);

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
          request: responseFromDeleteAccessRequest.data,
          error: responseFromDeleteAccessRequest.error
            ? responseFromDeleteAccessRequest.error
            : "",
          errors: responseFromDeleteAccessRequest.errors
            ? responseFromDeleteAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      });
    }
  },
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateAccessRequest =
        await createAccessRequestUtil.update(request);

      logObject(
        "responseFromUpdateAccessRequest",
        responseFromUpdateAccessRequest
      );
      if (responseFromUpdateAccessRequest.success === true) {
        return res.status(httpStatus.OK).json({
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
          request: responseFromUpdateAccessRequest.data,
          error: responseFromUpdateAccessRequest.error
            ? responseFromUpdateAccessRequest.error
            : "",
          errors: responseFromUpdateAccessRequest.errors
            ? responseFromUpdateAccessRequest.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`Internal Server Error ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        error: error.message,
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createAccessRequest;
