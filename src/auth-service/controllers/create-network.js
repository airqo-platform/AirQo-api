const { logText } = require("@utils/log");
const httpStatus = require("http-status");
const createNetworkUtil = require("@utils/create-network");
const { extractErrorsFromRequest, HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-controller`
);
const controlAccessUtil = require("@utils/control-access");

const createNetwork = {
  getNetworkFromEmail: async (req, res, next) => {
    try {
      logText("getNetworkFromEmail....");
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

      const responseFromGetNetworkFromEmail =
        await createNetworkUtil.getNetworkFromEmail(request, next);

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
  create: async (req, res, next) => {
    try {
      logText("we are creating the network....");
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

      const responseFromCreateNetwork = await createNetworkUtil.create(
        request,
        next
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
  assignUsers: async (req, res, next) => {
    try {
      logText("assign many users....");
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

      const responseFromAssignUsers = await createNetworkUtil.assignUsersHybrid(
        request,
        next
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
  assignOneUser: async (req, res, next) => {
    try {
      logText("assign one network...");
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

      const responseFromUpdateNetwork = await createNetworkUtil.assignOneUser(
        request,
        next
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
  unAssignUser: async (req, res, next) => {
    try {
      logText("unAssign network...");
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

      const responseFromUnassignUser = await createNetworkUtil.unAssignUser(
        request,
        next
      );

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
  unAssignManyUsers: async (req, res, next) => {
    try {
      logText("unAssign network...");
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

      const responseFromUnassignManyUsers =
        await createNetworkUtil.unAssignManyUsers(request, next);

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
  setManager: async (req, res, next) => {
    try {
      logText("set the manager....");
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

      const responseFromSetManager = await createNetworkUtil.setManager(
        request,
        next
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
      logText("update network...");
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

      const responseFromUpdateNetwork = await createNetworkUtil.update(
        request,
        next
      );

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
  refresh: async (req, res, next) => {
    try {
      logText("refresh network....");
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

      const responseFromRefreshNetwork = await createNetworkUtil.refresh(
        request,
        next
      );

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
      logText("delete network....");
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

      /***
       * get the network ID
       * get the user ID
       *
       * remove the network ID from the user
       * update the user status to inactive.
       * remove the user ID from the network
       *
       */

      const responseFromDeleteNetwork = await createNetworkUtil.delete(
        request,
        next
      );

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
      logText("listing networks....");
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

      const responseFromListNetworks = await createNetworkUtil.list(
        request,
        next
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
  listSummary: async (req, res, next) => {
    try {
      logText("listing summary of network....");
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
      request.query.category = "summary";

      const responseFromListNetworks = await createNetworkUtil.list(
        request,
        next
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
  listRolesForNetwork: async (req, res, next) => {
    try {
      logText("listRolesForNetwork....");
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

      const responseFromListRolesForNetwork =
        await controlAccessUtil.listRolesForNetwork(request, next);

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
  listAssignedUsers: async (req, res, next) => {
    try {
      logText("listing assigned users....");
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

      const responseFromListAssignedUsers =
        await createNetworkUtil.listAssignedUsers(request, next);

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
  listAvailableUsers: async (req, res, next) => {
    try {
      logText("listing available users....");
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

      const responseFromListAvailableUsers =
        await createNetworkUtil.listAvailableUsers(request, next);

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

module.exports = createNetwork;
