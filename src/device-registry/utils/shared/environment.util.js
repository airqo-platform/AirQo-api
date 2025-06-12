// utils/environment.util.js - Reusable environment detection utility (No circular dependencies)

class EnvironmentDetector {
  constructor() {
    this.cache = null; // Cache the result to avoid repeated checks
  }

  // Main method to check if current environment is development
  isDevelopment() {
    if (this.cache !== null) {
      return this.cache === "development";
    }

    const env = this.detectEnvironment();
    this.cache = env;
    return env === "development";
  }

  // Main method to check if current environment is production
  isProduction() {
    if (this.cache !== null) {
      return this.cache === "production";
    }

    const env = this.detectEnvironment();
    this.cache = env;
    return env === "production";
  }

  // Main method to check if current environment is staging
  isStaging() {
    if (this.cache !== null) {
      return this.cache === "staging";
    }

    const env = this.detectEnvironment();
    this.cache = env;
    return env === "staging";
  }

  // Get the detected environment type
  getEnvironment() {
    if (this.cache !== null) {
      return this.cache;
    }

    const env = this.detectEnvironment();
    this.cache = env;
    return env;
  }

  // Core detection logic
  detectEnvironment() {
    const checks = this.getAllEnvironmentSources();

    // Log all sources for debugging (only in development-like scenarios)
    if (this.shouldLogDebug()) {
      console.log("=== ENVIRONMENT DETECTION SOURCES ===");
      Object.entries(checks).forEach(([key, value]) => {
        console.log(`${key}: ${JSON.stringify(value)}`);
      });
    }

    // Priority order of checks (removed constants check to avoid circular dependency)
    const detectionMethods = [
      () => this.checkNodeEnv(checks.nodeEnv),
      () => this.checkNpmScript(checks.npmScript),
      () => this.checkProcessArgs(checks.processArgs),
      () => this.checkPortBased(checks.port, checks.nodeEnv),
      () => this.checkConstantsSafe(checks.constants), // Safe constants check at lower priority
    ];

    for (const method of detectionMethods) {
      const result = method();
      if (result !== "unknown") {
        if (this.shouldLogDebug()) {
          console.log(`✅ Environment detected as: ${result.toUpperCase()}`);
          console.log("=====================================");
        }
        return result;
      }
    }

    // Default fallback - safer to default to development to avoid accidental production behavior
    const defaultEnv = "development";
    if (this.shouldLogDebug()) {
      console.log(`⚠️  Using default environment: ${defaultEnv.toUpperCase()}`);
      console.log("=====================================");
    }
    return defaultEnv;
  }

  // Gather all environment sources (without importing constants at module level)
  getAllEnvironmentSources() {
    return {
      nodeEnv: process.env.NODE_ENV,
      constants: this.getConstantsSafely(), // Dynamic import to avoid circular dependency
      npmScript: process.env.npm_lifecycle_event,
      processArgs: process.argv,
      port: process.env.PORT || "3000",
      packageConfig: process.env.npm_package_config,
      npmConfigProduction: process.env.npm_config_production,
    };
  }

  // Safely get constants without causing circular dependency
  getConstantsSafely() {
    try {
      // Dynamic import only when needed, not at module level
      const constants = require("@config/constants");
      return constants.ENVIRONMENT;
    } catch (error) {
      // If constants can't be loaded (circular dependency or other issue),
      // return undefined so other detection methods take precedence
      return undefined;
    }
  }

  // Check NODE_ENV (highest priority)
  checkNodeEnv(nodeEnv) {
    if (!nodeEnv) return "unknown";

    const env = nodeEnv.toLowerCase().trim();
    if (env === "development" || env === "dev") return "development";
    if (env === "production" || env === "prod") return "production";
    if (env === "staging" || env === "stage") return "staging";

    return "unknown";
  }

  // Check NPM script being run (second priority)
  checkNpmScript(npmScript) {
    if (!npmScript) return "unknown";

    const script = npmScript.toLowerCase();
    if (script.includes("dev")) return "development";
    if (script.includes("prod")) return "production";
    if (script.includes("stage")) return "staging";

    return "unknown";
  }

  // Check process arguments for indicators (third priority)
  checkProcessArgs(processArgs) {
    if (!Array.isArray(processArgs)) return "unknown";

    const argsString = processArgs.join(" ").toLowerCase();

    // Check for nodemon (development indicator)
    if (argsString.includes("nodemon")) return "development";

    // Check for dev in arguments
    if (argsString.includes("dev")) return "development";

    return "unknown";
  }

  // Port-based detection (fourth priority - less reliable)
  checkPortBased(port, nodeEnv) {
    const devPorts = ["3000", "3001", "8000", "8080", "9000"];

    // Only use port as indicator if other methods didn't give clear results
    const nodeEnvLower = (nodeEnv || "").toLowerCase();

    // Don't override explicit production/staging settings
    if (nodeEnvLower === "production" || nodeEnvLower === "staging") {
      return "unknown"; // Let other methods handle this
    }

    // If using typical dev ports and no explicit prod/stage setting
    if (devPorts.includes(port)) {
      return "development";
    }

    return "unknown";
  }

  // Safe constants check (lowest priority to avoid circular dependency issues)
  checkConstantsSafe(constantsEnv) {
    if (!constantsEnv) return "unknown";

    const env = constantsEnv.toLowerCase().trim();

    // Handle your specific case where constants.ENVIRONMENT might be "DEVELOPMENT ENVIRONMENT"
    if (env.includes("development") || env.includes("dev"))
      return "development";
    if (env.includes("production") || env.includes("prod")) return "production";
    if (env.includes("staging") || env.includes("stage")) return "staging";

    return "unknown";
  }

  // Determine if we should log debug information
  shouldLogDebug() {
    // Log debug info if NODE_ENV is not production or if explicitly requested
    const nodeEnv = (process.env.NODE_ENV || "").toLowerCase();
    const debugEnabled = process.env.DEBUG_ENV === "true";

    return nodeEnv !== "production" || debugEnabled;
  }

  // Reset cache (useful for testing or dynamic environment changes)
  resetCache() {
    this.cache = null;
  }

  // Get detailed environment information
  getDetailedInfo() {
    return {
      detected: this.getEnvironment(),
      sources: this.getAllEnvironmentSources(),
      isDevelopment: this.isDevelopment(),
      isProduction: this.isProduction(),
      isStaging: this.isStaging(),
    };
  }
}

// Create singleton instance
const environmentDetector = new EnvironmentDetector();

// Export both the class and convenient methods
module.exports = {
  EnvironmentDetector,
  isDevelopment: () => environmentDetector.isDevelopment(),
  isProduction: () => environmentDetector.isProduction(),
  isStaging: () => environmentDetector.isStaging(),
  getEnvironment: () => environmentDetector.getEnvironment(),
  getDetailedInfo: () => environmentDetector.getDetailedInfo(),
  resetCache: () => environmentDetector.resetCache(),
};
