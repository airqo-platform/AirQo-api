// middleware/resourceFilter.js
const mongoose = require("mongoose");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- resource-filter-middleware`
);

/**
 * Middleware to create resource-specific filters based on user permissions
 */
const resourceFilterMiddleware = (req, res, next) => {
  try {
    // Skip filtering if no auth data is available (shouldn't happen with proper middleware chain)
    if (!req.auth) {
      logger.warn("Resource filter middleware called without auth data");
      return next();
    }

    const { permissions, resources, tier } = req.auth;

    // Initialize resource filters
    req.resourceFilters = {
      devices: {},
      sites: {},
      cohorts: {},
      grids: {},
    };

    // If user has admin permissions, skip filtering
    if (permissions.includes("admin:all")) {
      logger.info("User has admin:all permission - no filtering applied");
      return next();
    }

    // Create filters for each resource type

    // Devices filter
    if (
      !permissions.includes("admin:devices:all") &&
      Array.isArray(resources.devices) &&
      resources.devices.length > 0
    ) {
      req.resourceFilters.devices._id = {
        $in: resources.devices.map((id) => mongoose.Types.ObjectId(id)),
      };
      logger.debug(
        `Applied device filter for ${resources.devices.length} devices`
      );
    }

    // Sites filter
    if (
      !permissions.includes("admin:sites:all") &&
      Array.isArray(resources.sites) &&
      resources.sites.length > 0
    ) {
      req.resourceFilters.sites._id = {
        $in: resources.sites.map((id) => mongoose.Types.ObjectId(id)),
      };
      logger.debug(`Applied site filter for ${resources.sites.length} sites`);
    }

    // Cohorts filter
    if (
      !permissions.includes("admin:cohorts:all") &&
      Array.isArray(resources.cohorts) &&
      resources.cohorts.length > 0
    ) {
      req.resourceFilters.cohorts._id = {
        $in: resources.cohorts.map((id) => mongoose.Types.ObjectId(id)),
      };
      logger.debug(
        `Applied cohort filter for ${resources.cohorts.length} cohorts`
      );
    }

    // Grids filter
    if (
      !permissions.includes("admin:grids:all") &&
      Array.isArray(resources.grids) &&
      resources.grids.length > 0
    ) {
      req.resourceFilters.grids._id = {
        $in: resources.grids.map((id) => mongoose.Types.ObjectId(id)),
      };
      logger.debug(`Applied grid filter for ${resources.grids.length} grids`);
    }

    // Data time range filter for measurements based on subscription tier
    if (tier === "Free") {
      // Free tier - only last 24 hours
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      req.resourceFilters.measurements = {
        timestamp: { $gte: oneDayAgo },
      };
      logger.debug("Applied Free tier time restriction (last 24h)");
    }

    next();
  } catch (error) {
    logger.error(`Resource filter middleware error: ${error.message}`);
    // Don't fail the request on filter error, just log and proceed
    next();
  }
};

module.exports = resourceFilterMiddleware;
