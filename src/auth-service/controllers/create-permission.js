const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");

const createPermission = {
  create: async (req, res) => {
    try {
      logText("creating permission.....");
      const { query } = req;
      let { tenant } = query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromCreatePermission =
        await controlAccessUtil.createPermission(request);

      if (responseFromCreatePermission.success === true) {
        const status = responseFromCreatePermission.status
          ? responseFromCreatePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreatePermission.message
            ? responseFromCreatePermission.message
            : "",
          created_permission: responseFromCreatePermission.data
            ? responseFromCreatePermission.data
            : [],
        });
      } else if (responseFromCreatePermission.success === false) {
        const status = responseFromCreatePermission.status
          ? responseFromCreatePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreatePermission.message
            ? responseFromCreatePermission.message
            : "",
          errors: responseFromCreatePermission.errors
            ? responseFromCreatePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  list: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }
      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromListPermissions =
        await controlAccessUtil.listPermission(request);

      if (responseFromListPermissions.success === true) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListPermissions.message
            ? responseFromListPermissions.message
            : "",
          permissions: responseFromListPermissions.data
            ? responseFromListPermissions.data
            : [],
        });
      } else if (responseFromListPermissions.success === false) {
        const status = responseFromListPermissions.status
          ? responseFromListPermissions.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListPermissions.message
            ? responseFromListPermissions.message
            : "",
          errors: responseFromListPermissions.errors
            ? responseFromListPermissions.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  delete: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromDeletePermission =
        await controlAccessUtil.deletePermission(request);

      if (responseFromDeletePermission.success === true) {
        const status = responseFromDeletePermission.status
          ? responseFromDeletePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeletePermission.message
            ? responseFromDeletePermission.message
            : "",
          deleted_permission: responseFromDeletePermission.data
            ? responseFromDeletePermission.data
            : [],
        });
      } else if (responseFromDeletePermission.success === false) {
        const status = responseFromDeletePermission.status
          ? responseFromDeletePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeletePermission.message
            ? responseFromDeletePermission.message
            : "",
          errors: responseFromDeletePermission.errors
            ? responseFromDeletePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  update: async (req, res) => {
    try {
      const { query } = req;
      let { tenant } = query;
      const errors = extractErrorsFromRequest(req);
      if (errors) {
        throw new HttpError(
          "bad request errors",
          httpStatus.BAD_REQUEST,
          extractErrorsFromRequest(req)
        );
      }

      let request = req;
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUpdatePermission =
        await controlAccessUtil.updatePermission(request);

      if (responseFromUpdatePermission.success === true) {
        const status = responseFromUpdatePermission.status
          ? responseFromUpdatePermission.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdatePermission.message
            ? responseFromUpdatePermission.message
            : "",
          updated_permission: responseFromUpdatePermission.data
            ? responseFromUpdatePermission.data
            : [],
        });
      } else if (responseFromUpdatePermission.success === false) {
        const status = responseFromUpdatePermission.status
          ? responseFromUpdatePermission.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdatePermission.message
            ? responseFromUpdatePermission.message
            : "",
          errors: responseFromUpdatePermission.errors
            ? responseFromUpdatePermission.errors
            : { message: "" },
        });
      }
    } catch (error) {
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createPermission;
