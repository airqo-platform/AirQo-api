const crypto = require("crypto");
const https = require("https");
const http = require("http");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- feedback-webhook-util`,
);

const { FeedbackWebhookModel } = require("@models/FeedbackWebhook");

const DISPATCH_TIMEOUT_MS = 10000;

const signPayload = (secret, body) =>
  "sha256=" +
  crypto.createHmac("sha256", secret).update(body, "utf8").digest("hex");

const postWebhook = (url, bodyStr, signature) =>
  new Promise((resolve, reject) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return reject(new Error(`Invalid webhook URL: ${url}`));
    }
    const isHttps = parsed.protocol === "https:";
    const lib = isHttps ? https : http;
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(bodyStr),
        "X-AirQo-Signature": signature,
        "User-Agent": "AirQo-Feedback-Webhook/1.0",
      },
    };

    const req = lib.request(options, (res) => {
      res.resume();
      resolve(res.statusCode);
    });

    req.setTimeout(DISPATCH_TIMEOUT_MS, () => {
      req.destroy(new Error("Webhook request timed out"));
    });

    req.on("error", reject);
    req.write(bodyStr);
    req.end();
  });

/**
 * Fires all active webhooks subscribed to `event` for the given tenant.
 * Always resolves — failures are logged but never propagate to the caller.
 *
 * @param {string} tenant
 * @param {string} event  - one of WEBHOOK_EVENTS
 * @param {object} payload - the event data to deliver
 */
const dispatchWebhooks = async (tenant, event, payload) => {
  try {
    const webhooks = await FeedbackWebhookModel(tenant).findActiveForEvent(
      tenant,
      event,
    );

    if (!webhooks || webhooks.length === 0) return;

    const envelope = {
      event,
      tenant,
      timestamp: new Date().toISOString(),
      data: payload,
    };
    const bodyStr = JSON.stringify(envelope);

    await Promise.allSettled(
      webhooks.map(async (wh) => {
        try {
          const signature = signPayload(wh.secret, bodyStr);
          const statusCode = await postWebhook(wh.url, bodyStr, signature);
          if (statusCode < 200 || statusCode >= 300) {
            logger.warn(
              `Webhook "${wh.name}" (${wh._id}) returned HTTP ${statusCode} for event ${event}`,
            );
          }
        } catch (err) {
          logger.warn(
            `Webhook "${wh.name}" (${wh._id}) failed for event ${event}: ${err.message}`,
          );
        }
      }),
    );
  } catch (err) {
    logger.error(`dispatchWebhooks error for event ${event}: ${err.message}`);
  }
};

module.exports = { dispatchWebhooks };
