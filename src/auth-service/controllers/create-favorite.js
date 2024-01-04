const createFavoriteUtil = require("@utils/create-favorite");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const { logText } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-controller`
);

const createFavorite = {
  syncFavorites: async (req, res, next) => {
    try {
      logText("Syncing Favorites.....");
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

      const responseFromSyncFavorites = await createFavoriteUtil.syncFavorites(
        request,
        next
      );

      if (responseFromSyncFavorites.success === true) {
        const status = responseFromSyncFavorites.status
          ? responseFromSyncFavorites.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromSyncFavorites.message
            ? responseFromSyncFavorites.message
            : "",
          favorites: responseFromSyncFavorites.data
            ? responseFromSyncFavorites.data
            : [],
        });
      } else if (responseFromSyncFavorites.success === false) {
        const status = responseFromSyncFavorites.status
          ? responseFromSyncFavorites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSyncFavorites.message
            ? responseFromSyncFavorites.message
            : "",
          errors: responseFromSyncFavorites.errors
            ? responseFromSyncFavorites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (req, res, next) => {
    try {
      logText("creating Favorite.....");
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

      const responseFromCreateFavorite = await createFavoriteUtil.create(
        request,
        next
      );

      if (responseFromCreateFavorite.success === true) {
        const status = responseFromCreateFavorite.status
          ? responseFromCreateFavorite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromCreateFavorite.message
            ? responseFromCreateFavorite.message
            : "",
          created_Favorite: responseFromCreateFavorite.data
            ? responseFromCreateFavorite.data
            : [],
        });
      } else if (responseFromCreateFavorite.success === false) {
        const status = responseFromCreateFavorite.status
          ? responseFromCreateFavorite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromCreateFavorite.message
            ? responseFromCreateFavorite.message
            : "",
          errors: responseFromCreateFavorite.errors
            ? responseFromCreateFavorite.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
      const responseFromListFavorites = await createFavoriteUtil.list(
        request,
        next
      );

      if (responseFromListFavorites.success === true) {
        const status = responseFromListFavorites.status
          ? responseFromListFavorites.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListFavorites.message
            ? responseFromListFavorites.message
            : "",
          favorites: responseFromListFavorites.data
            ? responseFromListFavorites.data
            : [],
        });
      } else if (responseFromListFavorites.success === false) {
        const status = responseFromListFavorites.status
          ? responseFromListFavorites.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListFavorites.message
            ? responseFromListFavorites.message
            : "",
          errors: responseFromListFavorites.errors
            ? responseFromListFavorites.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
      const responseFromDeleteFavorite = await createFavoriteUtil.delete(
        request,
        next
      );

      if (responseFromDeleteFavorite.success === true) {
        const status = responseFromDeleteFavorite.status
          ? responseFromDeleteFavorite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromDeleteFavorite.message
            ? responseFromDeleteFavorite.message
            : "",
          deleted_Favorite: responseFromDeleteFavorite.data
            ? responseFromDeleteFavorite.data
            : [],
        });
      } else if (responseFromDeleteFavorite.success === false) {
        const status = responseFromDeleteFavorite.status
          ? responseFromDeleteFavorite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromDeleteFavorite.message
            ? responseFromDeleteFavorite.message
            : "",
          errors: responseFromDeleteFavorite.errors
            ? responseFromDeleteFavorite.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

      const responseFromUpdateFavorite = await createFavoriteUtil.update(
        request,
        next
      );

      if (responseFromUpdateFavorite.success === true) {
        const status = responseFromUpdateFavorite.status
          ? responseFromUpdateFavorite.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromUpdateFavorite.message
            ? responseFromUpdateFavorite.message
            : "",
          updated_Favorite: responseFromUpdateFavorite.data
            ? responseFromUpdateFavorite.data
            : [],
        });
      } else if (responseFromUpdateFavorite.success === false) {
        const status = responseFromUpdateFavorite.status
          ? responseFromUpdateFavorite.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateFavorite.message
            ? responseFromUpdateFavorite.message
            : "",
          errors: responseFromUpdateFavorite.errors
            ? responseFromUpdateFavorite.errors
            : { message: "Internal Server Error" },
        });
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

module.exports = createFavorite;
