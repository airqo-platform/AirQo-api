const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-client-controller`
);

const createClient = {
  create: async (req, res, next) => {
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

      const responseFromCreateClient = await controlAccessUtil.createClient(
        request,
        next
      );

      if (responseFromCreateClient.success === true) {
        const status = responseFromCreateClient.status
          ? responseFromCreateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateClient.message
            ? responseFromCreateClient.message
            : "",
          created_client: responseFromCreateClient.data
            ? responseFromCreateClient.data
            : [],
        });
      } else if (responseFromCreateClient.success === false) {
        const status = responseFromCreateClient.status
          ? responseFromCreateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateClient.message
            ? responseFromCreateClient.message
            : "",
          errors: responseFromCreateClient.errors
            ? responseFromCreateClient.errors
            : { message: "" },
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

      const responseFromListClients = await controlAccessUtil.listClient(
        request,
        next
      );

      if (responseFromListClients.success === true) {
        const status = responseFromListClients.status
          ? responseFromListClients.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListClients.message
            ? responseFromListClients.message
            : "",
          clients: responseFromListClients.data
            ? responseFromListClients.data
            : [],
        });
      } else if (responseFromListClients.success === false) {
        const status = responseFromListClients.status
          ? responseFromListClients.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListClients.message
            ? responseFromListClients.message
            : "",
          errors: responseFromListClients.errors
            ? responseFromListClients.errors
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

      const responseFromDeleteClient = await controlAccessUtil.deleteClient(
        request,
        next
      );

      if (responseFromDeleteClient.success === true) {
        const status = responseFromDeleteClient.status
          ? responseFromDeleteClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteClient.message
            ? responseFromDeleteClient.message
            : "",
          deleted_client: responseFromDeleteClient.data
            ? responseFromDeleteClient.data
            : [],
        });
      } else if (responseFromDeleteClient.success === false) {
        const status = responseFromDeleteClient.status
          ? responseFromDeleteClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteClient.message
            ? responseFromDeleteClient.message
            : "",
          errors: responseFromDeleteClient.errors
            ? responseFromDeleteClient.errors
            : { message: "" },
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

      const responseFromUpdateClient = await controlAccessUtil.updateClient(
        request,
        next
      );

      if (responseFromUpdateClient.success === true) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          updated_client: responseFromUpdateClient.data
            ? responseFromUpdateClient.data
            : [],
        });
      } else if (responseFromUpdateClient.success === false) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          errors: responseFromUpdateClient.errors
            ? responseFromUpdateClient.errors
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
  updateClientSecret: async (req, res, next) => {
    try {
      logText("update client secret....");

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

      const responseFromUpdateClient =
        await controlAccessUtil.updateClientSecret(request, next);

      if (responseFromUpdateClient.success === true) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          updated_client_secret: responseFromUpdateClient.data
            ? responseFromUpdateClient.data
            : [],
        });
      } else if (responseFromUpdateClient.success === false) {
        const status = responseFromUpdateClient.status
          ? responseFromUpdateClient.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateClient.message
            ? responseFromUpdateClient.message
            : "",
          errors: responseFromUpdateClient.errors
            ? responseFromUpdateClient.errors
            : { message: "Internal Server Errors" },
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

module.exports = createClient;
