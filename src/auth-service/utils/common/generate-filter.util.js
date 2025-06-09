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

// ====================== VALIDATION STRATEGIES ======================
class ValidationStrategy {
  validate(value, fieldName) {
    throw new Error("Validation strategy must implement validate method");
  }
}

class ObjectIdValidationStrategy extends ValidationStrategy {
  validate(value, fieldName) {
    if (!value) return null;

    if (typeof value !== "string" && typeof value !== "object") {
      logger.warn(
        `Invalid type for ${fieldName}: expected string or ObjectId, got ${typeof value}`
      );
      return null;
    }

    if (mongoose.Types.ObjectId.isValid(value)) {
      try {
        return new ObjectId(value);
      } catch (error) {
        logger.warn(
          `Failed to create ObjectId for ${fieldName}: ${value} - ${error.message}`
        );
        return null;
      }
    }

    logger.warn(`Invalid ObjectId format for ${fieldName}: ${value}`);
    return null;
  }
}

class StringValidationStrategy extends ValidationStrategy {
  validate(value, fieldName) {
    if (!value) return null;
    return typeof value === "string" ? value.trim() : String(value).trim();
  }
}

class BooleanValidationStrategy extends ValidationStrategy {
  validate(value, fieldName) {
    if (value === undefined || value === null) return null;
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase();
      if (lower === "true" || lower === "yes") return true;
      if (lower === "false" || lower === "no") return false;
    }
    return null;
  }
}

class NumberValidationStrategy extends ValidationStrategy {
  validate(value, fieldName) {
    if (!value) return null;
    const num = parseInt(value, 10);
    return isNaN(num) ? null : num;
  }
}

// ====================== VALIDATOR FACTORY ======================
class ValidatorFactory {
  static strategies = {
    objectId: new ObjectIdValidationStrategy(),
    string: new StringValidationStrategy(),
    boolean: new BooleanValidationStrategy(),
    number: new NumberValidationStrategy(),
  };

  static getValidator(type) {
    const strategy = this.strategies[type];
    if (!strategy) {
      throw new Error(`Unknown validation strategy: ${type}`);
    }
    return strategy;
  }
}

// ====================== ADDING NEW FILTERS - MAINTENANCE GUIDE ======================
/**
 * TO ADD A NEW FILTER ENTITY:
 *
 * 1. ADD FIELD DEFINITIONS: Add your entity's field mappings to FieldRegistry.fieldDefinitions
 *    - Use existing common fields (id, email, etc.) or add entity-specific ones
 *    - Specify validator type: 'objectId', 'string', 'boolean', 'number'
 *    - Define mongoField mapping and optional transform functions
 *
 * 2. CHOOSE BUILDER TYPE: Add your entity to FilterFactory.builderMap
 *    - BaseFilterBuilder: Standard field processing
 *    - DateRangeFilterBuilder: Entities with date filtering
 *    - ActivityFilterBuilder: Complex activity-based filtering
 *    - SearchFilterBuilder: Text search and array filtering
 *
 * 3. ADD PUBLIC API: Add your filter function to the main filter object
 *    Example: myEntity: (req, next) => FilterProcessor.processFilter('myEntity', req, next)
 *
 * 4. CUSTOM LOGIC (Optional): Create custom processor in CustomProcessors class if needed
 *    For complex business logic that doesn't fit standard field processing
 *
 * Example:
 * FieldRegistry.fieldDefinitions.products = {
 *   product_name: { validator: 'string', mongoField: 'name' },
 *   price: { validator: 'number', mongoField: 'price' }
 * };
 * FilterFactory.builderMap.products = BaseFilterBuilder;
 * filter.products = (req, next) => FilterProcessor.processFilter('products', req, next);
 */

// ====================== FIELD DEFINITION REGISTRY ======================
class FieldRegistry {
  static fieldDefinitions = {
    // Common fields used across multiple entities
    id: { validator: "objectId", mongoField: "_id" },
    user_id: { validator: "objectId", mongoField: "user_id" },
    network_id: { validator: "objectId", mongoField: "network_id" },
    group_id: { validator: "objectId", mongoField: "group_id" },
    email: { validator: "string", mongoField: "email" },
    category: { validator: "string", mongoField: "category" },
    status: { validator: "string", mongoField: "status" },

    // Entity-specific field mappings
    users: {
      privilege: { validator: "string", mongoField: "privilege" },
      username: { validator: "string", mongoField: "userName" },
      active: {
        validator: "string",
        mongoField: "isActive",
        transform: (value) =>
          value === "yes" ? true : value === "no" ? false : null,
      },
      email_address: { validator: "string", mongoField: "email" },
      role_id: { validator: "objectId", mongoField: "role" },
      resetPasswordToken: {
        validator: "string",
        mongoField: "resetPasswordToken",
      },
      user: { validator: "objectId", mongoField: "_id" },
      login_count: { validator: "number", mongoField: "login_count" },
    },

    guest_users: {
      guest_id: { validator: "string", mongoField: "guest_id" },
    },

    tenantSettings: {
      tenant: {
        validator: "string",
        mongoField: "tenant",
        transform: (value) => value.toLowerCase(),
      },
    },

    networks: {
      net_id: { validator: "objectId", mongoField: "_id" },
      net_email: { validator: "string", mongoField: "net_email" },
      net_category: { validator: "string", mongoField: "net_category" },
      net_tenant: { validator: "string", mongoField: "net_tenant" },
      net_status: { validator: "string", mongoField: "net_status" },
      net_phoneNumber: { validator: "string", mongoField: "net_phoneNumber" },
      net_website: { validator: "string", mongoField: "net_website" },
      net_acronym: { validator: "string", mongoField: "net_acronym" },
    },

    transactions: {
      paddle_transaction_id: {
        validator: "string",
        mongoField: "paddle_transaction_id",
      },
      paddle_event_type: {
        validator: "string",
        mongoField: "paddle_event_type",
      },
      user_id: { validator: "objectId", mongoField: "user_id" },
      paddle_customer_id: {
        validator: "string",
        mongoField: "paddle_customer_id",
      },
      amount: { validator: "string", mongoField: "amount" },
      currency: { validator: "string", mongoField: "currency" },
      payment_method: { validator: "string", mongoField: "payment_method" },
      description: { validator: "string", mongoField: "description" },
      metadata: { validator: "string", mongoField: "metadata" },
      donation_campaign_id: {
        validator: "objectId",
        mongoField: "donation_campaign_id",
      },
    },

    campaigns: {
      title: {
        validator: "string",
        mongoField: "title",
        transform: (value) => ({ $regex: value, $options: "i" }),
      },
      description: {
        validator: "string",
        mongoField: "description",
        transform: (value) => ({ $regex: value, $options: "i" }),
      },
      created_by: { validator: "objectId", mongoField: "created_by" },
      target_amount: { validator: "string", mongoField: "target_amount" },
      current_amount: { validator: "string", mongoField: "current_amount" },
      currency: {
        validator: "string",
        mongoField: "currency",
        transform: (value) => value.toUpperCase(),
      },
      start_date: {
        validator: "string",
        mongoField: "start_date",
        transform: (value) => ({ $gte: new Date(value) }),
      },
      end_date: {
        validator: "string",
        mongoField: "end_date",
        transform: (value) => ({ $lte: new Date(value) }),
      },
      is_public: { validator: "boolean", mongoField: "is_public" },
      tags: {
        validator: "string",
        mongoField: "tags",
        transform: (value) => (Array.isArray(value) ? { $all: value } : value),
      },
    },

    candidates: {
      email_address: { validator: "string", mongoField: "email" },
      network_id: { validator: "objectId", mongoField: "network_id" },
    },

    requests: {
      request_id: { validator: "objectId", mongoField: "_id" },
      user_id: { validator: "objectId", mongoField: "user_id" },
      requestType: { validator: "string", mongoField: "requestType" },
      targetId: { validator: "objectId", mongoField: "targetId" },
      grp_id: { validator: "objectId", mongoField: "targetId" },
      net_id: { validator: "objectId", mongoField: "targetId" },
    },

    defaults: {
      user: { validator: "objectId", mongoField: "user" },
      user_id: { validator: "objectId", mongoField: "user" },
      site: { validator: "objectId", mongoField: "site" },
      airqloud: { validator: "objectId", mongoField: "airqloud" },
      grid: { validator: "objectId", mongoField: "grid" },
      cohort: { validator: "objectId", mongoField: "cohort" },
      group_id: { validator: "objectId", mongoField: "group_id" },
      network_id: { validator: "objectId", mongoField: "network_id" },
    },

    preferences: {
      user_id: { validator: "objectId", mongoField: "user_id" },
      group_id: { validator: "objectId", mongoField: "group_id" },
    },

    maintenances: {
      product: { validator: "string", mongoField: "product" },
    },

    selected_sites: {
      site_id: { validator: "string", mongoField: "site_id" },
    },

    checklists: {
      user_id: { validator: "objectId", mongoField: "user_id" },
    },

    inquiry: {
      // Note: In original, 'id' is NOT converted to ObjectId - keeping as string
      id: { validator: "string", mongoField: "_id" },
    },

    roles: {
      role_id: { validator: "objectId", mongoField: "_id" },
      role_name: { validator: "string", mongoField: "role_name" },
      role_code: { validator: "string", mongoField: "role_code" },
      network_id: { validator: "objectId", mongoField: "network_id" },
      net_id: { validator: "objectId", mongoField: "network_id" },
      grp_id: { validator: "objectId", mongoField: "group_id" },
      group_id: { validator: "objectId", mongoField: "group_id" },
      role_status: { validator: "string", mongoField: "role_status" },
    },

    permissions: {
      permission_id: { validator: "string", mongoField: "permission" },
      network: { validator: "objectId", mongoField: "network_id" },
      network_id: { validator: "objectId", mongoField: "network_id" },
      permission: { validator: "string", mongoField: "permission" },
    },

    tokens: {
      token: { validator: "string", mongoField: "token" },
      client_id: { validator: "objectId", mongoField: "client_id" },
      name: { validator: "string", mongoField: "name" },
      emailed: {
        validator: "string",
        mongoField: "expiredEmailSent",
        transform: (value) => value.toLowerCase() === "yes",
      },
    },

    ips: {
      ip: { validator: "string", mongoField: "ip" },
      range: { validator: "string", mongoField: "range" },
      prefix: { validator: "string", mongoField: "prefix" },
    },

    clients: {
      client_id: { validator: "objectId", mongoField: "_id" },
      user_id: { validator: "objectId", mongoField: "user_id" },
      client_secret: { validator: "string", mongoField: "client_secret" },
    },

    scopes: {
      scope_id: { validator: "string", mongoField: "scope" },
      network_id: { validator: "objectId", mongoField: "network_id" },
      scope: { validator: "string", mongoField: "scope" },
    },

    departments: {
      dep_id: { validator: "objectId", mongoField: "_id" },
      dep_status: { validator: "string", mongoField: "net_status" },
      dep_network_id: { validator: "objectId", mongoField: "dep_network_id" },
      dep_children: { validator: "string", mongoField: "dep_children" },
    },

    groups: {
      grp_id: { validator: "objectId", mongoField: "_id" },
      grp_title: { validator: "string", mongoField: "grp_title" },
      grp_status: { validator: "string", mongoField: "grp_status" },
    },

    favorites: {
      favorite_id: { validator: "objectId", mongoField: "_id" },
      firebase_user_id: { validator: "string", mongoField: "firebase_user_id" },
    },

    location_histories: {
      location_history_id: { validator: "objectId", mongoField: "_id" },
      firebase_user_id: { validator: "string", mongoField: "firebase_user_id" },
    },

    search_histories: {
      search_history_id: { validator: "objectId", mongoField: "_id" },
      firebase_user_id: { validator: "string", mongoField: "firebase_user_id" },
    },
  };

  static getFieldDefinition(entity, field) {
    // Check entity-specific definitions first
    if (this.fieldDefinitions[entity] && this.fieldDefinitions[entity][field]) {
      return this.fieldDefinitions[entity][field];
    }
    // Fall back to common field definitions
    return this.fieldDefinitions[field] || null;
  }
}

// ====================== BASE FILTER BUILDER ======================
class BaseFilterBuilder {
  constructor(entityType) {
    this.entityType = entityType;
    this.filter = {};
    this.errors = [];
  }

  addField(fieldName, value) {
    if (value === undefined || value === null || value === "") {
      return this;
    }

    const fieldDef = FieldRegistry.getFieldDefinition(
      this.entityType,
      fieldName
    );
    if (!fieldDef) {
      logger.warn(
        `No field definition found for ${this.entityType}.${fieldName}`
      );
      return this;
    }

    try {
      const validator = ValidatorFactory.getValidator(fieldDef.validator);
      const validatedValue = validator.validate(value, fieldName);

      if (validatedValue !== null) {
        const mongoField = fieldDef.mongoField || fieldName;
        const finalValue = fieldDef.transform
          ? fieldDef.transform(validatedValue)
          : validatedValue;
        this.filter[mongoField] = finalValue;
      }
    } catch (error) {
      this.errors.push(`Error processing field ${fieldName}: ${error.message}`);
      logger.error(`Error processing field ${fieldName}: ${error.message}`);
    }

    return this;
  }

  addMultipleFields(data) {
    Object.entries(data).forEach(([key, value]) => {
      this.addField(key, value);
    });
    return this;
  }

  build() {
    if (this.errors.length > 0) {
      logger.warn(`Filter built with errors: ${this.errors.join(", ")}`);
    }
    return this.filter;
  }

  hasErrors() {
    return this.errors.length > 0;
  }

  getErrors() {
    return this.errors;
  }
}

// ====================== SPECIALIZED FILTER BUILDERS ======================
class DateRangeFilterBuilder extends BaseFilterBuilder {
  addDateRange(startField, endField, startValue, endValue, next) {
    const today = monthsInfront(0, next);
    const oneWeekBack = addDays(-7, next);

    let dateFilter = {
      $gte: oneWeekBack,
      $lte: today,
    };

    if (startValue && !endValue) {
      if (!isTimeEmpty(startValue)) {
        dateFilter.$gte = addMonthsToProvideDateTime(startValue, 1, next);
      } else {
        dateFilter.$gte = addMonthsToProvidedDate(startValue, 1, next);
      }
    } else if (endValue && !startValue) {
      if (!isTimeEmpty(endValue)) {
        dateFilter.$lte = addMonthsToProvideDateTime(endValue, -1, next);
      } else {
        dateFilter.$lte = addMonthsToProvidedDate(endValue, -1, next);
      }
    } else if (endValue && startValue) {
      dateFilter.$lte = new Date(endValue);
      dateFilter.$gte = new Date(startValue);
    }

    this.filter[startField || "timestamp"] = dateFilter;
    return this;
  }
}

class ActivityFilterBuilder extends DateRangeFilterBuilder {
  addTenantValidation(tenant) {
    if (!tenant) {
      this.errors.push("Tenant is required for activity filters");
      return this;
    }
    this.filter.tenant = tenant;
    return this;
  }

  addServiceFilter(service, dateFilter) {
    if (!service) return this;

    const serviceMatch = { $elemMatch: { name: service } };

    if (Object.keys(dateFilter || {}).length > 0) {
      this.filter.dailyStats = {
        $elemMatch: {
          date: dateFilter,
          services: serviceMatch,
        },
      };
    } else {
      this.filter.dailyStats = {
        $elemMatch: {
          services: serviceMatch,
        },
      };
    }

    this.filter.monthlyStats = {
      $elemMatch: {
        uniqueServices: service,
      },
    };

    return this;
  }
}

class SearchFilterBuilder extends BaseFilterBuilder {
  addTextSearch(field, value, options = { caseInsensitive: true }) {
    if (!value) return this;

    if (options.caseInsensitive) {
      this.filter[field] = { $regex: value, $options: "i" };
    } else {
      this.filter[field] = { $regex: value };
    }
    return this;
  }

  addArrayFilter(field, value, matchAll = false) {
    if (!value) return this;

    if (Array.isArray(value)) {
      this.filter[field] = matchAll ? { $all: value } : { $in: value };
    } else {
      this.filter[field] = value;
    }
    return this;
  }
}

// ====================== FILTER FACTORY ======================
class FilterFactory {
  static builderMap = {
    users: BaseFilterBuilder,
    guest_users: BaseFilterBuilder,
    tenantSettings: BaseFilterBuilder,
    networks: BaseFilterBuilder,
    transactions: BaseFilterBuilder,
    campaigns: SearchFilterBuilder,
    candidates: BaseFilterBuilder,
    requests: BaseFilterBuilder,
    defaults: BaseFilterBuilder,
    preferences: BaseFilterBuilder,
    maintenances: BaseFilterBuilder,
    selected_sites: BaseFilterBuilder,
    checklists: BaseFilterBuilder,
    inquiry: BaseFilterBuilder,
    roles: BaseFilterBuilder,
    permissions: BaseFilterBuilder,
    tokens: BaseFilterBuilder,
    ips: BaseFilterBuilder,
    clients: BaseFilterBuilder,
    scopes: BaseFilterBuilder,
    departments: BaseFilterBuilder,
    groups: BaseFilterBuilder,
    logs: DateRangeFilterBuilder,
    activities: ActivityFilterBuilder,
    favorites: BaseFilterBuilder,
    location_histories: BaseFilterBuilder,
    search_histories: BaseFilterBuilder,
  };

  static createBuilder(entityType) {
    const BuilderClass = this.builderMap[entityType] || BaseFilterBuilder;
    return new BuilderClass(entityType);
  }
}

// ====================== MAIN FILTER PROCESSOR ======================
class FilterProcessor {
  static extractRequestData(req) {
    return { ...req.body, ...req.query, ...req.params };
  }

  static createErrorHandler(next) {
    return (error) => {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      if (next) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: error.message }
          )
        );
      }
    };
  }

  static processFilter(entityType, req, next, customProcessor = null) {
    try {
      const data = this.extractRequestData(req);
      const builder = FilterFactory.createBuilder(entityType);

      if (customProcessor) {
        return customProcessor(builder, data, req, next);
      }

      const filter = builder.addMultipleFields(data).build();

      if (builder.hasErrors()) {
        logger.warn(
          `Filter errors for ${entityType}: ${builder.getErrors().join(", ")}`
        );
      }

      return filter;
    } catch (error) {
      this.createErrorHandler(next)(error);
      return {};
    }
  }
}

// ====================== CUSTOM PROCESSORS ======================
class CustomProcessors {
  static logs(builder, data, req, next) {
    const { service, startTime, endTime, email } = data;
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
        filter["timestamp"]["$gte"] = addMonthsToProvidedDate(
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
      filter["meta.email"] = email;
    }

    return filter;
  }

  static activities(builder, data, req, next) {
    const { service, startTime, endTime, email, tenant } = data;
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
      logText("email present");
      filter.email = email;
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
  }

  static campaigns(builder, data, req, next) {
    // The campaigns entity includes body data as well
    const fullData = { ...req.query, ...req.params, ...req.body };

    // Handle all regular fields
    builder.addMultipleFields(fullData);

    // Special handling for tags (already defined in field definition, but handling here for safety)
    const { tags } = fullData;
    if (tags) {
      if (Array.isArray(tags)) {
        builder.filter.tags = { $all: tags };
      } else if (typeof tags === "string") {
        builder.filter.tags = tags;
      }
    }

    return builder.build();
  }

  static ips(builder, data, req, next) {
    const { ip_counts, prefix_counts } = data;

    // Handle regular fields first
    builder.addMultipleFields(data);

    // Special handling for count-based queries
    if (ip_counts) {
      builder.filter.ipCounts = {
        $elemMatch: {
          count: { $gte: parseInt(ip_counts, 10) },
        },
      };
    }

    if (prefix_counts) {
      builder.filter.prefixCounts = {
        $elemMatch: {
          count: { $gte: parseInt(prefix_counts, 10) },
        },
      };
    }

    return builder.build();
  }
}

// ====================== PUBLIC API ======================
const filter = {
  users: (req, next) => FilterProcessor.processFilter("users", req, next),
  guest_users: (req, next) =>
    FilterProcessor.processFilter("guest_users", req, next),
  tenantSettings: (req, next) =>
    FilterProcessor.processFilter("tenantSettings", req, next),
  networks: (req, next) => FilterProcessor.processFilter("networks", req, next),
  transactions: (req, next) =>
    FilterProcessor.processFilter("transactions", req, next),
  campaigns: (req, next) =>
    FilterProcessor.processFilter(
      "campaigns",
      req,
      next,
      CustomProcessors.campaigns
    ),
  candidates: (req, next) =>
    FilterProcessor.processFilter("candidates", req, next),
  requests: (req, next) => FilterProcessor.processFilter("requests", req, next),
  defaults: (req, next) => FilterProcessor.processFilter("defaults", req, next),
  preferences: (req, next) =>
    FilterProcessor.processFilter("preferences", req, next),
  maintenances: (req, next) =>
    FilterProcessor.processFilter("maintenances", req, next),
  selected_sites: (req, next) =>
    FilterProcessor.processFilter("selected_sites", req, next),
  checklists: (req, next) =>
    FilterProcessor.processFilter("checklists", req, next),
  inquiry: (req, next) => FilterProcessor.processFilter("inquiry", req, next),
  roles: (req, next) => FilterProcessor.processFilter("roles", req, next),
  permissions: (req, next) =>
    FilterProcessor.processFilter("permissions", req, next),
  tokens: (req, next) => FilterProcessor.processFilter("tokens", req, next),
  ips: (req, next) =>
    FilterProcessor.processFilter("ips", req, next, CustomProcessors.ips),
  clients: (req, next) => FilterProcessor.processFilter("clients", req, next),
  scopes: (req, next) => FilterProcessor.processFilter("scopes", req, next),
  departments: (req, next) =>
    FilterProcessor.processFilter("departments", req, next),
  groups: (req, next) => {
    const result = FilterProcessor.processFilter("groups", req, next);
    logObject("the filter we are sending", result);
    return result;
  },
  logs: (req, next) =>
    FilterProcessor.processFilter("logs", req, next, CustomProcessors.logs),
  activities: (req, next) =>
    FilterProcessor.processFilter(
      "activities",
      req,
      next,
      CustomProcessors.activities
    ),
  favorites: (req, next) =>
    FilterProcessor.processFilter("favorites", req, next),
  location_histories: (req, next) =>
    FilterProcessor.processFilter("location_histories", req, next),
  search_histories: (req, next) =>
    FilterProcessor.processFilter("search_histories", req, next),
};

module.exports = filter;
