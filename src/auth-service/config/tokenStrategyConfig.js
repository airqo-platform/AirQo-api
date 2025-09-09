// config/tokenStrategyConfig.js

const { TOKEN_STRATEGIES } = require("@config/constants");

class TokenStrategyConfig {
  constructor() {
    this.defaultStrategy = TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS;
    this.userStrategyOverrides = new Map();
    this.organizationStrategies = new Map();
    this.performanceMetrics = new Map();

    // Initialize default configurations
    this.initializeDefaults();
  }

  initializeDefaults() {
    // Set organization-specific default strategies
    this.organizationStrategies.set(
      "airqo",
      TOKEN_STRATEGIES.NO_ROLES_AND_PERMISSIONS
    );
    this.organizationStrategies.set("kcca", TOKEN_STRATEGIES.COMPRESSED);

    // Initialize performance tracking
    this.performanceMetrics.set("tokenGenerationTime", new Map());
    this.performanceMetrics.set("tokenSize", new Map());
    this.performanceMetrics.set("decodingTime", new Map());
  }

  /**
   * Get recommended strategy for a user
   */
  getStrategyForUser(userId, userPreference = null, organizationHint = null) {
    // Priority order:
    // 1. User-specific override
    // 2. User preference (if valid)
    // 3. Organization default
    // 4. Global default

    if (this.userStrategyOverrides.has(userId)) {
      return this.userStrategyOverrides.get(userId);
    }

    if (
      userPreference &&
      Object.values(TOKEN_STRATEGIES).includes(userPreference)
    ) {
      return userPreference;
    }

    if (organizationHint && this.organizationStrategies.has(organizationHint)) {
      return this.organizationStrategies.get(organizationHint);
    }

    return this.defaultStrategy;
  }

  /**
   * Set default strategy globally
   */
  setDefaultStrategy(strategy) {
    if (!Object.values(TOKEN_STRATEGIES).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    this.defaultStrategy = strategy;
    console.log(`🔧 Global default token strategy set to: ${strategy}`);
  }

  /**
   * Set strategy for specific organization
   */
  setOrganizationStrategy(organization, strategy) {
    if (!Object.values(TOKEN_STRATEGIES).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    this.organizationStrategies.set(organization, strategy);
    console.log(
      `🏢 Organization ${organization} token strategy set to: ${strategy}`
    );
  }

  /**
   * Override strategy for specific user (admin function)
   */
  setUserStrategyOverride(userId, strategy) {
    if (!Object.values(TOKEN_STRATEGIES).includes(strategy)) {
      throw new Error(`Invalid strategy: ${strategy}`);
    }
    this.userStrategyOverrides.set(userId, strategy);
    console.log(`👤 User ${userId} strategy override set to: ${strategy}`);
  }

  /**
   * Remove user strategy override
   */
  removeUserStrategyOverride(userId) {
    const removed = this.userStrategyOverrides.delete(userId);
    if (removed) {
      console.log(`👤 User ${userId} strategy override removed`);
    }
    return removed;
  }

  /**
   * Get strategy performance metrics
   */
  getPerformanceMetrics(strategy = null) {
    if (strategy) {
      return {
        strategy,
        generationTime:
          this.performanceMetrics.get("tokenGenerationTime").get(strategy) ||
          [],
        tokenSize: this.performanceMetrics.get("tokenSize").get(strategy) || [],
        decodingTime:
          this.performanceMetrics.get("decodingTime").get(strategy) || [],
      };
    }

    const allMetrics = {};
    for (const strategyKey of Object.values(TOKEN_STRATEGIES)) {
      allMetrics[strategyKey] = this.getPerformanceMetrics(strategyKey);
    }
    return allMetrics;
  }

  /**
   * Record performance metric
   */
  recordPerformanceMetric(strategy, metricType, value) {
    const metricsMap = this.performanceMetrics.get(metricType);
    if (!metricsMap) {
      console.warn(`Unknown metric type: ${metricType}`);
      return;
    }

    if (!metricsMap.has(strategy)) {
      metricsMap.set(strategy, []);
    }

    const metrics = metricsMap.get(strategy);
    metrics.push({
      value,
      timestamp: Date.now(),
    });

    // Keep only last 100 measurements per strategy
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  /**
   * Get strategy recommendations based on performance
   */
  getPerformanceBasedRecommendations() {
    const recommendations = {};

    for (const strategy of Object.values(TOKEN_STRATEGIES)) {
      const metrics = this.getPerformanceMetrics(strategy);

      const avgGenerationTime = this.calculateAverage(
        metrics.generationTime.map((m) => m.value)
      );

      const avgTokenSize = this.calculateAverage(
        metrics.tokenSize.map((m) => m.value)
      );

      const avgDecodingTime = this.calculateAverage(
        metrics.decodingTime.map((m) => m.value)
      );

      recommendations[strategy] = {
        performanceScore: this.calculatePerformanceScore(
          avgGenerationTime,
          avgTokenSize,
          avgDecodingTime
        ),
        metrics: {
          avgGenerationTime,
          avgTokenSize,
          avgDecodingTime,
        },
        recommendation: this.getStrategyRecommendation(strategy, {
          avgGenerationTime,
          avgTokenSize,
          avgDecodingTime,
        }),
      };
    }

    return recommendations;
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  calculatePerformanceScore(generationTime, tokenSize, decodingTime) {
    // Lower is better for all metrics
    // Normalize and weight the metrics
    const normalizedGenTime = Math.min(generationTime / 100, 1); // Normalize to max 100ms
    const normalizedSize = Math.min(tokenSize / 5000, 1); // Normalize to max 5000 bytes
    const normalizedDecTime = Math.min(decodingTime / 50, 1); // Normalize to max 50ms

    // Weight: size=50%, genTime=30%, decTime=20%
    return (
      normalizedSize * 0.5 + normalizedGenTime * 0.3 + normalizedDecTime * 0.2
    );
  }

  getStrategyRecommendation(strategy, metrics) {
    const { avgGenerationTime, avgTokenSize, avgDecodingTime } = metrics;

    if (avgTokenSize < 1000 && avgGenerationTime < 50 && avgDecodingTime < 20) {
      return "Excellent - Recommended for all use cases";
    } else if (avgTokenSize < 2000 && avgGenerationTime < 100) {
      return "Good - Suitable for most applications";
    } else if (avgTokenSize < 3000) {
      return "Fair - Consider for low-bandwidth scenarios";
    } else {
      return "Poor - Use only if other strategies fail";
    }
  }

  /**
   * Exports the current configuration as a plain object
   */
  exportConfig() {
    return {
      defaultStrategy: this.defaultStrategy,
      userStrategyOverrides: Object.fromEntries(this.userStrategyOverrides),
      organizationStrategies: Object.fromEntries(this.organizationStrategies),
    };
  }
}

// Create singleton instance
const tokenConfig = new TokenStrategyConfig();

module.exports = {
  tokenConfig,
  TokenStrategyConfig,
};
