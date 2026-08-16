const { extractToken } = require("./extractToken");
const { verifyToken } = require("./verifyTokenClient");

const HTTP_UNAUTHORIZED = 401;
const HTTP_FORBIDDEN = 403;

const parseBool = (value, defaultValue) => {
  if (value === undefined || value === null || value === "") return defaultValue;
  return String(value).toLowerCase() === "true";
};

const deny = (res, status, message, errorDetail) =>
  res.status(status).json({
    success: false,
    message,
    status,
    errors: { message: errorDetail || message },
  });

/**
 * requirePermission(permission, options?) => Express middleware
 *
 * Fails CLOSED (denies) whenever the required permission cannot be
 * confirmed — a missing token, a rejected token, or an unreachable
 * auth-service all result in denial. This is the opposite default of
 * device-registry's resource-binding middleware, which fails open: that
 * middleware protects a scoping nice-to-have, this one enforces an actual
 * authorization boundary and must not silently grant access on failure.
 *
 * @param {string} permission - required permission string, e.g. "DEVICE_UPDATE"
 * @param {object} [options]
 * @param {string} [options.authServiceUrl] - default: process.env.AUTH_SERVICE_URL
 * @param {string} [options.serviceJwtToken] - default: process.env.SERVICE_JWT_TOKEN
 * @param {string} [options.killSwitchEnv] - env var name that, set to "false",
 *   bypasses this check entirely (logged loudly). Default: "RBAC_ENFORCEMENT_ENABLED"
 * @param {number} [options.timeoutMs] - verify call timeout. Default: 3000
 * @param {object} [options.logger] - object with .warn()/.error(). Default: console
 */
const requirePermission = (permission, options = {}) => {
  if (!permission) {
    throw new Error(
      "requirePermission(permission) requires a non-empty permission string"
    );
  }

  const {
    authServiceUrl = process.env.AUTH_SERVICE_URL,
    serviceJwtToken = process.env.SERVICE_JWT_TOKEN,
    killSwitchEnv = "RBAC_ENFORCEMENT_ENABLED",
    timeoutMs = 3000,
    logger = console,
  } = options;

  return async (req, res, next) => {
    if (!parseBool(process.env[killSwitchEnv], true)) {
      logger.warn(
        `RBAC enforcement bypassed via ${killSwitchEnv}=false — path=${req.originalUrl} permission=${permission}`
      );
      return next();
    }

    const rawToken = extractToken(req);
    if (!rawToken) {
      return deny(
        res,
        HTTP_UNAUTHORIZED,
        "Authentication required",
        "Missing or malformed Authorization header"
      );
    }

    if (!authServiceUrl) {
      logger.error(
        `RBAC check failed closed — authServiceUrl not configured, denying path=${req.originalUrl}`
      );
      return deny(
        res,
        HTTP_FORBIDDEN,
        "Forbidden",
        "Authorization service is not configured"
      );
    }

    let verifyResult;
    try {
      verifyResult = await verifyToken(rawToken, req, {
        authServiceUrl,
        serviceJwtToken,
        timeoutMs,
      });
    } catch (err) {
      logger.error(`RBAC check failed closed — verify call threw: ${err.message}`);
      return deny(
        res,
        HTTP_FORBIDDEN,
        "Forbidden",
        "Unable to verify authorization at this time"
      );
    }

    if (verifyResult === null) {
      // Network error / timeout reaching auth-service — fail CLOSED.
      logger.error(
        `RBAC check failed closed — auth-service unreachable, denying path=${req.originalUrl}`
      );
      return deny(
        res,
        HTTP_FORBIDDEN,
        "Forbidden",
        "Unable to verify authorization at this time"
      );
    }

    if (!verifyResult.success) {
      const status = verifyResult.status || HTTP_UNAUTHORIZED;
      const defaultMessage = status === HTTP_FORBIDDEN ? "Forbidden" : "Unauthorized";
      return res.status(status).json({
        success: false,
        message: verifyResult.message || defaultMessage,
        status,
        errors: verifyResult.errors || { message: verifyResult.message || defaultMessage },
      });
    }

    const permissions = (verifyResult.data && verifyResult.data.permissions) || [];
    if (!permissions.includes(permission)) {
      logger.warn(
        `RBAC denial — path=${req.originalUrl} required=${permission} userPermissions=${permissions.join(",")}`
      );
      return deny(
        res,
        HTTP_FORBIDDEN,
        "Insufficient permissions",
        `This action requires the '${permission}' permission`
      );
    }

    return next();
  };
};

module.exports = { requirePermission };
