// captcha.middleware.js
//
// hCaptcha verification middleware for public-facing endpoints.
//
// SETUP (before enabling):
//   1. Sign up at https://www.hcaptcha.com and create a site.
//   2. Add the secret key to your environment:
//        HCAPTCHA_SECRET_KEY=<your-secret-key>
//   3. Add the site key to the frontend (.env):
//        NEXT_PUBLIC_HCAPTCHA_SITE_KEY=<your-site-key>
//   4. In the frontend form, install and render the hCaptcha widget:
//        npm install @hcaptcha/react-hcaptcha
//      Then include <HCaptcha> and pass the token in the request body as
//      the field `captchaToken`.
//   5. Remove the `if (!secret) return next()` guard below to enforce CAPTCHA.
//
// The middleware is a no-op when HCAPTCHA_SECRET_KEY is not set, so it is
// safe to wire into routes before the secret is configured.

const https = require("https");
const querystring = require("querystring");
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- captcha-middleware`
);

const HCAPTCHA_VERIFY_URL = "https://hcaptcha.com/siteverify";

/**
 * Verify an hCaptcha token submitted by the client.
 *
 * Expects the token in `req.body.captchaToken`.
 * Returns 400 when the token is missing, 403 when verification fails.
 * Skips silently when HCAPTCHA_SECRET_KEY is not configured (dev / pre-launch).
 */
async function verifyCaptcha(req, res, next) {
  const secret = process.env.HCAPTCHA_SECRET_KEY;

  // No-op when secret is not configured — remove this guard to enforce CAPTCHA.
  if (!secret) {
    logger.warn(
      "verifyCaptcha: HCAPTCHA_SECRET_KEY not set — skipping CAPTCHA check"
    );
    return next();
  }

  const token = req.body?.captchaToken;
  if (!token) {
    return res.status(httpStatus.BAD_REQUEST).json({
      success: false,
      message: "CAPTCHA token is required",
      errors: { message: "Missing captchaToken in request body" },
    });
  }

  try {
    const verified = await verifyToken(secret, token, req.ip);
    if (!verified) {
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: "CAPTCHA verification failed",
        errors: { message: "Invalid or expired CAPTCHA token" },
      });
    }
    return next();
  } catch (error) {
    logger.error(`verifyCaptcha: hCaptcha API error — ${error.message}`);
    // Fail open on network errors so a hCaptcha outage doesn't block submissions.
    return next();
  }
}

/**
 * POST to the hCaptcha verification endpoint.
 * Returns true when the token is valid.
 */
function verifyToken(secret, token, remoteip) {
  return new Promise((resolve, reject) => {
    const body = querystring.stringify({ secret, response: token, remoteip });

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(body),
      },
    };

    const req = https.request(HCAPTCHA_VERIFY_URL, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.success === true);
        } catch {
          reject(new Error("Failed to parse hCaptcha response"));
        }
      });
    });

    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

module.exports = { verifyCaptcha };
