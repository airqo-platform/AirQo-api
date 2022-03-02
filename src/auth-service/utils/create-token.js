const httpStatus = require("http-status");
const TokenModel = require("../models/Token");
const log4js = require("log4js");
const logger = log4js.getLogger("create-token-util");

const token = {
  create: async (request) => {
    try {
      const { tenant } = request;
      const responseFromCreateToken = await TokenModel(tenant).create({});
      if (responseFromCreateToken.success === true) {
        const status = responseFromCreateToken.status
          ? responseFromCreateToken.status
          : httpStatus.OK;
        return {
          success: true,
          message: responseFromCreateToken.message,
          status,
        };
      } else if (responseFromCreateToken.success === false) {
        const status = responseFromCreateToken.status
          ? responseFromCreateToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromCreateToken.errors
          ? responseFromCreateToken.errors
          : "";
        return {
          success: false,
          message: responseFromCreateToken.message,
          status,
          errors,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  list: async (request) => {
    try {
      const responseFromListToken = await TokenModel(tenant).list({});
      if (responseFromListToken.success === true) {
        const status = responseFromListToken.status
          ? responseFromListToken.status
          : httpStatus.OK;
        return {
          success: true,
          message: responseFromListToken.message,
          data: responseFromListToken.data,
          status,
        };
      } else if (responseFromListToken.success === false) {
        const status = responseFromListToken.status
          ? responseFromListToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromListToken.errors
          ? responseFromListToken.errors
          : "";
        return {
          success: false,
          message: responseFromListToken.message,
          errors,
          status,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  delete: async (request) => {
    try {
      const responseFromDeleteToken = await TokenModel(tenant).delete({});
      if (responseFromDeleteToken.success === true) {
        const status = responseFromDeleteToken.status
          ? responseFromDeleteToken.status
          : httpStatus.OK;
        return {
          success: true,
          message: responseFromDeleteToken.message,
          status,
        };
      } else if (responseFromDeleteToken.success === false) {
        const status = responseFromDeleteToken.status
          ? responseFromDeleteToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromDeleteToken.errors
          ? responseFromDeleteToken.errors
          : "unable to delete token";
        return {
          success: false,
          message: responseFromDeleteToken.message,
          status,
          errors,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
  update: async (request) => {
    try {
      const responseFromUpdateToken = await TokenModel(tenant).modify({});
      if (responseFromUpdateToken.success === true) {
        const status = responseFromUpdateToken.status
          ? responseFromUpdateToken.status
          : httpStatus.OK;
        return {
          success: true,
          message: responseFromUpdateToken.message,
          status,
        };
      } else if (responseFromUpdateToken.success === false) {
        const status = responseFromUpdateToken.status
          ? responseFromUpdateToken.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        const errors = responseFromUpdateToken.errors
          ? responseFromUpdateToken.errors
          : "unable to update token";
        return {
          success: false,
          message: responseFromUpdateToken.message,
          status,
          errors,
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
};
