const IPRequestLogModel = require("@models/IPRequestLog");
const tokenUtil = require("@utils/token.util");
const { logObject } = require("@utils/shared");

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
      // Log the request without waiting for it to complete
      IPRequestLogModel(tenant)
        .recordRequest({ ip, endpoint, token })
        .catch((err) => logObject("Error in background IP recording", err));

      // Asynchronously analyze the IP patterns
      tokenUtil
        .analyzeIPRequestPatterns({ ip, tenant, endpoint })
        .catch((err) => {
          logObject("Error in background IP analysis", err);
        });
    }
  } catch (error) {
    logObject("Error in IP analysis middleware", error);
  }
  next();
};

module.exports = analyzeIP;
