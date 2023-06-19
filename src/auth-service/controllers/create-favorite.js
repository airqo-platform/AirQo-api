const { validationResult } = require("express-validator");
const createFavoriteUtil = require("@utils/create-favorite");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const { logText, logObject } = require("@utils/log");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-controller`
);

const createFavorite = {
  create: async (req, res) => {
    try {
      logText("creating Favorite.....");
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }

      const responseFromCreateFavorite = await createFavoriteUtil.create(
        request
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
      logObject("error", error);
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }
      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromListFavorites = await createFavoriteUtil.list(request);

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
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromDeleteFavorite = await createFavoriteUtil.delete(
        request
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
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
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
      const hasErrors = !validationResult(req).isEmpty();
      logObject("hasErrors", hasErrors);
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let request = Object.assign({}, req);
      if (isEmpty(tenant)) {
        request["query"]["tenant"] = constants.DEFAULT_TENANT;
      }
      const responseFromUpdateFavorite = await createFavoriteUtil.update(
        request
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
      logger.error(`Internal Server Error -- ${JSON.stringify(error)}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createFavorite;
