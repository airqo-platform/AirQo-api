const { logElement, logText, logObject } = require("../utils/log");
const httpStatus = require("http-status");
const createNetworkUtil = require("../utils/create-network");
const createUserUtil = require("../utils/create-user");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("../utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-controller`
);

const createNetwork = {
  getNetworkFromEmail: async (req, res) => {
    try {
      logText("getNetworkFromEmail....");

      let { tenant } = req.query;
      logElement("tenant", tenant);
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromGetNetworkFromEmail =
        await createNetworkUtil.getNetworkFromEmail(request);

      logObject(
        "responseFromGetNetworkFromEmail",
        responseFromGetNetworkFromEmail
      );

      if (responseFromGetNetworkFromEmail.success === true) {
        const status = responseFromGetNetworkFromEmail.status
          ? responseFromGetNetworkFromEmail.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromGetNetworkFromEmail.message,
          network_name: responseFromGetNetworkFromEmail.data,
        });
      } else if (responseFromGetNetworkFromEmail.success === false) {
        const status = responseFromGetNetworkFromEmail.status
          ? responseFromGetNetworkFromEmail.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromGetNetworkFromEmail.message,
          errors: responseFromGetNetworkFromEmail.errors
            ? responseFromGetNetworkFromEmail.errors
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

  create: async (req, res) => {
    try {
      logText("we are creating the network....");
      const { query } = req;
      let { tenant } = query;
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromCreateNetwork = await createNetworkUtil.create(request);

      if (responseFromCreateNetwork.success === true) {
        let status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromCreateNetwork.message,
          created_network: responseFromCreateNetwork.data,
        });
      } else if (responseFromCreateNetwork.success === false) {
        const status = responseFromCreateNetwork.status
          ? responseFromCreateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromCreateNetwork.message,
          errors: responseFromCreateNetwork.errors
            ? responseFromCreateNetwork.errors
            : { message: "" },
        });
      }
    } catch (err) {
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    }
  },

  assignUsers: async (req, res) => {
    try {
      logText("assign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT || "airqo";
      }

      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromAssignUsers = await createNetworkUtil.assignUsers(
        request
      );

      if (responseFromAssignUsers.success === true) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: responseFromAssignUsers.message,
          updated_network: responseFromAssignUsers.data,
          success: true,
        });
      } else if (responseFromAssignUsers.success === false) {
        const status = responseFromAssignUsers.status
          ? responseFromAssignUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromAssignUsers.message,
          errors: responseFromAssignUsers.errors
            ? responseFromAssignUsers.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error -- ${error.message}`);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  assignOneUser: async (req, res) => {
    try {
      logText("assign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.action = "assignOneUser";
      request.query.tenant = tenant;

      const responseFromUpdateNetwork = await createNetworkUtil.update(request);

      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "successfully assigned a user to the network",
          updated_network: responseFromUpdateNetwork.data,
          success: true,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors: responseFromUpdateNetwork.errors
            ? responseFromUpdateNetwork.errors
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

  unAssignUser: async (req, res) => {
    try {
      logText("assign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.action = "unAssignUser";
      request.query.tenant = tenant;

      const responseFromUpdateUser = await createNetworkUtil.update(request);

      if (responseFromUpdateUser.success === true) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "user successully unassigned",
          updated_network: responseFromUpdateUser.data,
          success: true,
        });
      } else if (responseFromUpdateUser.success === false) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUser.message,
          errors: responseFromUpdateUser.errors
            ? responseFromUpdateUser.errors
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

  setManager: async (req, res) => {
    try {
      logText("assign user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.action = "setManager";
      request.query.tenant = tenant;

      const responseFromUpdateUser = await createNetworkUtil.update(request);

      if (responseFromUpdateUser.success === true) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: "network manager successffuly set",
          updated_network: responseFromUpdateUser.data,
        });
      } else if (responseFromUpdateUser.success === false) {
        const status = responseFromUpdateUser.status
          ? responseFromUpdateUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUpdateUser.message,
          errors: responseFromUpdateUser.errors
            ? responseFromUpdateUser.errors
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

  update: async (req, res) => {
    try {
      logText("update user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      logElement("tenant", tenant);
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromUpdateNetwork = await createNetworkUtil.update(request);

      logObject("responseFromUpdateNetwork", responseFromUpdateNetwork);

      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromUpdateNetwork.message,
          updated_network: responseFromUpdateNetwork.data,
        });
      } else if (responseFromUpdateNetwork.success === false) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromUpdateNetwork.message,
          errors: responseFromUpdateNetwork.errors
            ? responseFromUpdateNetwork.errors
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

  delete: async (req, res) => {
    try {
      logText("delete user....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      logElement("tenant", tenant);
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      /***
       * get the network ID
       * get the user ID
       *
       * remove the network ID from the user
       * update the user status to inactive.
       * remove the user ID from the network
       *
       */

      const responseFromDeleteNetwork = await createNetworkUtil.delete(request);

      logObject("responseFromDeleteNetwork", responseFromDeleteNetwork);

      if (responseFromDeleteNetwork.success === true) {
        const status = responseFromDeleteNetwork.status
          ? responseFromDeleteNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromDeleteNetwork.message,
          deleted_network: responseFromDeleteNetwork.data,
        });
      } else if (responseFromDeleteNetwork.success === false) {
        const status = responseFromDeleteNetwork.status
          ? responseFromDeleteNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromDeleteNetwork.message,
          errors: responseFromDeleteNetwork.errors
            ? responseFromDeleteNetwork.errors
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

  list: async (req, res) => {
    try {
      logText("listing users....");

      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      logElement("tenant", tenant);
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListNetworks = await createNetworkUtil.list(request);

      logObject(
        "responseFromListNetworks in controller",
        responseFromListNetworks
      );

      if (responseFromListNetworks.success === true) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListNetworks.message,
          networks: responseFromListNetworks.data,
        });
      } else if (responseFromListNetworks.success === false) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          message: responseFromListNetworks.message,
          errors: responseFromListNetworks.errors
            ? responseFromListNetworks.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAssignedUsers: async (req, res) => {
    try {
      logText("listing assigned users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }

      let request = Object.assign({}, req);

      request.query.tenant = tenant;

      const responseFromListNetworks = await createNetworkUtil.list(request);

      logObject(
        "responseFromListNetworks in controller",
        responseFromListNetworks
      );

      if (responseFromListNetworks.success === true) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: "successfully retrieved the users for this network",
          assigned_users: responseFromListNetworks.data[0].net_users,
        });
      } else if (responseFromListNetworks.success === false) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListNetworks.message,
          errors: responseFromListNetworks.errors
            ? responseFromListNetworks.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },

  listAvailableUsers: async (req, res) => {
    try {
      logText("listing available users....");
      const hasErrors = !validationResult(req).isEmpty();
      if (hasErrors) {
        let nestedErrors = validationResult(req).errors[0].nestedErrors;
        return badRequest(
          res,
          "bad request errors",
          convertErrorArrayToObject(nestedErrors)
        );
      }

      return res.status(httpStatus.NOT_IMPLEMENTED).json({
        success: true,
        message: "Not Yet Implemented",
      });

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      /**
       * get the list of items existing from this resource
       */

      const responseFromListNetworks = await createNetworkUtil.list(request);

      logObject(
        "responseFromListNetworks in controller",
        responseFromListNetworks
      );

      if (responseFromListNetworks.success === true) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListNetworks.message,
          assigned_users: responseFromListNetworks.data[0].net_users,
        });
      } else if (responseFromListNetworks.success === false) {
        const status = responseFromListNetworks.status
          ? responseFromListNetworks.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          message: responseFromListNetworks.message,
          errors: responseFromListNetworks.errors
            ? responseFromListNetworks.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logElement("internal server error", error.message);
      return res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
      });
    }
  },
};

module.exports = createNetwork;
