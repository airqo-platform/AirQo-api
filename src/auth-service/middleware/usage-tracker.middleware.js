const constants = require("@config/constants");
const usageRecorder = require("@utils/usage-recorder.util");

/**
 * Records the request nginx is asking auth-service to verify, i.e. the API call
 * the user is about to make against any AirQo service. Must run after JWT auth
 * (it needs req.user) and never blocks or fails the verify response: recording
 * is a synchronous in-memory counter bump.
 */
const trackApiUsage = (req, res, next) => {
  try {
    if (constants.USAGE_TRACKING_ENABLED && req.user && req.user._id) {
      usageRecorder.recordApiCall({
        tenant: req.query.tenant || req.body?.tenant,
        user: req.user,
        uri: req.headers["x-original-uri"],
        method: req.headers["x-original-method"],
      });
    }
  } catch (error) {
    // Usage tracking must never affect authentication.
  }
  next();
};

module.exports = { trackApiUsage };
