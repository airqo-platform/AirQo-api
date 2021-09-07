const OrganizationSchema = require("../models/Organization");
const { getModelByTenant } = require("./multitenancy");
const { logElement, logText, logObject } = require("./log");
const generateFilter = require("./generate-filter");
const HTTPStatus = require("http-status");

const createOrganization = {
  sanitizeName: (name) => {
    try {
      let nameWithoutWhiteSpaces = name.replace(/\s/g, "");
      let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
      let trimmedName = shortenedName.trim();
      return trimmedName.toLowerCase();
    } catch (error) {
      logElement("the sanitise name error", error.message);
    }
  },
  create: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;
      let responseFromRegisterOrganization = await getModelByTenant(
        tenant.toLowerCase(),
        "organization",
        OrganizationSchema
      ).register(body);

      logObject(
        "responseFromRegisterOrganization",
        responseFromRegisterOrganization
      );

      if (responseFromRegisterOrganization.success === true) {
        let status = responseFromRegisterOrganization.status
          ? responseFromRegisterOrganization.status
          : "";
        return {
          success: true,
          message: responseFromRegisterOrganization.message,
          data: responseFromRegisterOrganization.data,
          status,
        };
      }

      if (responseFromRegisterOrganization.success === false) {
        let errors = responseFromRegisterOrganization.errors
          ? responseFromRegisterOrganization.errors
          : "";

        let status = responseFromRegisterOrganization.status
          ? responseFromRegisterOrganization.status
          : "";

        return {
          success: false,
          message: responseFromRegisterOrganization.message,
          errors,
          status,
        };
      }
    } catch (err) {
      return {
        success: false,
        message: "organization util server errors",
        errors: err.message,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: async (request) => {
    try {
      let { body, query } = request;
      let { tenant } = query;
      let update = body;
      let filter = {};
      let responseFromGeneratefilter = generateFilter.organizations(request);

      if (responseFromGeneratefilter.success === true) {
        filter = responseFromGeneratefilter.data;
      }

      if (responseFromGeneratefilter.success === false) {
        let status = responseFromGeneratefilter.status
          ? responseFromGeneratefilter.status
          : HTTPStatus.INTERNAL_SERVER_ERROR;
        let errors = responseFromGeneratefilter.errors
          ? responseFromGeneratefilter.errors
          : "";
        return {
          message: "Internal Server Error",
          errors,
          status,
          success: false,
        };
      }

      let responseFromModifyOrganization = await getModelByTenant(
        tenant.toLowerCase(),
        "organization",
        OrganizationSchema
      ).modify({ update, filter });

      if (responseFromModifyOrganization.success === true) {
        let status = responseFromModifyOrganization.status
          ? responseFromModifyOrganization.status
          : "";
        return {
          message: responseFromModifyOrganization.message,
          status,
          data: responseFromModifyOrganization.data,
          success: true,
        };
      }

      if (responseFromModifyOrganization.success === false) {
        let status = responseFromModifyOrganization.status
          ? responseFromModifyOrganization.status
          : "";
        let errors = responseFromModifyOrganization.errors
          ? responseFromModifyOrganization.errors
          : "";
        return {
          success: false,
          message: responseFromModifyOrganization.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: error,
      };
    }
  },
  delete: async (request) => {
    try {
      logText("the delete operation.....");
      let { query, body } = request;
      let { tenant } = query;
      let filter = {};

      let responseFromGenerateFilter = generateFilter.organizations(request);

      logObject("responseFromGenerateFilter", responseFromGenerateFilter);

      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      }

      if (responseFromGenerateFilter.success === false) {
        let status = responseFromGenerateFilter.status
          ? responseFromGenerateFilter.status
          : "";
        let errors = responseFromGenerateFilter.errors
          ? responseFromGenerateFilter.errors
          : "";
        return {
          status,
          errors,
          message: responseFromGenerateFilter.message,
        };
      }

      logObject("the filter", filter);

      let responseFromRemoveOrganization = await getModelByTenant(
        tenant.toLowerCase(),
        "organization",
        OrganizationSchema
      ).remove({ filter });

      logObject(
        "responseFromRemoveOrganization",
        responseFromRemoveOrganization
      );

      if (responseFromRemoveOrganization.success === true) {
        let status = responseFromRemoveOrganization.status
          ? responseFromRemoveOrganization.status
          : "";

        return {
          status,
          message: responseFromRemoveOrganization.message,
          data: responseFromRemoveOrganization.data,
          success: true,
        };
      }

      if (responseFromRemoveOrganization.success === false) {
        let status = responseFromRemoveOrganization.status
          ? responseFromRemoveOrganization.status
          : "";
        let errors = responseFromRemoveOrganization.errors
          ? responseFromRemoveOrganization.errors
          : "";

        return {
          message: responseFromRemoveOrganization.message,
          errors,
          status,
          success: false,
        };
      }
    } catch (error) {
      return {
        message: "Internal Server Error",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        errors: error.message,
        success: false,
      };
    }
  },
  list: async (request) => {
    try {
      let { skip, limit, tenant } = request.query;
      let filter = {};

      let responseFromGenerateFilter = generateFilter.organizations(request);
      if (responseFromGenerateFilter.success === true) {
        filter = responseFromGenerateFilter.data;
      }

      if (responseFromGenerateFilter.success === false) {
        let status = responseFromGenerateFilter.status
          ? responseFromGenerateFilter.status
          : "";
        let errors = responseFromGenerateFilter.errors
          ? responseFromGenerateFilter.errors
          : "";
        return {
          success: false,
          message: responseFromGenerateFilter.message,
          errors,
          status,
        };
      }

      let responseFromListOrganizations = await getModelByTenant(
        tenant.toLowerCase(),
        "organization",
        OrganizationSchema
      ).list({ filter, limit, skip });

      if (responseFromListOrganizations.success === true) {
        let status = responseFromListOrganizations.status
          ? responseFromListOrganizations.status
          : "";

        return {
          success: true,
          status,
          message: responseFromListOrganizations.message,
          data: responseFromListOrganizations.data,
        };
      }

      if (responseFromListOrganizations.success === false) {
        let status = responseFromListOrganizations.status
          ? responseFromListOrganizations.status
          : "";
        let errors = responseFromListOrganizations.errors
          ? responseFromListOrganizations.errors
          : "";

        return {
          status,
          errors,
          message: responseFromListOrganizations.message,
        };
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return {
        success: false,
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        errors: error.message,
      };
    }
  },
};

module.exports = createOrganization;
