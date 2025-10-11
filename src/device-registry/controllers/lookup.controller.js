const deviceUtil = require("@utils/device.util");
const { validationResult } = require("express-validator");
const { HttpError } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- lookup-controller`
);

const lookup = {
  getIdFromName: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "bad request errors",
            httpStatus.BAD_REQUEST,
            errors.array()
          )
        );
      }

      const response = await deviceUtil.getIdFromName(req, next);
      if (!response) return; // error already forwarded via next()
      return res.status(response.status).json(response);
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

  getNameFromId: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "bad request errors",
            httpStatus.BAD_REQUEST,
            errors.array()
          )
        );
      }
      const response = await deviceUtil.getNameFromId(req, next);
      if (!response) return;
      return res.status(response.status).json(response);
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

  suggestDeviceNames: async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return next(
          new HttpError(
            "bad request errors",
            httpStatus.BAD_REQUEST,
            errors.array()
          )
        );
      }
      const response = await deviceUtil.suggestNames(req, next);
      if (!response) return;
      return res.status(response.status).json(response);
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

module.exports = lookup;
