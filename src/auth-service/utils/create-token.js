const httpStatus = require("http-status");
const TokenModel = require("../models/Token");
const log4js = require("log4js");
const logger = log4js.getLogger("create-token-util");

const token = {
  create: async (request) => {
    try {
      const responseFromCreateToken = await TokenModel(tenant).create({});
      if (responseFromCreateToken.success === true) {
        const status = httpStatus.OK;
        return {
          success: true,
          message: "",
          status,
        };
      }
      if (responseFromCreateToken.success === false) {
        const status = responseFromCreateToken.status;
        const errors = responseFromCreateToken.errors;
        return {
          success: false,
          message: "",
          status,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  delete: (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  update: (request) => {
    try {
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};
