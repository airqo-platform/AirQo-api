const { PostHog } = require("posthog-node");
const posthogConfig = require("@config/posthog");
const constants = require("@config/constants");

class AnalyticsService {
  constructor() {
    this.client = null;
    if (constants.POSTHOG_ENABLED && posthogConfig.apiKey) {
      this.client = new PostHog(posthogConfig.apiKey, {
        host: posthogConfig.host,
        // The PostHog library batches events asynchronously.
        // These settings are safe for production.
        flushAt: 20,
        flushInterval: 10000,
      });
      console.log("✅ PostHog Analytics Service Initialized");
    } else {
      console.warn("⚠️ PostHog Analytics Service is DISABLED.");
    }
  }

  /**
   * Track a custom event
   * @param {string} distinctId - Unique user identifier
   * @param {string} event - Event name
   * @param {object} properties - Event properties
   */
  track(distinctId, event, properties = {}) {
    if (!this.client) return;
    // No try-catch needed here as posthog-node handles errors internally
    // and does not throw. It logs errors to the console.
    this.client.capture({
      distinctId,
      event,
      properties: {
        ...properties,
        environment: constants.ENVIRONMENT,
        timestamp: new Date().toISOString(),
      },
    });
  }

  /**
   * Identify a user with properties
   * @param {string} distinctId - Unique user identifier
   * @param {object} properties - User properties
   */
  identify(distinctId, properties = {}) {
    if (!this.client) return;
    this.client.identify({
      distinctId,
      properties,
    });
  }

  /**
   * Track a page view
   * @param {string} distinctId - Unique user identifier
   * @param {string} pageName - Page/Route name
   * @param {object} properties - Additional properties
   */
  pageView(distinctId, pageName, properties = {}) {
    if (!this.client) return;
    this.track(distinctId, "$pageview", {
      ...properties,
      $current_url: pageName,
    });
  }

  /**
   * Create an alias for a user (e.g., anonymous → authenticated)
   * @param {string} alias - New identifier
   * @param {string} distinctId - Original identifier
   */
  alias(alias, distinctId) {
    if (!this.client) return;
    this.client.alias({
      distinctId,
      alias,
    });
  }

  /**
   * Group users (for B2B - organizations, teams, etc.)
   * @param {string} distinctId - User identifier
   * @param {string} groupType - Type of group (e.g., 'company', 'team')
   * @param {string} groupKey - Group identifier
   * @param {object} groupProperties - Group properties
   */
  group(distinctId, groupType, groupKey, groupProperties = {}) {
    if (!this.client) return;
    this.client.groupIdentify({
      groupType,
      groupKey,
      properties: groupProperties,
    });

    this.client.capture({
      distinctId,
      event: "$group",
      properties: {
        $group_type: groupType,
        $group_key: groupKey,
      },
    });
  }

  /**
   * Flush all pending events and close connection
   * Call this on server shutdown
   */
  async shutdown() {
    if (!this.client) return;
    await this.client.shutdown();
  }
}

// Singleton instance
const analyticsService = new AnalyticsService();

module.exports = analyticsService;
