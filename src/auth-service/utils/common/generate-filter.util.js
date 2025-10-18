const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- generate-filter-util`
);
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

const {
  addMonthsToProvideDateTime,
  monthsInfront,
  addMonthsToProvidedDate,
  isTimeEmpty,
  getDifferenceInMonths,
  addDays,
} = require("./date.util");

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
        login_count,
      } = { ...req.body, ...req.query, ...req.params };

      let filter = {};

      if (email) {
        filter["email"] = email.toLowerCase().trim();
      }

      if (role_id) {
        filter["role"] = ObjectId(role_id);
      }

      if (email_address) {
        filter["email"] = email_address.toLowerCase().trim();
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

      if (login_count) {
        filter["login_count"] = parseInt(login_count);
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  guest_users: (req, next) => {
    try {
      let { id, guest_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      if (guest_id) {
        filter["guest_id"] = guest_id;
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  tenantSettings: (req, next) => {
    try {
      const { query, params } = req;
      const { tenant, id } = { ...query, ...params };

      let filter = {};
      if (tenant) {
        filter.tenant = tenant.toLowerCase();
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
        filter["net_email"] = net_email.toLowerCase().trim();
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  transactions: (req, next) => {
    try {
      const {
        paddle_transaction_id,
        paddle_event_type,
        user_id,
        paddle_customer_id,
        amount,
        currency,
        payment_method,
        status,
        description,
        metadata,
        donation_campaign_id,
      } = { ...req.query, ...req.params };

      let filter = {};

      if (paddle_transaction_id) {
        filter["paddle_transaction_id"] = paddle_transaction_id;
      }

      if (paddle_event_type) {
        filter["paddle_event_type"] = paddle_event_type;
      }

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      if (paddle_customer_id) {
        filter["paddle_customer_id"] = paddle_customer_id;
      }

      if (amount) {
        filter["amount"] = amount;
      }

      if (currency) {
        filter["currency"] = currency;
      }

      if (payment_method) {
        filter["payment_method"] = payment_method;
      }

      if (status) {
        filter["status"] = status;
      }

      if (description) {
        filter["description"] = description;
      }

      if (metadata) {
        filter["metadata"] = metadata;
      }

      if (donation_campaign_id) {
        filter["donation_campaign_id"] = ObjectId(donation_campaign_id);
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  campaigns: (req, next) => {
    try {
      const {
        title,
        description,
        created_by,
        target_amount,
        current_amount,
        currency,
        start_date,
        end_date,
        status,
        is_public,
        category,
        tags,
      } = { ...req.query, ...req.params, ...req.body }; // Include req.body

      let filter = {};

      if (title) {
        filter.title = { $regex: title, $options: "i" }; // Case-insensitive search
      }

      if (description) {
        filter.description = { $regex: description, $options: "i" };
      }

      if (created_by) {
        filter.created_by = ObjectId(created_by);
      }

      if (target_amount) {
        filter.target_amount = target_amount;
      }

      if (current_amount) {
        filter.current_amount = current_amount;
      }

      if (currency) {
        filter.currency = currency.toUpperCase(); // Ensure consistent case
      }

      if (start_date) {
        filter.start_date = { $gte: new Date(start_date) }; // Greater than or equal
      }

      if (end_date) {
        filter.end_date = { $lte: new Date(end_date) }; // Less than or equal
      }

      if (status) {
        filter.status = status;
      }

      if (is_public !== undefined) {
        // Handle boolean values correctly
        filter.is_public = is_public;
      }

      if (category) {
        filter.category = category;
      }

      if (tags) {
        // Check if tags are provided
        if (Array.isArray(tags)) {
          //If an array of tags is provided
          filter.tags = { $all: tags }; // Match all tags in the array
        } else if (typeof tags === "string") {
          //If a single tag string is provided
          filter.tags = tags; // Match the single tag
        }
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
        filter["email"] = email.toLowerCase().trim();
      }
      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }
      if (email_address) {
        filter["email"] = email_address.toLowerCase().trim();
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = ObjectId(id);
      }
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  preferences: (req, next) => {
    try {
      let { user_id, group_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };

      let filter = {};

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      if (group_id) {
        filter["group_id"] = ObjectId(group_id);
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  maintenances: (req, next) => {
    try {
      let { id, product } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (product) {
        filter["product"] = product;
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  selected_sites: (req, next) => {
    try {
      let { site_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};
      if (site_id) {
        filter["site_id"] = site_id;
      }
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  checklists: (req, next) => {
    try {
      const { id, user_id, checklist_id } = {
        ...req.body,
        ...req.query,
        ...req.params,
      };
      let filter = {};

      // Prioritize user_id as it's the main identifier for checklists
      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      // Use 'id' or 'checklist_id' for filtering by the document's _id
      if (id || checklist_id) {
        filter["_id"] = ObjectId(id || checklist_id);
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
        filter["email"] = email.toLowerCase().trim();
      }
      if (category) {
        filter["category"] = category;
      }
      if (id) {
        filter["_id"] = id;
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
        permission_filter,
        user_id,
        include_permissions,
      } = { ...params, ...query };

      const filter = {};
      const options = {};

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

      // New filtering options
      if (permission_filter) {
        options.permission_filter = Array.isArray(permission_filter)
          ? permission_filter
          : [permission_filter];
      }

      if (user_id) {
        options.user_filter = ObjectId(user_id);
      }

      if (include_permissions !== undefined) {
        options.include_permissions = include_permissions === "true";
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  tokens: (req, next) => {
    try {
      const { query, params } = req;
      const { token, client_id, name, id, emailed } = { ...query, ...params };
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (token) {
        filter["token"] = token;
      }

      if (emailed) {
        filter.expiredEmailSent = emailed.toLowerCase() === "yes";
      }

      if (client_id) {
        filter["client_id"] = ObjectId(client_id);
      }

      if (name) {
        filter["name"] = name;
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  ips: (req, next) => {
    try {
      const { id, ip, range, ip_counts, prefix, prefix_counts } = {
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

      if (prefix) {
        filter["prefix"] = prefix;
      }

      if (ip_counts) {
        filter["ipCounts"] = {
          $elemMatch: {
            count: {
              $gte: parseInt(ip_counts),
            },
          },
        };
      }

      if (prefix_counts) {
        filter["prefixCounts"] = {
          $elemMatch: {
            count: {
              $gte: parseInt(prefix_counts),
            },
          },
        };
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  clients: (req, next) => {
    try {
      const { query, params } = req;
      const { id, user_id } = query;
      const { client_id, client_name, network_id, client_secret } = params;
      let filter = {};

      if (id) {
        filter["_id"] = ObjectId(id);
      }

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      if (client_id) {
        filter["_id"] = ObjectId(client_id);
      }

      if (client_secret) {
        filter["client_secret"] = client_secret;
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  scopes: (req, next) => {
    try {
      const { id, scope, scope_id, network_id } = {
        ...req.query,
        ...req.params,
      };
      let filter = {};

      // Prioritize 'id' over 'scope_id' for filtering by document _id
      if (id) {
        filter["_id"] = ObjectId(id);
      } else if (scope_id) {
        filter["_id"] = ObjectId(scope_id); // Use scope_id as a fallback
      }

      if (scope) {
        filter["scope"] = scope;
      }

      if (network_id) {
        filter["network_id"] = ObjectId(network_id);
      }
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  logs: (req, next) => {
    try {
      const { service, startTime, endTime, email } = req.query;
      const today = monthsInfront(0, next);
      const oneWeekBack = addDays(-7, next);
      logObject("the req.query in the logs filter", req.query);

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
          filter["timestamp"]["$lte"] = addMonthsToProvidedDate(
            startTime,
            1,
            next
          );
        }
      } else if (endTime && isEmpty(startTime)) {
        logText("startTime absent and endTime is present");
        if (isTimeEmpty(endTime) === false) {
          filter["timestamp"]["$lte"] = addMonthsToProvideDateTime(
            endTime,
            -1,
            next
          );
        } else {
          filter["timestamp"]["$lte"] = addMonthsToProvidedDate(
            endTime,
            -1,
            next
          );
        }
      } else if (endTime && startTime) {
        logText("startTime present and endTime is also present");
        filter["timestamp"]["$lte"] = new Date(endTime);
        filter["timestamp"]["$gte"] = new Date(startTime);
      }

      if (email) {
        logText("email present ");
        filter["meta.email"] = email.toLowerCase().trim();
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  activities: (req, next) => {
    try {
      const { service, startTime, endTime, email, tenant } = req.query;
      const today = monthsInfront(0, next);
      const oneWeekBack = addDays(-7, next);

      logObject("the req.query in the activity filter", req.query);

      // Base filter
      let filter = {};

      // Handle required tenant field
      if (!tenant) {
        throw new Error("Tenant is required");
      }
      filter.tenant = tenant;

      // Handle email filtering
      if (email) {
        filter.email = email.toLowerCase().trim();
      }

      // Date range handling for dailyStats
      let dateFilter = {};
      if (startTime && !endTime) {
        logText("startTime present and endTime is missing");
        if (!isTimeEmpty(startTime)) {
          dateFilter.$gte = addMonthsToProvideDateTime(startTime, 1, next);
        } else {
          dateFilter.$gte = addMonthsToProvidedDate(startTime, 1, next);
        }
      } else if (endTime && !startTime) {
        logText("startTime absent and endTime is present");
        if (!isTimeEmpty(endTime)) {
          dateFilter.$lte = addMonthsToProvideDateTime(endTime, -1, next);
        } else {
          dateFilter.$lte = addMonthsToProvidedDate(endTime, -1, next);
        }
      } else if (endTime && startTime) {
        logText("startTime present and endTime is also present");
        dateFilter.$lte = new Date(endTime);
        dateFilter.$gte = new Date(startTime);
      } else {
        // Default to one week range
        dateFilter.$gte = oneWeekBack;
        dateFilter.$lte = today;
      }

      // Apply date filter to dailyStats
      if (Object.keys(dateFilter).length > 0) {
        filter["dailyStats"] = {
          $elemMatch: {
            date: dateFilter,
          },
        };
      }

      // Service filtering
      if (service) {
        logText("service present");
        // Add service filter to the dailyStats elemMatch
        if (filter.dailyStats && filter.dailyStats.$elemMatch) {
          filter.dailyStats.$elemMatch["services"] = {
            $elemMatch: { name: service },
          };
        } else {
          filter.dailyStats = {
            $elemMatch: {
              services: {
                $elemMatch: { name: service },
              },
            },
          };
        }

        // Also check monthly stats for the service
        filter["monthlyStats"] = {
          $elemMatch: {
            uniqueServices: service,
          },
        };
      }

      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
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
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  userRoles: (req, next) => {
    try {
      const { query, params } = req;
      const {
        user_id,
        group_id,
        network_id,
        role_id,
        include_all_groups,
        include_all_networks,
        permission_filter,
        role_status,
      } = { ...query, ...params };

      let filter = {};
      let options = {};

      // User ID filter
      if (user_id) {
        filter["_id"] = ObjectId(user_id);
      }

      // Group-specific filtering
      if (group_id) {
        options.group_filter = ObjectId(group_id);
        if (!include_all_groups) {
          // This will be used in the aggregation pipeline
          options.group_only = true;
        }
      }

      // Network-specific filtering
      if (network_id) {
        options.network_filter = ObjectId(network_id);
        if (!include_all_networks) {
          options.network_only = true;
        }
      }

      // Role-specific filtering
      if (role_id) {
        options.role_filter = ObjectId(role_id);
      }

      // Permission-based filtering
      if (permission_filter) {
        options.permission_filter = Array.isArray(permission_filter)
          ? permission_filter
          : [permission_filter];
      }

      // Role status filtering
      if (role_status) {
        options.role_status_filter = role_status;
      }

      // Include boolean options
      if (include_all_groups !== undefined) {
        options.include_all_groups = include_all_groups === "true";
      }

      if (include_all_networks !== undefined) {
        options.include_all_networks = include_all_networks === "true";
      }

      return { filter, options };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  userPermissions: (req, next) => {
    try {
      const { query, params } = req;
      const {
        user_id,
        group_id,
        network_id,
        permission_names,
        check_specific_permissions,
      } = { ...query, ...params };

      let filter = {};
      let options = {};

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      if (group_id) {
        options.group_filter = ObjectId(group_id);
      }

      if (network_id) {
        options.network_filter = ObjectId(network_id);
      }

      // Specific permission names to check
      if (permission_names) {
        options.permission_names = Array.isArray(permission_names)
          ? permission_names
          : permission_names.split(",").map((p) => p.trim());
      }

      // Whether to perform specific permission checks
      if (check_specific_permissions !== undefined) {
        options.check_specific_permissions =
          check_specific_permissions === "true";
      }

      return { filter, options };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  bulkPermissions: (req, next) => {
    try {
      const { body, params, query } = req;
      const { user_id } = params;
      const { tenant } = query;
      const { group_ids, network_ids, permissions } = body;

      let filter = {};
      let options = {};

      if (user_id) {
        filter["user_id"] = ObjectId(user_id);
      }

      if (tenant) {
        options.tenant = tenant;
      }

      // Multiple group IDs for bulk checking
      if (group_ids && Array.isArray(group_ids)) {
        options.group_ids = group_ids.map((id) => ObjectId(id));
      }

      // Multiple network IDs for bulk checking
      if (network_ids && Array.isArray(network_ids)) {
        options.network_ids = network_ids.map((id) => ObjectId(id));
      }

      // Specific permissions to check
      if (permissions && Array.isArray(permissions)) {
        options.permissions_to_check = permissions;
      }

      return { filter, options };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  surveys: (request, next) => {
    try {
      const {
        survey_id,
        title,
        isActive,
        expiresAt,
        trigger_type,
        created_before,
        created_after,
      } = {
        ...request.query,
        ...request.params,
      };

      let filter = {};

      // Filter by survey ID
      if (!isEmpty(survey_id)) {
        filter._id = ObjectId(survey_id);
      }

      // Filter by title (partial match, case insensitive)
      if (!isEmpty(title)) {
        filter.title = { $regex: title.trim(), $options: "i" };
      }

      // Filter by active status
      if (isActive !== undefined) {
        filter.isActive = isActive === "true" || isActive === true;
      }

      // Filter by expiration date
      if (!isEmpty(expiresAt)) {
        if (expiresAt === "not_expired") {
          filter.$or = [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } },
          ];
        } else if (expiresAt === "expired") {
          filter.expiresAt = { $lte: new Date() };
        }
      }

      // Filter by trigger type
      if (!isEmpty(trigger_type)) {
        filter["trigger.type"] = trigger_type.trim();
      }

      // Filter by creation date range
      if (!isEmpty(created_before) || !isEmpty(created_after)) {
        filter.createdAt = {};
        if (!isEmpty(created_before)) {
          filter.createdAt.$lt = new Date(created_before);
        }
        if (!isEmpty(created_after)) {
          filter.createdAt.$gt = new Date(created_after);
        }
      }

      logObject("survey filter", filter);
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },

  surveyResponses: (request) => {
    try {
      const {
        response_id,
        survey_id,
        surveyId,
        user_id,
        userId,
        status,
        completed_before,
        completed_after,
        started_before,
        started_after,
      } = {
        ...request.query,
        ...request.params,
      };

      let filter = {};

      // Filter by response ID (using MongoDB _id)
      if (!isEmpty(response_id)) {
        try {
          filter._id = ObjectId(response_id);
        } catch (error) {
          throw new Error("Invalid response_id format");
        }
      }

      // Filter by survey ID (support both survey_id and surveyId)
      if (!isEmpty(survey_id)) {
        filter.surveyId = ObjectId(survey_id);
      } else if (!isEmpty(surveyId)) {
        filter.surveyId = ObjectId(surveyId);
      }

      // Filter by user ID (support both user_id and userId)
      if (!isEmpty(user_id)) {
        filter.userId = ObjectId(user_id);
      } else if (!isEmpty(userId)) {
        filter.userId = ObjectId(userId);
      }

      // Filter by response status
      if (!isEmpty(status)) {
        filter.status = status.trim();
      }

      // Filter by completion date range
      if (!isEmpty(completed_before) || !isEmpty(completed_after)) {
        filter.completedAt = {};
        if (!isEmpty(completed_before)) {
          filter.completedAt.$lt = new Date(completed_before);
        }
        if (!isEmpty(completed_after)) {
          filter.completedAt.$gt = new Date(completed_after);
        }
      }

      // Filter by start date range
      if (!isEmpty(started_before) || !isEmpty(started_after)) {
        filter.startedAt = {};
        if (!isEmpty(started_before)) {
          filter.startedAt.$lt = new Date(started_before);
        }
        if (!isEmpty(started_after)) {
          filter.startedAt.$gt = new Date(started_after);
        }
      }

      logObject("survey response filter", filter);
      return filter;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      return next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

module.exports = filter;
