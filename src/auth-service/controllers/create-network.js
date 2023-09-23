const { logElement, logText, logObject } = require("@utils/log");
const httpStatus = require("http-status");
const createNetworkUtil = require("@utils/create-network");
const { validationResult } = require("express-validator");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-controller`
);
const controlAccessUtil = require("@utils/control-access");

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

      logObject(
        "responseFromCreateNetwork in controller",
        responseFromCreateNetwork
      );

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
      logObject("the error in production", err);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    }
  },

  assignUsers: async (req, res) => {
    try {
      logText("assign many users....");
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
      logText("assign one user....");
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

      const responseFromUpdateNetwork = await createNetworkUtil.assignOneUser(
        request
      );

      if (responseFromUpdateNetwork.success === true) {
        const status = responseFromUpdateNetwork.status
          ? responseFromUpdateNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromUpdateNetwork.message,
          updated_records: responseFromUpdateNetwork.data,
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
      logText("unAssign user....");
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

      const responseFromUnassignUser = await createNetworkUtil.unAssignUser(
        request
      );

      logObject("responseFromUnassignUser", responseFromUnassignUser);

      if (responseFromUnassignUser.success === true) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "user successully unassigned",
          updated_records: responseFromUnassignUser.data,
          success: true,
        });
      } else if (responseFromUnassignUser.success === false) {
        const status = responseFromUnassignUser.status
          ? responseFromUnassignUser.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignUser.message,
          errors: responseFromUnassignUser.errors
            ? responseFromUnassignUser.errors
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

  unAssignManyUsers: async (req, res) => {
    try {
      logText("unAssign user....");
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

      const responseFromUnassignManyUsers =
        await createNetworkUtil.unAssignManyUsers(request);

      logObject("responseFromUnassignManyUsers", responseFromUnassignManyUsers);

      if (responseFromUnassignManyUsers.success === true) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          message: "users successully unassigned",
          updated_records: responseFromUnassignManyUsers.data,
          success: true,
        });
      } else if (responseFromUnassignManyUsers.success === false) {
        const status = responseFromUnassignManyUsers.status
          ? responseFromUnassignManyUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromUnassignManyUsers.message,
          errors: responseFromUnassignManyUsers.errors
            ? responseFromUnassignManyUsers.errors
            : { message: "Internal Server Errors" },
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
      logText("set the manager....");
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

      const responseFromSetManager = await createNetworkUtil.setManager(
        request
      );

      if (responseFromSetManager.success === true) {
        const status = responseFromSetManager.status
          ? responseFromSetManager.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: "Network manager successffuly set",
          updated_network: responseFromSetManager.data,
        });
      } else if (responseFromSetManager.success === false) {
        const status = responseFromSetManager.status
          ? responseFromSetManager.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromSetManager.message,
          errors: responseFromSetManager.errors
            ? responseFromSetManager.errors
            : { message: "Internal Server Error" },
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

  refresh: async (req, res) => {
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

      const responseFromRefreshNetwork = await createNetworkUtil.refresh(
        request
      );

      logObject("responseFromRefreshNetwork", responseFromRefreshNetwork);

      if (responseFromRefreshNetwork.success === true) {
        const status = responseFromRefreshNetwork.status
          ? responseFromRefreshNetwork.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromRefreshNetwork.message,
          refreshed_network: responseFromRefreshNetwork.data || {},
        });
      } else if (responseFromRefreshNetwork.success === false) {
        const status = responseFromRefreshNetwork.status
          ? responseFromRefreshNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromRefreshNetwork.message,
          errors: responseFromRefreshNetwork.errors
            ? responseFromRefreshNetwork.errors
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

  listSummary: async (req, res) => {
    try {
      logText("listing summary of network....");

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
        tenant = constants.DEFAULT_TENANT || "airqo";
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;
      request.query.category = "summary";

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

  listRolesForNetwork: async (req, res) => {
    try {
      logText("unAssignPermissionFromRole....");
      const { query, body } = req;
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

      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request["query"]["tenant"] = tenant;

      const responseFromListRolesForNetwork =
        await controlAccessUtil.listRolesForNetwork(request);

      if (responseFromListRolesForNetwork.success === true) {
        const status = responseFromListRolesForNetwork.status
          ? responseFromListRolesForNetwork.status
          : httpStatus.OK;
        return res.status(status).json({
          success: true,
          message: responseFromListRolesForNetwork.message,
          network_roles: responseFromListRolesForNetwork.data,
        });
      } else if (responseFromListRolesForNetwork.success === false) {
        const status = responseFromListRolesForNetwork.status
          ? responseFromListRolesForNetwork.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListRolesForNetwork.message,
          errors: responseFromListRolesForNetwork.errors
            ? responseFromListRolesForNetwork.errors
            : { message: "" },
        });
      }
    } catch (error) {
      logger.error(`internal server error -- ${error.message}`);
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

      const responseFromListAssignedUsers =
        await createNetworkUtil.listAssignedUsers(request);

      logObject(
        "responseFromListAssignedUsers in controller",
        responseFromListAssignedUsers
      );

      if (responseFromListAssignedUsers.success === true) {
        const status = responseFromListAssignedUsers.status
          ? responseFromListAssignedUsers.status
          : httpStatus.OK;
        if (responseFromListAssignedUsers.data.length === 0) {
          return res.status(status).json({
            success: true,
            message: "no assigned users to this network",
            assigned_users: [],
          });
        }
        return res.status(status).json({
          success: true,
          message: responseFromListAssignedUsers.message,
          assigned_users: responseFromListAssignedUsers.data,
        });
      } else if (responseFromListAssignedUsers.success === false) {
        const status = responseFromListAssignedUsers.status
          ? responseFromListAssignedUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;

        return res.status(status).json({
          success: false,
          message: responseFromListAssignedUsers.message,
          errors: responseFromListAssignedUsers.errors
            ? responseFromListAssignedUsers.errors
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

      let { tenant } = req.query;
      if (isEmpty(tenant)) {
        tenant = constants.DEFAULT_TENANT;
      }
      let request = Object.assign({}, req);
      request.query.tenant = tenant;

      const responseFromListAvailableUsers =
        await createNetworkUtil.listAvailableUsers(request);

      logObject(
        "responseFromListAvailableUsers in controller",
        responseFromListAvailableUsers
      );

      if (responseFromListAvailableUsers.success === true) {
        const status = responseFromListAvailableUsers.status
          ? responseFromListAvailableUsers.status
          : httpStatus.OK;

        return res.status(status).json({
          success: true,
          message: responseFromListAvailableUsers.message,
          available_users: responseFromListAvailableUsers.data,
        });
      } else if (responseFromListAvailableUsers.success === false) {
        const status = responseFromListAvailableUsers.status
          ? responseFromListAvailableUsers.status
          : httpStatus.INTERNAL_SERVER_ERROR;
        return res.status(status).json({
          success: false,
          message: responseFromListAvailableUsers.message,
          errors: responseFromListAvailableUsers.errors
            ? responseFromListAvailableUsers.errors
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
