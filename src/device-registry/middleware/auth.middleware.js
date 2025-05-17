// middleware/auth.js
const fetch = require("node-fetch");
const { isEmpty } = require("is-empty");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- auth-middleware`);
const { HttpError } = require("@utils/shared");

// Auth Service URL from config
const AUTH_SERVICE_URL =
  process.env.AUTH_SERVICE_URL || "http://auth-service:3000";

/**
 * Middleware to verify token and attach user permissions to request
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
        errors: { message: "No valid token provided" },
      });
    }

    const token = authHeader.split(" ")[1];

    // Call auth service to verify token
    const response = await fetch(
      `${AUTH_SERVICE_URL}/api/v2/tokens/${token}/auto-verify`,
      {
        headers: {
          Accept: "application/json",
          "X-Client-IP": req.ip,
          "X-Original-URI": req.originalUrl,
        },
      }
    );

    const data = await response.json();

    if (!data.success) {
      return res.status(data.status || 401).json({
        success: false,
        message: data.message || "Invalid token",
        errors: data.errors || { message: "Authentication failed" },
      });
    }

    // If token is valid but no data is returned, this is a legacy token
    if (!data.data) {
      // Set minimal auth info for backward compatibility
      req.auth = {
        isAuthenticated: true,
        // Add minimal required fields
        permissions: [],
        resources: {
          devices: [],
          sites: [],
          cohorts: [],
          grids: [],
        },
        scopes: [],
        tier: "Free",
      };
    } else {
      // Set the auth data on the request object
      req.auth = {
        isAuthenticated: true,
        userId: data.data.userId,
        clientId: data.data.clientId,
        permissions: data.data.permissions || [],
        resources: data.data.resources || {
          devices: [],
          sites: [],
          cohorts: [],
          grids: [],
        },
        scopes: data.data.scopes || [],
        tier: data.data.tier || "Free",
      };
    }

    next();
  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: "Authentication service unavailable",
      })
    );
  }
};

module.exports = authMiddleware;
