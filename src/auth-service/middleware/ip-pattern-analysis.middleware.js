const IPRequestLogModel = require("@models/IPRequestLog");
const tokenUtil = require("@utils/token.util");
const { logObject } = require("@utils/shared");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- ip-pattern-analysis.middleware`,
);

// Read from constants so the limit can be tuned per deployment via
// the IP_ANALYSIS_CONCURRENCY environment variable without a code change.
const MAX_CONCURRENT_ANALYSIS =
  constants.IP_ANALYSIS_CONCURRENCY || 50;
let _pendingAnalysis = 0;

// Only log the backpressure warning on the transition into the overloaded
// state, not on every subsequent request. This avoids flooding logs with
// warn-level noise right when the service is already degraded.
let _atCapacity = false;

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
        if (!_atCapacity) {
          _atCapacity = true;
          logger.warn(
            `analyzeIP: backpressure limit reached (${_pendingAnalysis} pending), shedding background analysis until load reduces`,
          );
        }
      } else {
        if (_atCapacity) {
          _atCapacity = false;
          logger.info(
            `analyzeIP: backpressure recovered (${_pendingAnalysis} pending), resuming background analysis`,
          );
        }
        _pendingAnalysis++;

        // Account for both background operations in the concurrency counter
        // so that a slow analyzeIPRequestPatterns cannot accumulate unbounded
        // promises independently of recordRequest.
        Promise.allSettled([
          IPRequestLogModel(tenant)
            .recordRequest({ ip, endpoint, token })
            .catch((err) => logObject("Error in background IP recording", err)),
          tokenUtil
            .analyzeIPRequestPatterns({ ip, tenant, endpoint })
            .catch((err) => logObject("Error in background IP analysis", err)),
        ]).finally(() => {
          _pendingAnalysis--;
        });
      }
    }
  } catch (error) {
    logObject("Error in IP analysis middleware", error);
  }
  next();
};

module.exports = analyzeIP;
