const constants = require("@config/constants");
const { Paddle, Environment } = require("@paddle/paddle-node-sdk");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- paddle.config`
);

const rawKey = constants.PADDLE_API_KEY || "";
const cleanKey = rawKey.replace(/\s/g, "");
const environ = constants.PADDLE_ENVIRONMENT || "sandbox";

// A valid Paddle Billing key always starts with "pdl_"
const isPaddleConfigured =
  cleanKey.length > 0 && cleanKey.startsWith("pdl_");

if (!isPaddleConfigured) {
  logger.warn(
    "⚠️  Paddle is not configured — payment endpoints (checkout, webhook, " +
      "subscription management) will return 503 until valid credentials are " +
      "supplied via PADDLE_API_KEY / PADDLE_ENVIRONMENT."
  );
  if (cleanKey.length > 0) {
    logger.warn(
      "   Key present but invalid format. " +
        "Paddle Billing keys must start with 'pdl_'."
    );
  }
} else {
  logger.info(`✅ Paddle configured — environment: ${environ}`);
}

const paddleClient = isPaddleConfigured
  ? new Paddle(cleanKey, {
      environment: Environment[environ],
      logLevel: "verbose",
    })
  : null;

module.exports = { paddleClient, isPaddleConfigured };
