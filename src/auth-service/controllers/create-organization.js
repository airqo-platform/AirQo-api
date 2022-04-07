const { logText, logObject } = require("../utils/log");
const HTTPStatus = require("http-status");
const createOrganizationUtil = require("../utils/create-organization");
const { validationResult } = require("express-validator");
const log4js = require("log4js");
const logger = log4js.getLogger("organization-controller");
const errorsUtil = require("../utils/errors");

const createOrganization = {
  getTenantFromEmail: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let { body, query } = req;
      let request = {};
      request["body"] = body;
      let responseFromGetTenantFromEmail =
        await createOrganizationUtil.getTenantFromEmail(request);

      if (responseFromGetTenantFromEmail.success === true) {
        let status = responseFromGetTenantFromEmail.status
          ? responseFromGetTenantFromEmail.status
          : HTTPStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetTenantFromEmail.message,
          tenant: responseFromGetTenantFromEmail.data,
        });
      }

      if (responseFromGetTenantFromEmail.success === false) {
        let status = responseFromGetTenantFromEmail.status
          ? responseFromGetTenantFromEmail.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromGetTenantFromEmail.errors
          ? responseFromGetTenantFromEmail.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromGetTenantFromEmail.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`update defaults -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = error.message;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
  create: async (req, res) => {
    try {
      logText("we are creating the organization....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let { body, query, params } = req;
      let request = {};
      request["query"] = query;
      request["body"] = body;
      request["params"] = params;

      let responseFromCreateOrganization = await createOrganizationUtil.create(
        request
      );

      logObject(
        "responseFromCreateOrganization",
        responseFromCreateOrganization
      );

      if (responseFromCreateOrganization.success === true) {
        let status = responseFromCreateOrganization.status
          ? responseFromCreateOrganization.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromCreateOrganization.message,
          created_organization: responseFromCreateOrganization.data,
        });
      } else if (responseFromCreateOrganization.success === false) {
        let errors = responseFromCreateOrganization.errors
          ? responseFromCreateOrganization.errors
          : "";

        let status = responseFromCreateOrganization.status
          ? responseFromCreateOrganization.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateOrganization.message,
          errors,
        });
      }
    } catch (err) {
      logger.error(`update defaults -- ${err}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = err.message;
      const error = err;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
  update: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let { body, query, params } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;
      request["params"] = params;

      let responseFromUpdateOrganization = await createOrganizationUtil.update(
        request
      );

      if (responseFromUpdateOrganization.success === true) {
        let status = responseFromUpdateOrganization.status
          ? responseFromUpdateOrganization.status
          : HTTPStatus.OK;

        return res.status(status).json({
          message: responseFromUpdateOrganization.message,
          updated_organization: responseFromUpdateOrganization.data,
          success: true,
        });
      } else if (responseFromUpdateOrganization.success === false) {
        let status = responseFromUpdateOrganization.status
          ? responseFromUpdateOrganization.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromUpdateOrganization.errors
          ? responseFromUpdateOrganization.errors
          : "";
        return res.status(status).json({
          success: false,
          message: responseFromUpdateOrganization.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`update defaults -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = error.message;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
  delete: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }

      let { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      let responseFromDeleteOrganization = await createOrganizationUtil.delete(
        request
      );

      logObject(
        "responseFromDeleteOrganization",
        responseFromDeleteOrganization
      );

      if (responseFromDeleteOrganization.success === true) {
        let status = responseFromDeleteOrganization.status
          ? responseFromDeleteOrganization.status
          : HTTPStatus.OK;

        return res.status(status).json({
          message: responseFromDeleteOrganization.message,
          deleted_organization: responseFromDeleteOrganization.data,
          success: true,
        });
      } else if (responseFromDeleteOrganization.success === false) {
        let status = responseFromDeleteOrganization.status
          ? responseFromDeleteOrganization.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromDeleteOrganization.errors
          ? responseFromDeleteOrganization.errors
          : "";

        return res.status(status).json({
          message: responseFromDeleteOrganization.message,
          errors,
          success: false,
        });
      }
    } catch (error) {
      logger.error(`update defaults -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = error.message;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
  list: async (req, res) => {
    try {
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        const message = "bad request errors";
        const error = errorsUtil.convertErrorArrayToObject(nestedErrors);
        const statusCode = HTTPStatus.BAD_REQUEST;
        return errorsUtil.errorResponse({ res, message, statusCode, error });
      }
      let { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      let responseFromListOrganizations = await createOrganizationUtil.list(
        request
      );

      logObject(
        "responseFromListOrganizations in controller",
        responseFromListOrganizations
      );

      if (responseFromListOrganizations.success === true) {
        let status = responseFromListOrganizations.status
          ? responseFromListOrganizations.status
          : HTTPStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListOrganizations.message,
          organizations: responseFromListOrganizations.data,
        });
      } else if (responseFromListOrganizations.success === false) {
        let status = responseFromListOrganizations.status
          ? responseFromListOrganizations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromListOrganizations.errors
          ? responseFromListOrganizations.errors
          : "";

        return res.status(status).json({
          message: responseFromListOrganizations.message,
          errors,
        });
      }
    } catch (error) {
      logger.error(`update defaults -- ${error}`);
      const statusCode = HTTPStatus.INTERNAL_SERVER_ERROR;
      const message = error.message;
      errorsUtil.errorResponse({ res, message, statusCode, error });
    }
  },
};

module.exports = createOrganization;
