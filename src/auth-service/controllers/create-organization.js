const { logElement, logText, logObject } = require("../utils/log");
const HTTPStatus = require("http-status");
const createOrganizationUtil = require("../utils/create-organization");
const { validationResult } = require("express-validator");
const manipulateArraysUtil = require("../utils/manipulate-arrays");

const createOrganization = {
  create: async (req, res) => {
    try {
      logText("we are creating the organization....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
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
      }

      if (responseFromCreateOrganization.success === false) {
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
      res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: err.message,
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
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
      }

      if (responseFromUpdateOrganization.success === false) {
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
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
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
      }

      if (responseFromDeleteOrganization.success === false) {
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
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        message: "Internal Server Error",
        errors: error.message,
        success: false,
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
          manipulateArraysUtil.convertErrorArrayToObject(nestedErrors)
        );
      }
      let { body, query } = req;
      let request = {};
      request["body"] = body;
      request["query"] = query;

      let responseFromListOrganizations = await createOrganizationUtil.list(
        request
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
      }

      if (responseFromListOrganizations.success === false) {
        let status = responseFromListOrganizations.status
          ? responseFromListOrganizations.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromListOrganizations.errors
          ? responseFromListOrganizations.errors
          : "";

        return res.status(status).json({
          errors,
          message: responseFromListOrganizations.message,
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(HTTPStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: error.message,
      });
    }
  },
};

module.exports = createOrganization;
