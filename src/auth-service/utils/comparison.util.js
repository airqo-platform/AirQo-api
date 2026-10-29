const httpStatus = require("http-status");
const isEmpty = require("is-empty");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const ComparisonModel = require("@models/Comparison");
const RBACService = require("@services/rbac.service");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-comparison-util`
);

/**
 * Reshapes a Comparison doc (Mongoose document, `._doc`, or `.lean()`
 * plain object — the model layer returns all three depending on the
 * operation) into the contract's resource shape: `id` instead of `_id`,
 * `created_at`/`updated_at` instead of `createdAt`/`updatedAt`.
 */
const toComparisonResponse = (doc) => {
  if (!doc) return doc;
  const plain = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(plain._id),
    user_id: String(plain.user_id),
    group_id: String(plain.group_id),
    name: plain.name,
    site_ids: plain.site_ids,
    sites: plain.sites,
    created_at: plain.createdAt,
    updated_at: plain.updatedAt,
  };
};

/**
 * Builds the `sites` display snapshot from whatever the client sent in
 * `sites` (its own picker rows already carry name/location/city/country/
 * lat/lng — see device-registry's GET /sites/picker). Client-authoritative
 * by design: auth-service does not call device-registry to resolve/verify
 * site details — AirQo services stay independent, and a service never calls
 * another service's endpoints to enrich its own data. If the frontend wants
 * fresher/normalized site info it re-fetches by id itself. Any site_id with
 * no matching entry in the supplied `sites` falls back to a bare {id}
 * placeholder rather than failing the save.
 */
const buildSiteSnapshots = (siteIds, suppliedSites) => {
  const bySiteId = new Map(
    (Array.isArray(suppliedSites) ? suppliedSites : [])
      .filter((s) => s && s.id)
      .map((s) => [String(s.id), s])
  );

  return siteIds.map((id) => {
    const s = bySiteId.get(id) || {};
    return {
      id,
      name: s.name || null,
      location: s.location || null,
      city: s.city || null,
      country: s.country || null,
      latitude: typeof s.latitude === "number" ? s.latitude : null,
      longitude: typeof s.longitude === "number" ? s.longitude : null,
    };
  });
};

const verifyGroupMembership = async (tenant, userId, groupId) => {
  const rbacService = RBACService.getInstance(tenant);
  const isSystemSuperAdmin = await rbacService.isSystemSuperAdmin(userId);
  if (isSystemSuperAdmin) {
    return true;
  }
  return rbacService.isGroupMember(userId, groupId);
};

const comparisons = {
  create: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { group_id, name, site_ids, sites } = request.body;
      const userId = request.user._id;

      const isMember = await verifyGroupMembership(tenant, userId, group_id);
      if (!isMember) {
        return {
          success: false,
          message: "Forbidden",
          status: httpStatus.FORBIDDEN,
          errors: { message: "You do not belong to the specified group" },
        };
      }

      const uniqueSiteIds = [...new Set(site_ids)];

      const result = await ComparisonModel(tenant).register({
        user_id: userId,
        group_id: ObjectId(group_id),
        name,
        site_ids: uniqueSiteIds,
        sites: buildSiteSnapshots(uniqueSiteIds, sites),
      });

      if (result.success) {
        result.data = toComparisonResponse(result.data);
      }
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  list: async (request, next) => {
    try {
      const { tenant, group_id, search } = request.query;
      const skip = parseInt(request.query.skip, 10) || 0;
      const limit = parseInt(request.query.limit, 10) || 20;
      const userId = request.user._id;

      const isMember = await verifyGroupMembership(tenant, userId, group_id);
      if (!isMember) {
        return {
          success: false,
          message: "Forbidden",
          status: httpStatus.FORBIDDEN,
          errors: { message: "You do not belong to the specified group" },
        };
      }

      const filter = { user_id: ObjectId(userId), group_id: ObjectId(group_id) };
      if (!isEmpty(search)) {
        filter.name = new RegExp(search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      }

      const result = await ComparisonModel(tenant).list({ skip, limit, filter });
      if (result.success) {
        result.data = (result.data || []).map(toComparisonResponse);
      }
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  /**
   * Fetches one comparison and enforces ownership. Returns a tagged result
   * ({ success:false, status:404 } vs. 403) rather than throwing, so
   * getById/update/remove all report the exact status the contract requires
   * (404 unknown id, 403 someone else's comparison).
   */
  _findOwned: async (tenant, comparisonId, userId) => {
    const doc = await ComparisonModel(tenant).findById(comparisonId).lean();
    if (isEmpty(doc)) {
      return {
        success: false,
        status: httpStatus.NOT_FOUND,
        message: "Comparison not found",
        errors: { message: "Comparison does not exist" },
      };
    }
    if (doc.user_id.toString() !== userId.toString()) {
      return {
        success: false,
        status: httpStatus.FORBIDDEN,
        message: "Forbidden",
        errors: { message: "This comparison belongs to another user" },
      };
    }
    return { success: true, data: doc };
  },

  // GET /comparisons/{id} returns the saved selection only — readings are
  // not resolved here. Loading a saved comparison is a two-call sequence on
  // the client: GET this, then POST the returned site_ids to device-registry's
  // /readings/comparisons. auth-service does not call device-registry itself
  // (see buildSiteSnapshots comment — services stay independent; only ids
  // cross the boundary, the frontend composes the calls).
  getById: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { comparison_id } = request.params;
      const userId = request.user._id;

      const owned = await comparisons._findOwned(tenant, comparison_id, userId);
      if (owned.success) {
        owned.data = toComparisonResponse(owned.data);
      }
      return owned;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  update: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { comparison_id } = request.params;
      const { name, site_ids, sites } = request.body;
      const userId = request.user._id;

      const owned = await comparisons._findOwned(tenant, comparison_id, userId);
      if (!owned.success) {
        return owned;
      }

      const update = {};
      if (!isEmpty(name)) {
        update.name = name;
      }
      if (Array.isArray(site_ids)) {
        const uniqueSiteIds = [...new Set(site_ids)];
        update.site_ids = uniqueSiteIds;
        update.sites = buildSiteSnapshots(uniqueSiteIds, sites);
      }

      const result = await ComparisonModel(tenant).modify({
        filter: { _id: comparison_id },
        update,
      });
      if (result.success) {
        result.data = toComparisonResponse(result.data);
      }
      return result;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },

  remove: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { comparison_id } = request.params;
      const userId = request.user._id;

      const owned = await comparisons._findOwned(tenant, comparison_id, userId);
      if (!owned.success) {
        return owned;
      }

      return await ComparisonModel(tenant).remove({
        filter: { _id: comparison_id },
      });
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: error.message },
      };
    }
  },
};

module.exports = comparisons;
