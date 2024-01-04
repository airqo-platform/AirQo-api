const controlAccessUtil = require("@utils/control-access");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-scope-controller`
);

const createScope = {
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

      const createScopeResponse = await controlAccessUtil.createScope(
        request,
        next
      );

      if (createScopeResponse.success === true) {
        const status = createScopeResponse.status
          ? createScopeResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: createScopeResponse.message
            ? createScopeResponse.message
            : "",
          created_scope: createScopeResponse.data
            ? createScopeResponse.data
            : [],
        });
      } else if (createScopeResponse.success === false) {
        const status = createScopeResponse.status
          ? createScopeResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: createScopeResponse.message
            ? createScopeResponse.message
            : "",
          errors: createScopeResponse.errors
            ? createScopeResponse.errors
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

      const scopesResponse = await controlAccessUtil.listScope(request, next);

      if (scopesResponse.success === true) {
        const status = scopesResponse.status
          ? scopesResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: scopesResponse.message ? scopesResponse.message : "",
          scopes: scopesResponse.data ? scopesResponse.data : [],
        });
      } else if (scopesResponse.success === false) {
        const status = scopesResponse.status
          ? scopesResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: scopesResponse.message ? scopesResponse.message : "",
          errors: scopesResponse.errors
            ? scopesResponse.errors
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

      const deleteScopeResponse = await controlAccessUtil.deleteScope(
        request,
        next
      );

      if (deleteScopeResponse.success === true) {
        const status = deleteScopeResponse.status
          ? deleteScopeResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: deleteScopeResponse.message
            ? deleteScopeResponse.message
            : "",
          deleted_scope: deleteScopeResponse.data
            ? deleteScopeResponse.data
            : [],
        });
      } else if (deleteScopeResponse.success === false) {
        const status = deleteScopeResponse.status
          ? deleteScopeResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: deleteScopeResponse.message
            ? deleteScopeResponse.message
            : "",
          errors: deleteScopeResponse.errors
            ? deleteScopeResponse.errors
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

      const updateScopeResponse = await controlAccessUtil.updateScope(
        request,
        next
      );

      if (updateScopeResponse.success === true) {
        const status = updateScopeResponse.status
          ? updateScopeResponse.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: updateScopeResponse.message
            ? updateScopeResponse.message
            : "",
          updated_scope: updateScopeResponse.data
            ? updateScopeResponse.data
            : [],
        });
      } else if (updateScopeResponse.success === false) {
        const status = updateScopeResponse.status
          ? updateScopeResponse.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: updateScopeResponse.message
            ? updateScopeResponse.message
            : "",
          errors: updateScopeResponse.errors
            ? updateScopeResponse.errors
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

module.exports = createScope;
