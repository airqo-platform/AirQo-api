// middleware/extractCohortAccess.js
const jwt = require("jsonwebtoken");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- extract-cohort-access`
);

/**
 * Middleware to extract cohort access information from JWT token
 * Adds cohortAccess object to req containing user's permissions
 */
module.exports = (req, res, next) => {
  try {
    // Default no-access state
    req.cohortAccess = {
      managedGroups: [],
      canAccessPrivateCohorts: false,
      permissionsUpdatedAt: null,
    };

    // Extract JWT token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.debug("No authorization token provided");
      return next();
    }

    const token = authHeader.split(" ")[1];

    try {
      // Verify and decode JWT token
      const decoded = jwt.verify(token, constants.JWT_SECRET);

      // Check if token contains cohort access information
      if (decoded && decoded.cohortAccess) {
        req.cohortAccess = decoded.cohortAccess;
        req.userId = decoded._id;

        // Normalize group identifiers to lowercase for consistent comparison
        if (
          req.cohortAccess.managedGroups &&
          Array.isArray(req.cohortAccess.managedGroups)
        ) {
          req.cohortAccess.managedGroups = req.cohortAccess.managedGroups.map(
            (g) => (typeof g === "string" ? g.toLowerCase() : g)
          );
        }

        logger.debug(
          `User ${req.userId} has access to ${req.cohortAccess.managedGroups.length} groups`
        );
      }
    } catch (jwtError) {
      // Invalid token - continue with default no-access
      logger.error(`JWT verification error: ${jwtError.message}`);
    }

    next();
  } catch (error) {
    logger.error(`Error in extract cohort access middleware: ${error.message}`);
    next();
  }
};
