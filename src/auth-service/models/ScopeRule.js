const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- scope-rule-model`);
const {
  createSuccessResponse,
  createErrorResponse,
  createNotFoundResponse,
  createEmptySuccessResponse,
} = require("@utils/shared");

/**
 * ScopeRule — maps a URI pattern to the scope required to access it.
 *
 * The `pattern` field is stored as a plain string (e.g. "/devices/forecasts")
 * and is treated as a case-insensitive substring match at runtime.
 * Storing it as a string (not a RegExp) keeps the document portable and
 * editable via the API without code changes.
 *
 * Rules are evaluated in ascending `priority` order (lower = checked first).
 * Only `active: true` rules are loaded into the enforcement cache.
 */
const ScopeRuleSchema = new mongoose.Schema(
  {
    pattern: {
      type: String,
      required: [true, "pattern is required"],
      trim: true,
    },
    scope: {
      type: String,
      required: [true, "scope is required"],
      trim: true,
    },
    // Lower number = evaluated first. Allows Premium rules to sit above Free rules.
    priority: {
      type: Number,
      default: 100,
    },
    active: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

ScopeRuleSchema.index({ priority: 1, active: 1 });
ScopeRuleSchema.index({ pattern: 1 }, { unique: true });

ScopeRuleSchema.statics = {
  async register(args, next) {
    try {
      const data = await this.create({ ...args });
      if (!isEmpty(data)) {
        return createSuccessResponse("create", data, "scope_rule", {
          message: "Scope rule created",
        });
      }
      return createEmptySuccessResponse(
        "scope_rule",
        "operation successful but scope rule NOT created"
      );
    } catch (err) {
      logger.error(`🐛🐛 Internal Server Error -- ${err.message}`);
      if (err.keyValue) {
        const response = {};
        Object.entries(err.keyValue).forEach(
          ([key]) => (response[key] = `the ${key} must be unique`)
        );
        return {
          success: false,
          message: "validation errors for some of the provided inputs",
          status: httpStatus.CONFLICT,
          errors: response,
        };
      }
      return createErrorResponse(err, "create", logger, "scope_rule");
    }
  },

  async list({ skip = 0, limit = 200, filter = {} } = {}, next) {
    try {
      const totalCount = await this.countDocuments(filter);
      const rules = await this.find(filter)
        .sort({ priority: 1, createdAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean();
      return {
        success: true,
        data: rules,
        message: "successfully listed scope rules",
        status: httpStatus.OK,
        meta: {
          total: totalCount,
          skip,
          limit,
          page: Math.floor(skip / limit) + 1,
          pages: Math.ceil(totalCount / limit) || 1,
        },
      };
    } catch (error) {
      return createErrorResponse(error, "list", logger, "scope_rule");
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      const updated = await this.findOneAndUpdate(filter, update, {
        new: true,
      }).exec();
      if (!isEmpty(updated)) {
        return createSuccessResponse("update", updated._doc, "scope_rule");
      }
      return createNotFoundResponse(
        "scope_rule",
        "update",
        "Scope rule does not exist, please crosscheck"
      );
    } catch (error) {
      return createErrorResponse(error, "update", logger, "scope_rule");
    }
  },

  async remove({ filter = {} } = {}, next) {
    try {
      const removed = await this.findOneAndDelete(filter, {
        projection: { pattern: 1, scope: 1 },
      }).exec();
      if (!isEmpty(removed)) {
        return createSuccessResponse("delete", removed._doc, "scope_rule");
      }
      return createNotFoundResponse(
        "scope_rule",
        "delete",
        "Scope rule does not exist, please crosscheck"
      );
    } catch (error) {
      return createErrorResponse(error, "delete", logger, "scope_rule");
    }
  },

  /**
   * Load all active rules ordered by priority — used by the enforcement cache.
   */
  async loadActive() {
    try {
      const rules = await this.find({ active: true })
        .sort({ priority: 1 })
        .select("pattern scope priority")
        .lean();
      return { success: true, data: rules, status: httpStatus.OK };
    } catch (error) {
      return createErrorResponse(error, "loadActive", logger, "scope_rule");
    }
  },

  /**
   * Seed the default URI→scope rules if none exist yet.
   * Safe to call multiple times — only inserts when collection is empty.
   */
  async seedDefaults(next) {
    try {
      const existing = await this.countDocuments({});
      if (existing > 0) {
        return {
          success: true,
          message: `Skipped: ${existing} rules already exist`,
          data: { seeded: 0, existing },
          status: httpStatus.OK,
        };
      }

      const defaults = [
        // Priority 10 — Premium (checked first)
        { pattern: "/devices/forecasts", scope: "read:forecasts",              priority: 10, description: "Forecasts sub-path (device-registry)" },
        { pattern: "/forecasts",         scope: "read:forecasts",              priority: 11, description: "Top-level forecasts path" },
        { pattern: "/insights",          scope: "read:insights",               priority: 12, description: "Top-level insights path" },
        // Priority 20 — Standard
        { pattern: "/devices/measurements", scope: "read:historical_measurements", priority: 20, description: "Historical measurements (device-registry)" },
        // Priority 30 — Free
        { pattern: "/devices/events",    scope: "read:recent_measurements",    priority: 30, description: "Real-time events (device-registry)" },
        { pattern: "/devices/readings",  scope: "read:recent_measurements",    priority: 31, description: "Readings (device-registry)" },
        { pattern: "/devices/feeds",     scope: "read:recent_measurements",    priority: 32, description: "Feeds (device-registry)" },
        { pattern: "/devices/sites",     scope: "read:sites",                  priority: 40, description: "Sites (device-registry)" },
        { pattern: "/devices/cohorts",   scope: "read:cohorts",                priority: 41, description: "Cohorts (device-registry)" },
        { pattern: "/devices/grids",     scope: "read:grids",                  priority: 42, description: "Grids (device-registry)" },
        // Priority 50 — catch-all for /devices (must be last)
        { pattern: "/devices",           scope: "read:devices",                priority: 50, description: "Devices catch-all (device-registry)" },
      ];

      await this.insertMany(defaults, { ordered: false });
      return {
        success: true,
        message: `Seeded ${defaults.length} default scope rules`,
        data: { seeded: defaults.length, existing: 0 },
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logger.error(`ScopeRule seedDefaults error: ${error.message}`);
      return createErrorResponse(error, "seedDefaults", logger, "scope_rule");
    }
  },
};

ScopeRuleSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pattern: this.pattern,
      scope: this.scope,
      priority: this.priority,
      active: this.active,
      description: this.description,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  },
};

const ScopeRuleModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    return mongoose.model("scope_rules");
  } catch (error) {
    return getModelByTenant(dbTenant, "scope_rule", ScopeRuleSchema);
  }
};

module.exports = ScopeRuleModel;
