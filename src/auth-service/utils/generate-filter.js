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
const { HttpError } = require("@utils/errors");

const {
  addMonthsToProvideDateTime,
  monthsInfront,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
} = require("@utils/date");

const filter = {
  users: (req, next) => {
    try {
      let {
        privilege,
        id,
        username,
        active,
        email_address,
        role_id,
        email,
        resetPasswordToken,
        user,
        user_id,
      } = { ...req.body, ...req.query, ...req.params };

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

      return filter;
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
  networks: (req, next) => {
    try {
      const {
        net_id,
        net_email,
        net_category,
        net_tenant,
        net_status,
        net_phoneNumber,
        net_website,
        net_acronym,
        category,
      } = { ...req.query, ...req.params };

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
      return filter;
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
  candidates: (req, next) => {
    try {
      let { category, id, email_address, email, network_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};
      if (email) {
        filter["email"] = email;
      }
      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
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
      return filter;
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
  requests: (req, next) => {
    try {
      const {
        id,
        user_id,
        requestType,
        targetId,
        status,
        category,
        request_id,
        grp_id,
        net_id,
      } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

      let filter = {};
      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }
      if (requestType) {
        filter["requestType"] = requestType;
      }
      if (targetId) {
        filter["targetId"] = ObjectId(targetId);
      }

      if (grp_id) {
        filter["targetId"] = ObjectId(grp_id);
      }

      if (net_id) {
        filter["targetId"] = ObjectId(net_id);
      }

      if (status) {
        filter["status"] = status;
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (request_id) {
        filter["_id"] = ObjectId(request_id);
      }
      return filter;
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
  defaults: (req, next) => {
    try {
      let {
        id,
        user,
        user_id,
        site,
        airqloud,
        grid,
        cohort,
        group_id,
        network_id,
      } = {
        ...req.query,
        ...req.params,
      };
      let filter = {};
      if (user) {
        filter["user"] = ObjectId(user);
      }

      if (user_id) {
        filter["user"] = ObjectId(user_id);
      }

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (grid) {
        filter["grid"] = ObjectId(grid);
      }

      if (cohort) {
        filter["cohort"] = ObjectId(cohort);
      }

      if (group_id) {
        filter["group_id"] = ObjectId(group_id);
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }

      if (site) {
        filter["site"] = ObjectId(site);
      }

      if (airqloud) {
        filter["airqloud"] = ObjectId(airqloud);
      }

      return filter;
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
  preferences: (req, next) => {
    try {
      let {
        // id,
        user_id,
        // airqloud_id,
        // grid_id,
        // cohort_id,
        // group_id,
        // network_id,
      } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      // if (id) {
      //   filter["_id"] = ObjectId(id);
      // }

      // if (grid_id) {
      //   filter["grid_id"] = ObjectId(grid_id);
      // }

      // if (cohort_id) {
      //   filter["cohort_id"] = ObjectId(cohort_id);
      // }

      // if (airqloud_id) {
      //   filter["airqloud_id"] = ObjectId(airqloud_id);
      // }

      // if (group_id) {
      //   filter["group_id"] = ObjectId(group_id);
      // }

      // if (network_id) {
      //   filter["network_id"] = ObjectId(network_id);
      // }

      return filter;
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
  checklists: (req, next) => {
    try {
      let { id, user_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }

      return filter;
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
  inquiry: (req, next) => {
    try {
      let { category, id, email } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

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

      return filter;
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
  roles: (req, next) => {
    try {
      const { query, params } = req;
      const {
        id,
        role_id,
        role_name,
        role_code,
        network_id,
        net_id,
        grp_id,
        group_id,
        role_status,
        category,
      } = { ...params, ...query };

      const filter = {};

      if (id || role_id) {
        filter["_id"] = ObjectId(id || role_id);
      }
      if (network_id || net_id) {
        filter["network_id"] = ObjectId(network_id || net_id);
      }
      if (grp_id || group_id) {
        filter["group_id"] = ObjectId(grp_id || group_id);
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
  permissions: (req, next) => {
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
  tokens: (req, next) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { token, client_id, name } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (token) {
        filter["token"] = token;
      }

      if (client_id) {
        filter["client_id"] = ObjectId(client_id);
      }

      if (name) {
        filter["name"] = name;
      }

      return filter;
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
  ips: (req, next) => {
    try {
      const { id, ip, range } = {
        ...req.query,
        ...req.params,
      };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (ip) {
        filter["ip"] = ip;
      }

      if (range) {
        filter["range"] = range;
      }

      return filter;
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
  clients: (req, next) => {
    try {
      const { query, params } = req;
      const { id } = query;
      const { client_id, client_name, network_id, client_secret } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (client_id) {
        filter["_id"] = ObjectId(client_id);
      }

      if (client_secret) {
        filter["client_secret"] = client_secret;
      }

      return filter;
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
  scopes: (req, next) => {
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
  departments: (req, next) => {
    try {
      const {
        dep_id,
        user_id,
        dep_email,
        dep_title,
        dep_network_id,
        dep_parent,
        dep_manager,
        has_children,
        dep_acronym,
        dep_children,
        dep_status,
      } = { ...req.query, ...req.params };

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
  groups: (req, next) => {
    try {
      const { grp_title, grp_status, category, grp_id } = {
        ...req.query,
        ...req.params,
      };
      let filter = {};

      if (grp_id) {
        filter["_id"] = ObjectId(grp_id);
      }
      if (grp_status) {
        filter["grp_status"] = grp_status;
      }
      if (grp_title) {
        filter["grp_title"] = grp_title;
      }

      if (category) {
        filter["category"] = category;
      }
      logObject("the filter we are sending", filter);
      return filter;
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
  logs: (req, next) => {
    try {
      const { service, startTime, endTime, email } = req.query;
      const today = monthsInfront(0, next);
      const oneWeekBack = addDays(-7, next);

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
            1,
            next
          );
        } else {
          delete filter["timestamp"];
        }
      }

      if (endTime && isEmpty(startTime)) {
        logText("startTime absent and endTime is present");
        if (isTimeEmpty(endTime) === false) {
          filter["timestamp"]["$lte"] = addMonthsToProvideDateTime(
            endTime,
            -1,
            next
          );
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
              -1,
              next
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
  favorites: (req, next) => {
    try {
      const { query, params } = req;
      const { firebase_user_id, favorite_id, id } = { ...query, ...params };
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
  location_histories: (req, next) => {
    try {
      const { query, params } = req;
      const { firebase_user_id, location_history_id, id } = {
        ...query,
        ...params,
      };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (location_history_id) {
        filter["_id"] = ObjectId(location_history_id);
      }
      if (firebase_user_id) {
        filter["firebase_user_id"] = firebase_user_id;
      }

      return filter;
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
  search_histories: (req, next) => {
    try {
      const { query, params } = req;
      const { firebase_user_id, search_history_id, id } = {
        ...query,
        ...params,
      };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (search_history_id) {
        filter["_id"] = ObjectId(search_history_id);
      }
      if (firebase_user_id) {
        filter["firebase_user_id"] = firebase_user_id;
      }

      return filter;
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

module.exports = filter;
