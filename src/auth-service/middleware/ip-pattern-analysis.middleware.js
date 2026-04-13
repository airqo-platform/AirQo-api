const IPRequestLogModel = require("@models/IPRequestLog");
const tokenUtil = require("@utils/token.util");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- ip-pattern-analysis.middleware`,
);

// Cap the number of concurrent background analysis operations.
// When the DB is slow, fire-and-forget promises accumulate in the event loop
// and drive up memory. Shedding work above this threshold prevents the OOM
// spiral seen during DB reconnect windows.
const MAX_CONCURRENT_ANALYSIS = 50;
let _pendingAnalysis = 0;

const analyzeIP = async (req, res, next) => {
  try {
    const ip =
      req.headers["x-client-ip"] || req.headers["x-client-original-ip"];
    // Get the original client URI from the NGINX header and normalize it by removing the query string.
    const originalUri =
      req.headers["x-original-uri"] || req.originalUrl || req.path;
    const endpoint = originalUri.split("?")[0];
    const token = req.params.token || req.query.token || req.body.token;
    const tenant = req.query.tenant || "airqo";

    if (ip) {
      if (_pendingAnalysis >= MAX_CONCURRENT_ANALYSIS) {
        logger.warn(
          `analyzeIP: backpressure limit reached (${_pendingAnalysis} pending), skipping background analysis for ${ip}`,
        );
      } else {
        _pendingAnalysis++;

        // Log the request without waiting for it to complete
        IPRequestLogModel(tenant)
          .recordRequest({ ip, endpoint, token })
          .catch((err) => logObject("Error in background IP recording", err))
          .finally(() => {
            _pendingAnalysis--;
          });

        // Asynchronously analyze the IP patterns
        tokenUtil
          .analyzeIPRequestPatterns({ ip, tenant, endpoint })
          .catch((err) => {
            logObject("Error in background IP analysis", err);
          });
      }
    }
  } catch (error) {
    logObject("Error in IP analysis middleware", error);
  }
  next();
};

module.exports = analyzeIP;
