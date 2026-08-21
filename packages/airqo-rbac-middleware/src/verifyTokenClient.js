const axios = require("axios");

const DEFAULT_TIMEOUT_MS = 3000;

/**
 * Calls auth-service's GET /api/v2/tokens/:token/verify and returns the
 * parsed response body as-is (including its permissions data).
 *
 * Returns null only when the call never reached auth-service at all
 * (network error / timeout) — the caller decides how to treat that.
 * An explicit rejection from auth-service (invalid token, rate limited,
 * etc.) is returned as-is so the caller can propagate its status/message.
 *
 * No caching: the result depends on request-context state (live rate-limit
 * counters, per-request scope checks), so every call goes live to
 * auth-service. Mirrors the same decision already made in device-registry's
 * token-resource-binding.middleware.js.
 */
const verifyToken = async (rawToken, req, options = {}) => {
  const {
    authServiceUrl,
    serviceJwtToken,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  if (!authServiceUrl) {
    throw new Error(
      "verifyToken: authServiceUrl is required (pass explicitly or set AUTH_SERVICE_URL)"
    );
  }

  const reqHeaders = (req && req.headers) || {};
  const clientIp =
    reqHeaders["x-client-ip"] ||
    reqHeaders["x-client-original-ip"] ||
    (req && req.ip);

  // Forward only the specific headers auth-service needs for its checks —
  // never forward all headers, to avoid leaking cookies/client material into
  // an internal service call.
  const headers = {
    "x-client-ip": clientIp || "rbac-middleware-internal",
  };
  if (serviceJwtToken) {
    headers["Authorization"] = `JWT ${serviceJwtToken}`;
  }
  if (reqHeaders["x-original-uri"]) {
    headers["x-original-uri"] = reqHeaders["x-original-uri"];
  }
  if (reqHeaders["origin"]) {
    headers["origin"] = reqHeaders["origin"];
  }
  if (reqHeaders["referer"]) {
    headers["referer"] = reqHeaders["referer"];
  }

  const verifyUrl = `${authServiceUrl}/api/v2/tokens/${encodeURIComponent(rawToken)}/verify`;

  try {
    const response = await axios.get(verifyUrl, { headers, timeout: timeoutMs });
    return response.data;
  } catch (err) {
    if (err.response) {
      return err.response.data || { success: false, status: err.response.status };
    }
    return null;
  }
};

module.exports = { verifyToken };
