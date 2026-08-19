/**
 * honeypot.routes.js — device-registry
 *
 * Undocumented paths that look plausible to scrapers/probers.
 * Any authenticated request reaching these routes is flagged and the token
 * auto-suspended via the auth-service.  Unauthenticated probes are also
 * logged (IP only).  All paths return a generic 404.
 */
const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const axios = require("axios");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const { headers } = require("@validators/common");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device-registry-honeypot`
);

router.use(headers);

/**
 * Extract the raw API token from Authorization: JWT <token>.
 * Returns null if not present.
 */
const _extractToken = (req) => {
  const auth = req.headers["authorization"] || "";
  const m = auth.match(/^JWT\s+(\S+)/i);
  return m ? m[1] : null;
};

/**
 * Notify auth-service to flag and suspend the token.
 * Fire-and-forget — device-registry does not own the token store.
 */
const _flagAndSuspend = async (rawToken, path, ip, userAgent) => {
  if (!constants.AUTH_SERVICE_URL || !rawToken) return;
  try {
    const flagUrl = `${constants.AUTH_SERVICE_URL}/api/v2/tokens/honeypot-flag`;
    const headers = { "Content-Type": "application/json" };
    if (constants.SERVICE_JWT_TOKEN) {
      headers["Authorization"] = `JWT ${constants.SERVICE_JWT_TOKEN}`;
    }
    await axios.post(
      flagUrl,
      { token: rawToken, path, ip, user_agent: userAgent, service: "device-registry" },
      { headers, timeout: 3000 }
    );
  } catch (err) {
    // Non-fatal — log locally so there is at least an audit trail.
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    logger.warn(
      `🍯 Honeypot hit (auth-service flag failed) — path=${path} ` +
      `token_hash=${tokenHash.slice(0, 16)}... ip=${ip} err=${err.message}`
    );
  }
};

const honeypotHandler = async (req, res) => {
  const path = req.originalUrl || req.url || "unknown";
  const ip =
    req.headers["x-client-ip"] ||
    req.headers["x-client-original-ip"] ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "";
  const rawToken = _extractToken(req);

  logger.warn(`🍯 Honeypot triggered — path=${path} ip=${ip} hasToken=${!!rawToken}`);

  // Notify auth-service asynchronously — do not await.
  if (rawToken) {
    _flagAndSuspend(rawToken, path, ip, userAgent).catch(() => {});
  }

  return res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "Resource not found",
    status: httpStatus.NOT_FOUND,
  });
};

// Plausible-looking but undocumented paths.
router.get("/export-all",           honeypotHandler);
router.get("/dump",                 honeypotHandler);
router.post("/bulk-export",         honeypotHandler);
router.get("/admin/raw",            honeypotHandler);
router.get("/internal/all-devices", honeypotHandler);
router.get("/internal/all-sites",   honeypotHandler);

module.exports = router;
