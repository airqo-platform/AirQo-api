const { logElement, logObject, logText } = require("@utils/log");
const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);

const {
  addMonthsToProvideDateTime,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
} = require("./date");

const filter = {
  users: (req) => {
    try {
      let { privilege, id, username, active, email_address, role_id } =
        req.query;
      let { email, resetPasswordToken, user } = req.body;
      const { user_id } = req.params;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }

      if (role_id) {
        filter["role"] = ObjectId(role_id);
      }

      if (email_address) {
        filter["email"] = email_address;
      }
      if (!isEmpty(resetPasswordToken)) {
        filter["resetPasswordToken"] = resetPasswordToken;
        // filter["resetPasswordExpires"] = {
        //   $gt: Date.now(),
        // };
      }
      if (privilege) {
        filter["privilege"] = privilege;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["_id"] = ObjectId(user_id);
      }
      if (user) {
        filter["_id"] = ObjectId(user);
      }
      if (active) {
        if (active === "yes") {
          filter["isActive"] = true;
        } else if (active === "no") {
          filter["isActive"] = false;
        }
      }
      if (username) {
        filter["userName"] = username;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
      };
    }
  },
  networks: (req) => {
    try {
      const {
        net_email,
        net_category,
        net_tenant,
        net_status,
        net_phoneNumber,
        net_website,
        net_acronym,
        category,
      } = req.query;

      const { net_id } = req.params;

      let filter = {};
      if (net_email) {
        filter["net_email"] = net_email;
      }
      if (category) {
        filter["category"] = category;
      }

      if (net_category) {
        filter["net_category"] = net_category;
      }

      if (net_id) {
        filter["_id"] = ObjectId(net_id);
      }

      if (net_tenant) {
        filter["net_tenant"] = net_tenant;
      }
      if (net_acronym) {
        filter["net_acronym"] = net_acronym;
      }

      if (net_phoneNumber) {
        filter["net_phoneNumber"] = net_phoneNumber;
      }
      if (net_website) {
        filter["net_website"] = net_website;
      }
      if (net_status) {
        filter["net_status"] = net_status;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
      };
    } catch (err) {
      logger.error(`internal server error, ${JSON.stringify(err)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  candidates: (req) => {
    try {
      let { category, id, email_address } = req.query;
      let { email } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (email_address) {
        filter["email"] = email_address;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`Internal Server Error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  defaults: (req) => {
    try {
      let { id, user, site, airqloud } = req.query;
      let filter = {};
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (site) {
        filter["site"] = ObjectId(site);
      }

      if (airqloud) {
        filter["airqloud"] = ObjectId(airqloud);
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  inquiry: (req) => {
    try {
      let { category, id } = req.query;
      let { email } = req.body;
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = id;
      }
      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  defaults_v2: (req) => {
    try {
      let { id, user, user_id, airqloud, airqloud_id, site, site_id } =
        req.query;
      let filter = {
        site_ids: {},
        sites: {},
        airqloud_ids: {},
        airqlouds: {},
      };

      /*** user id */
      if (user) {
        filter["user"] = ObjectId(user);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      /** airqloud_id */
      if (airqloud_id) {
        let airqloudIdArray = airqloud_id.split(",");
        let modifiedAirQloudIdArray = airqloudIdArray.map((airqloud_id) => {
          return ObjectId(airqloud_id);
        });
        filter["airqloud_ids"]["$in"] = modifiedAirQloudIdArray;
      }

      if (!airqloud_id) {
        delete filter["airqloud_ids"];
      }

      /*** airqloud */
      if (airqloud) {
        filter["airqlouds"] = airqloud;
      }
      if (!airqloud) {
        delete filter["airqlouds"];
      }

      /**
       * site_id
       */
      if (site_id) {
        let siteIdArray = site_id.split(",");
        let modifiedSiteIdArray = siteIdArray.map((site_id) => {
          return ObjectId(site_id);
        });
        filter["site_ids"]["$in"] = modifiedSiteIdArray;
      }

      if (!site_id) {
        delete filter["site_ids"];
      }

      /** site */
      if (site) {
        let siteArray = site.split(",");
        filter["sites"]["$in"] = siteArray;
      }

      if (!site) {
        delete filter["sites"];
      }

      return {
        success: true,
        message: "successfully created the filter",
        data: filter,
        status: httpStatus.OK,
      };
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        error: e.message,
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  roles: (req) => {
    try {
      const { query, params } = req;
      const { id, role_name, role_code, network_id, role_status, category } =
        query;
      const { role_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (role_id) {
        filter["_id"] = ObjectId(role_id);
      }
      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (category) {
        filter["category"] = category;
      }

      if (role_name) {
        filter["role_name"] = role_name;
      }
      if (role_code) {
        filter["role_code"] = role_code;
      }
      if (role_status) {
        filter["role_status"] = role_status;
      }
      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  permissions: (req) => {
    try {
      const { query, params } = req;
      const { id, network, permission } = query;
      const { permission_id, network_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (permission_id) {
        filter["permission"] = permission_id;
      }

      if (network) {
        filter["network_id"] = ObjectId(network);
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (permission) {
        filter["permission"] = permission;
      }

      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  tokens: (req) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { token, user_id, network_id, client_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (token) {
        filter["token"] = token;
      }

      if (client_id) {
        filter["client_id"] = client_id;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (user_id) {
        filter[" user_id"] = ObjectId(user_id);
      }
      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  clients: (req) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { client_id, client_name, network_id, client_secret } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (client_id) {
        filter["client_id"] = client_id;
      }

      if (client_secret) {
        filter["client_secret"] = client_secret;
      }

      if (client_name) {
        filter["name"] = client_name;
      }

      if (network_id) {
        const networksArray = network_id.split(",");
        const arrayOfNetworkObjects = networksArray.map((value) => {
          ObjectId(value);
        });
        filter["networks"] = {};
        filter["networks"]["$in"] = arrayOfNetworkObjects;
      }

      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  scopes: (req) => {
    try {
      const { query, params } = req;
      const { id, scope } = query;
      const { scope_id, network_id } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (scope_id) {
        filter["scope"] = scope_id;
      }

      if (scope) {
        filter["scope"] = scope;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }
      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  departments: (req) => {
    try {
      const {
        dep_email,
        dep_title,
        dep_network_id,
        dep_parent,
        dep_manager,
        has_children,
        dep_acronym,
        dep_children,
        dep_status,
      } = req.query;

      const { dep_id, user_id } = req.params;

      let filter = {};

      if (dep_id) {
        filter["_id"] = ObjectId(dep_id);
      }

      if (dep_status) {
        filter["net_status"] = dep_status;
      }

      if (dep_network_id) {
        filter["dep_network_id"] = ObjectId(dep_network_id);
      }

      if (dep_children) {
        filter["dep_children"] = dep_children;
      }
      return filter;
    } catch (err) {
      logger.error(`internal server error, ${JSON.stringify(err)}`);
      return {
        success: false,
        message: "internal server error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  groups: (req) => {
    try {
      const {
        grp_title,
        grp_status,
        grp_network_id,
        grp_users,
        grp_description,
        grp_tasks,
      } = req.query;

      const { grp_id } = req.params;

      let filter = {};
      if (grp_id) {
        filter["_id"] = ObjectId(grp_id);
      }
      if (grp_status) {
        filter["grp_status"] = grp_status;
      }
      if (grp_network_id) {
        filter["grp_network_id"] = ObjectId(grp_network_id);
      }

      if (grp_users) {
        let groupUsersArray = grp_users.split(",");
        let modifiedGroupUsersArray = groupUsersArray.map((grp_user) => {
          return ObjectId(grp_user);
        });
        filter["grp_users"]["$in"] = modifiedGroupUsersArray;
      }

      if (grp_description) {
        filter["grp_description"] = grp_description;
      }

      if (grp_tasks) {
        filter["grp_tasks"] = grp_tasks;
      }

      if (grp_title) {
        filter["grp_title"] = grp_title;
      }

      return filter;
    } catch (err) {
      logger.error(`internal server error, ${JSON.stringify(err)}`);
      return {
        success: false,
        message: "internal server error",
        errors: { message: err.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  logs: (req) => {
    try {
      const { service, startTime, endTime, email } = req.query;
      const today = monthsInfront(0);
      const oneWeekBack = addDays(-7);

      let filter = {
        timestamp: {
          $gte: oneWeekBack,
          $lte: today,
        },
      };

      if (service) {
        logText("service present ");
        filter["meta.service"] = service;
      }

      if (startTime && isEmpty(endTime)) {
        logText("startTime present and endTime is missing");
        if (isTimeEmpty(startTime) === false) {
          filter["timestamp"]["$gte"] = addMonthsToProvideDateTime(
            startTime,
            1
          );
        } else {
          delete filter["timestamp"];
        }
      }

      if (endTime && isEmpty(startTime)) {
        logText("startTime absent and endTime is present");
        if (isTimeEmpty(endTime) === false) {
          filter["timestamp"]["$lte"] = addMonthsToProvideDateTime(endTime, -1);
        } else {
          delete filter["timestamp"];
        }
      }

      if (endTime && startTime) {
        logText("startTime present and endTime is also present");
        let months = getDifferenceInMonths(startTime, endTime);
        logElement("the number of months", months);
        if (months > 1) {
          if (isTimeEmpty(endTime) === false) {
            filter["timestamp"]["$lte"] = addMonthsToProvideDateTime(
              endTime,
              -1
            );
          } else {
            delete filter["timestamp"];
          }
        }
      }

      if (email) {
        logText("email present ");
        filter["meta.email"] = email;
      }

      return filter;
    } catch (error) {
      logObject("error", error);
      logger.error(`Internal Server Error`, error.message);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  favorites: (req) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { firebase_user_id, favorite_id } = params;
      let filter = {};
      
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (favorite_id) {
        filter["_id"] = ObjectId(favorite_id);
      }
      if (firebase_user_id) {
        filter["firebase_user_id"] = firebase_user_id;
      }

      return filter;
    } catch (e) {
      logger.error(`internal server error, ${JSON.stringify(e)}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: e.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = filter;
