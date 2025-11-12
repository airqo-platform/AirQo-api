const { PostHog } = require("posthog-node");
const posthogConfig = require("@config/posthog");

class AnalyticsService {
  constructor() {
    this.client = null;
    if (posthogConfig.apiKey) {
      this.client = new PostHog(posthogConfig.apiKey, {
        host: posthogConfig.host,
        // Enable for production to batch events
        flushAt: 20, // Flush after 20 events
        flushInterval: 10000, // Flush every 10 seconds
      });
      console.log("✅ PostHog Analytics Service Initialized");
    } else {
      console.warn(
        "⚠️ PostHog API Key not found. Analytics service is disabled."
      );
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
    try {
      this.client.capture({
        distinctId,
        event,
        properties: {
          ...properties,
          environment: ["production", "development", "test"].includes(
            process.env.NODE_ENV
          )
            ? process.env.NODE_ENV
            : "unknown",
          timestamp: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Analytics tracking error:", error);
    }
  }

  /**
   * Identify a user with properties
   * @param {string} distinctId - Unique user identifier
   * @param {object} properties - User properties
   */
  identify(distinctId, properties = {}) {
    if (!this.client) return;
    try {
      this.client.identify({
        distinctId,
        properties,
      });
    } catch (error) {
      console.error("Analytics identify error:", error);
    }
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
    try {
      this.client.alias({
        distinctId,
        alias,
      });
    } catch (error) {
      console.error("Analytics alias error:", error);
    }
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
    try {
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
    } catch (error) {
      console.error("Analytics group error:", error);
    }
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
