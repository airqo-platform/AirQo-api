/**
 * honeypot.middleware.js
 *
 * Any request reaching these routes is a zero-false-positive signal of
 * probing or scraping behaviour — legitimate callers never reference
 * honeypot paths because they do not appear in any public documentation.
 *
 * The handler:
 *   1. Extracts the bearer token from Authorization: JWT <token>
 *   2. Logs the hit to FlaggedToken (audit trail)
 *   3. Auto-suspends the token in AccessToken.request_pattern
 *   4. Returns a plausible-looking but uninformative 404 so the caller
 *      does not know they have been detected
 */
const crypto = require("crypto");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const AccessTokenModel = require("@models/AccessToken");
const FlaggedTokenModel = require("@models/FlaggedToken");

const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- honeypot-middleware`);

const honeypotHandler = async (req, res) => {
  const path = req.originalUrl || req.url || "unknown";

  // Extract raw token string from "Authorization: JWT <token>" header.
  // Do not reject requests that lack a token — an unauthenticated probe is
  // still a probe; we just can't tie it to a specific token.
  let rawToken = null;
  const authHeader = req.headers["authorization"] || "";
  const match = authHeader.match(/^JWT\s+(\S+)/i);
  if (match) rawToken = match[1];

  const ip =
    req.headers["x-client-ip"] ||
    req.headers["x-client-original-ip"] ||
    req.ip ||
    "unknown";
  const userAgent = req.headers["user-agent"] || "";

  if (rawToken) {
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const tokenSuffix = rawToken.slice(-4);

    // Log the honeypot hit — fire-and-forget, never block the response on this.
    FlaggedTokenModel("airqo")
      .logHit({
        token_hash: tokenHash,
        token_suffix: tokenSuffix,
        ip,
        user_agent: userAgent,
        honeypot_path: path,
        service: "auth-service",
        action_taken: "suspended",
      })
      .catch((e) => logger.error(`Non-critical: honeypot logHit failed: ${e.message}`));

    // Auto-suspend the token.
    AccessTokenModel("airqo")
      .findOneAndUpdate(
        { token: rawToken },
        {
          $set: {
            "request_pattern.auto_suspended": true,
            "request_pattern.suspension_reason": `Honeypot access: ${path}`,
            "request_pattern.suspended_at": new Date(),
          },
        }
      )
      .catch((e) =>
        logger.error(`Non-critical: honeypot auto-suspend failed: ${e.message}`)
      );

    logger.warn(
      `🍯 Honeypot triggered — path=${path} token_suffix=...${tokenSuffix} ip=${ip}`
    );
  } else {
    logger.info(`🍯 Honeypot triggered (no token) — path=${path} ip=${ip}`);
  }

  // Return a plausible 404 — do not reveal this is a honeypot.
  return res.status(httpStatus.NOT_FOUND).json({
    success: false,
    message: "Resource not found",
    status: httpStatus.NOT_FOUND,
  });
};

module.exports = honeypotHandler;
