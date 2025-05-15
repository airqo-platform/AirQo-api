// middleware/analytics.js
const { LogModel } = require("@models/log");
const constants = require("@config/constants");

module.exports = {
  trackRegistration: async (req, res, next) => {
    try {
      const { org_slug } = req.params;
      const { email } = req.body;
      const tenant = req.query.tenant || constants.DEFAULT_TENANT;

      // Log the registration event
      await LogModel(tenant).create({
        meta: {
          service: "auth",
          endpoint: `/api/v2/users/register/${org_slug}`,
          email,
          org_slug,
          ip_address: req.ip,
          user_agent: req.get("user-agent"),
        },
        message: `User registration attempt via branded URL: ${org_slug}`,
        level: "info",
        timestamp: new Date(),
      });

      next();
    } catch (error) {
      // Don't block the request if analytics fails
      logger.error(`Analytics tracking error: ${error.message}`);
      next();
    }
  },
};
