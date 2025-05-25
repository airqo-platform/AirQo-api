// utils/environment.util.js - Reusable environment detection utility

const constants = require("@config/constants");

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

    // Priority order of checks
    const detectionMethods = [
      () => this.checkNodeEnv(checks.nodeEnv),
      () => this.checkConstants(checks.constants),
      () => this.checkNpmScript(checks.npmScript),
      () => this.checkProcessArgs(checks.processArgs),
      () => this.checkPortBased(checks.port, checks.nodeEnv, checks.constants),
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

    // Default fallback
    const defaultEnv = "development";
    if (this.shouldLogDebug()) {
      console.log(`⚠️  Using default environment: ${defaultEnv.toUpperCase()}`);
      console.log("=====================================");
    }
    return defaultEnv;
  }

  // Gather all environment sources
  getAllEnvironmentSources() {
    return {
      nodeEnv: process.env.NODE_ENV,
      constants: constants.ENVIRONMENT,
      npmScript: process.env.npm_lifecycle_event,
      processArgs: process.argv,
      port: process.env.PORT || "3000",
      packageConfig: process.env.npm_package_config,
      npmConfigProduction: process.env.npm_config_production,
    };
  }

  // Check NODE_ENV
  checkNodeEnv(nodeEnv) {
    if (!nodeEnv) return "unknown";

    const env = nodeEnv.toLowerCase().trim();
    if (env === "development" || env === "dev") return "development";
    if (env === "production" || env === "prod") return "production";
    if (env === "staging" || env === "stage") return "staging";

    return "unknown";
  }

  // Check constants with pattern matching
  checkConstants(constantsEnv) {
    if (!constantsEnv) return "unknown";

    const env = constantsEnv.toLowerCase().trim();

    // Handle your specific case where constants.ENVIRONMENT is "DEVELOPMENT ENVIRONMENT"
    if (env.includes("development") || env.includes("dev"))
      return "development";
    if (env.includes("production") || env.includes("prod")) return "production";
    if (env.includes("staging") || env.includes("stage")) return "staging";

    return "unknown";
  }

  // Check NPM script being run
  checkNpmScript(npmScript) {
    if (!npmScript) return "unknown";

    const script = npmScript.toLowerCase();
    if (script.includes("dev")) return "development";
    if (script.includes("prod")) return "production";
    if (script.includes("stage")) return "staging";

    return "unknown";
  }

  // Check process arguments for indicators
  checkProcessArgs(processArgs) {
    if (!Array.isArray(processArgs)) return "unknown";

    const argsString = processArgs.join(" ").toLowerCase();

    // Check for nodemon (development indicator)
    if (argsString.includes("nodemon")) return "development";

    // Check for dev in arguments
    if (argsString.includes("dev")) return "development";

    return "unknown";
  }

  // Port-based detection (least reliable)
  checkPortBased(port, nodeEnv, constantsEnv) {
    const devPorts = ["3000", "3001", "8000", "8080", "9000"];
    const prodPorts = ["80", "443", "8080"];

    // Only use port as indicator if other methods didn't give clear results
    const nodeEnvLower = (nodeEnv || "").toLowerCase();
    const constantsLower = (constantsEnv || "").toLowerCase();

    // Don't override explicit production/staging settings
    if (
      nodeEnvLower === "production" ||
      constantsLower.includes("production")
    ) {
      return "unknown"; // Let other methods handle this
    }

    if (nodeEnvLower === "staging" || constantsLower.includes("staging")) {
      return "unknown"; // Let other methods handle this
    }

    // If using typical dev ports and no explicit prod/stage setting
    if (devPorts.includes(port)) {
      return "development";
    }

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
