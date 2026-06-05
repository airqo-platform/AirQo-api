/**
 * token-resource-binding.middleware.js
 *
 * Calls the auth-service token-verify endpoint to:
 *   1. Confirm the token is valid (active, not blacklisted, within rate limits)
 *   2. Retrieve the resource binding payload (allowed_grids, allowed_cohorts)
 *      and attach it to req.tokenBinding so downstream route handlers can
 *      enforce grid/cohort restrictions without a second network call.
 *
 * Design constraints:
 *   - auth-service and device-registry run separate DBs; no shared DB access.
 *   - The verify call result is short-lived Redis-cached (30s, keyed by
 *     token hash) to avoid an auth-service round-trip on every request while
 *     still respecting revocations within ~30 seconds.
 *   - Fails OPEN when AUTH_SERVICE_URL is not configured (env missing) so
 *     dev/test environments without auth-service wired up are not broken.
 *   - Returns 401 only when auth-service explicitly rejects the token.
 *
 * Env vars required:
 *   AUTH_SERVICE_URL     — base URL of the auth-service (e.g. http://auth-service:3000)
 *   SERVICE_JWT_TOKEN    — internal JWT used by device-registry to authenticate
 *                          its own calls to auth-service (set on the verify endpoint
 *                          as the "Authorization: JWT <token>" header so the
 *                          verify call itself doesn't need a client API token).
 *   ENABLE_RESOURCE_BINDING — set to "true" to activate enforcement (default: false)
 */

const axios = require("axios");
const crypto = require("crypto");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const { redisIncrAsync, redisExpireAsync } = require("@config/redis");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- token-resource-binding`
);

const VERIFY_TIMEOUT_MS = 3000;

/**
 * Extract the raw API token from the Authorization header.
 * Supports "JWT <token>" format (the AirQo convention).
 */
const _extractRawToken = (req) => {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^JWT\s+(\S+)/i);
  return m ? m[1] : null;
};

/**
 * Call auth-service /api/v2/tokens/:token/verify and return the parsed body.
 *
 * Caching is intentionally omitted: the verify response depends on
 * request-context state (endpoint for scope checks, Origin/Referer for origin
 * enforcement, live rate-limit counters) that varies per request.  Caching by
 * token hash alone would let a response from one context be replayed into a
 * different context, producing incorrect scope or origin decisions.
 *
 * Returns null on any network / parse error (caller fails open).
 */
const _verifyTokenRemotely = async (rawToken, req) => {
  if (!constants.AUTH_SERVICE_URL) return null;

  const clientIp =
    req.headers["x-client-ip"] ||
    req.headers["x-client-original-ip"] ||
    req.ip;

  // Live call to auth-service
  try {
    const verifyUrl = `${constants.AUTH_SERVICE_URL}/api/v2/tokens/${encodeURIComponent(rawToken)}/verify`;

    // Forward only the specific headers auth-service needs for its checks.
    // Do NOT forward all headers — that would leak cookies and other sensitive
    // client material into an internal service call.
    const headers = {
      "x-client-ip": clientIp || "device-registry-internal",
    };
    if (constants.SERVICE_JWT_TOKEN) {
      headers["Authorization"] = `JWT ${constants.SERVICE_JWT_TOKEN}`;
    }
    // x-original-uri is read by auth-service for URI-scope enforcement.
    if (req.headers["x-original-uri"]) {
      headers["x-original-uri"] = req.headers["x-original-uri"];
    }
    // origin and referer are read by auth-service for origin enforcement.
    if (req.headers["origin"]) {
      headers["origin"] = req.headers["origin"];
    }
    if (req.headers["referer"]) {
      headers["referer"] = req.headers["referer"];
    }

    const response = await axios.get(verifyUrl, {
      headers,
      timeout: VERIFY_TIMEOUT_MS,
    });

    return response.data;
  } catch (err) {
    if (err.response) {
      // Auth-service responded with an explicit rejection — propagate it.
      return err.response.data || { success: false };
    }
    // Network error / timeout — fail open
    logger.error(
      `Non-critical: token verify call to auth-service failed (failing open): ${err.message}`
    );
    return null;
  }
};

/**
 * Express middleware: verifyAndBindResources
 *
 * Attaches req.tokenBinding = { allowed_grids: [], allowed_cohorts: [] }
 * when the token is valid and resource binding is configured.
 *
 * When ENABLE_RESOURCE_BINDING is false (default) the middleware is a no-op
 * so existing routes are completely unaffected.
 */
const verifyAndBindResources = async (req, res, next) => {
  const rawToken = _extractRawToken(req);

  // Register the error-rate counter hook unconditionally — it must fire
  // regardless of ENABLE_RESOURCE_BINDING so the auth-service circuit breaker
  // receives 4xx signals even when resource binding is disabled.
  if (rawToken) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    res.on("finish", () => {
      if (res.statusCode >= 400 && res.statusCode < 500) {
        const slot15 = Math.floor(Date.now() / 900000);
        const errKey = `errcb:${tokenHash}:${slot15}`;
        redisIncrAsync(errKey)
          .then((count) => {
            if (count === 1) {
              return redisExpireAsync(errKey, 901);
            }
          })
          .catch(() => {});
      }
    });
  }

  if (!constants.ENABLE_RESOURCE_BINDING) {
    req.tokenBinding = { allowed_grids: [], allowed_cohorts: [] };
    return next();
  }

  if (!rawToken) {
    // No token present — allow through; auth is handled upstream.
    req.tokenBinding = { allowed_grids: [], allowed_cohorts: [] };
    return next();
  }

  try {
    const verifyResult = await _verifyTokenRemotely(rawToken, req);

    if (verifyResult === null) {
      // Network failure — fail open, no binding enforced.
      req.tokenBinding = { allowed_grids: [], allowed_cohorts: [] };
      return next();
    }

    if (!verifyResult.success) {
      // Propagate the exact status auth-service returned (401, 403, 429, etc.)
      // so clients and downstream error handling are not misled by a blanket 401.
      const status = verifyResult.status || httpStatus.UNAUTHORIZED;
      const defaultMessage =
        status === httpStatus.FORBIDDEN ? "Forbidden" : "Unauthorized";
      return res.status(status).json({
        success: false,
        message: verifyResult.message || defaultMessage,
        status,
        errors: verifyResult.errors || { message: verifyResult.message || defaultMessage },
      });
    }

    // Token is valid — attach resource binding for downstream enforcement.
    req.tokenBinding = {
      allowed_grids:   (verifyResult.data && verifyResult.data.allowed_grids)   || [],
      allowed_cohorts: (verifyResult.data && verifyResult.data.allowed_cohorts) || [],
    };

    return next();
  } catch (err) {
    logger.error(`Non-critical: verifyAndBindResources error (failing open): ${err.message}`);
    req.tokenBinding = { allowed_grids: [], allowed_cohorts: [] };
    return next();
  }
};

/**
 * Express middleware: enforceGridBinding
 *
 * Must be used AFTER verifyAndBindResources on routes that carry a :grid_id
 * route param or a grid_id query/body param.
 *
 * When the token has no allowed_grids restriction (empty array) or when
 * ENABLE_RESOURCE_BINDING is false, this is a no-op.
 */
const enforceGridBinding = (req, res, next) => {
  if (!constants.ENABLE_RESOURCE_BINDING) return next();

  const binding = req.tokenBinding;
  if (!binding || !binding.allowed_grids || binding.allowed_grids.length === 0) {
    return next();
  }

  const requestedGrid =
    req.params.grid_id ||
    req.query.grid_id ||
    (req.body && req.body.grid_id);

  if (!requestedGrid) return next();

  if (!binding.allowed_grids.includes(String(requestedGrid))) {
    logger.warn(
      `Grid binding violation — requested=${requestedGrid} allowed=${binding.allowed_grids.join(",")}`
    );
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "This token is not permitted to access the requested Grid",
      status: httpStatus.FORBIDDEN,
      errors: {
        message: `Token is bound to grid(s): ${binding.allowed_grids.join(", ")}`,
      },
    });
  }

  return next();
};

/**
 * Express middleware: enforceCohortBinding
 *
 * Same as enforceGridBinding but for cohort_id.
 */
const enforceCohortBinding = (req, res, next) => {
  if (!constants.ENABLE_RESOURCE_BINDING) return next();

  const binding = req.tokenBinding;
  if (!binding || !binding.allowed_cohorts || binding.allowed_cohorts.length === 0) {
    return next();
  }

  const requestedCohort =
    req.params.cohort_id ||
    req.query.cohort_id ||
    (req.body && req.body.cohort_id);

  if (!requestedCohort) return next();

  if (!binding.allowed_cohorts.includes(String(requestedCohort))) {
    logger.warn(
      `Cohort binding violation — requested=${requestedCohort} allowed=${binding.allowed_cohorts.join(",")}`
    );
    return res.status(httpStatus.FORBIDDEN).json({
      success: false,
      message: "This token is not permitted to access the requested Cohort",
      status: httpStatus.FORBIDDEN,
      errors: {
        message: `Token is bound to cohort(s): ${binding.allowed_cohorts.join(", ")}`,
      },
    });
  }

  return next();
};

module.exports = {
  verifyAndBindResources,
  enforceGridBinding,
  enforceCohortBinding,
};
