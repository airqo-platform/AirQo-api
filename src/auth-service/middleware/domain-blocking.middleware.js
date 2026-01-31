const {
  extractAndNormalizeDomain,
  getBlockedDomains,
} = require("@utils/token.util");
const { logObject, logText } = require("@utils/shared");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- domain-blocking-middleware`,
);

const domainBlockingMiddleware = async (req, res, next) => {
  try {
    const referer = req.headers.referer;
    const origin = req.headers.origin;
    const tenant = req.query.tenant || "airqo";

    let clientDomain = null;

    if (referer) {
      clientDomain = extractAndNormalizeDomain(referer);
    } else if (origin) {
      clientDomain = extractAndNormalizeDomain(origin);
    }

    if (!clientDomain) {
      // If no identifiable domain, proceed. We don't want to block legitimate direct API calls.
      return next();
    }

    const blockedDomains = await getBlockedDomains(tenant);

    if (blockedDomains.has(clientDomain)) {
      logger.warn(
        `🚫 Request blocked from domain: ${clientDomain} (Referer: ${referer || "N/A"}, Origin: ${origin || "N/A"})`,
      );
      return res.status(httpStatus.FORBIDDEN).json({
        success: false,
        message: "Access denied from this domain.",
        errors: { message: `Requests from ${clientDomain} are not allowed.` },
      });
    }

    // Check for subdomain blocking (e.g., blocking *.example.com)
    // This is a more advanced pattern and might require storing domains as regex or using a more complex matching logic.
    // For now, we'll stick to exact match for simplicity as requested.

    next();
  } catch (error) {
    logger.error(`🐛🐛 Error in domain blocking middleware: ${error.message}`);
    next(); // Fail open: don't block requests if the middleware itself fails
  }
};

module.exports = domainBlockingMiddleware;
