// config/service-detector.js
// Auto-detect which service we're running in and provide appropriate configurations

const fs = require("fs");
const path = require("path");

class ServiceDetector {
  constructor() {
    this.serviceConfig = this.detectService();
  }

  /**
   * Node.js version-compatible recursive directory reading
   * Fallback for Node.js < 18.17.0 which doesn't support { recursive: true }
   */
  readdirRecursive(dirPath) {
    // Check Node.js version for recursive support
    const nodeVer = process.versions.node.split(".").map(Number);
    const hasRecursive =
      nodeVer[0] > 18 || (nodeVer[0] === 18 && nodeVer[1] >= 17);

    if (hasRecursive) {
      // Use native recursive option (Node.js >= 18.17.0)
      try {
        return fs.readdirSync(dirPath, { recursive: true });
      } catch (error) {
        // Fallback if native recursive fails for any reason
        console.warn(
          `⚠️  Native recursive readdir failed, using fallback: ${error.message}`
        );
      }
    }

    // Fallback implementation for older Node.js versions
    const walk = (dir) => {
      try {
        return fs.readdirSync(dir).flatMap((name) => {
          const fullPath = path.join(dir, name);
          try {
            return fs.statSync(fullPath).isDirectory()
              ? walk(fullPath)
              : [name]; // Return just the filename, not full path to match recursive: true behavior
          } catch (statError) {
            // Skip files we can't stat (permission issues, etc.)
            console.warn(`⚠️  Skipping file due to stat error: ${fullPath}`);
            return [];
          }
        });
      } catch (readdirError) {
        console.warn(`⚠️  Could not read directory: ${dir}`);
        return [];
      }
    };

    return walk(dirPath);
  }

  detectService() {
    try {
      // Method 1: Check package.json name
      const packageJsonPath = path.join(process.cwd(), "package.json");
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(
            fs.readFileSync(packageJsonPath, "utf8")
          );
          const packageName = packageJson.name?.toLowerCase() || "";

          if (
            packageName.includes("device") ||
            packageName.includes("registry")
          ) {
            return this.getDeviceRegistryConfig();
          } else if (packageName.includes("auth")) {
            return this.getAuthServiceConfig();
          }
        } catch (jsonError) {
          console.warn(
            `⚠️  Could not parse package.json: ${jsonError.message}`
          );
        }
      }

      // Method 2: Check environment variables
      const serviceName = (process.env.SERVICE_NAME || "").toLowerCase();
      if (serviceName.includes("device") || serviceName.includes("registry")) {
        return this.getDeviceRegistryConfig();
      } else if (serviceName.includes("auth")) {
        return this.getAuthServiceConfig();
      }

      // Method 3: Check for service-specific files/directories
      const currentDir = process.cwd();
      let files = [];

      try {
        files = fs.readdirSync(currentDir);
      } catch (readdirError) {
        console.warn(
          `⚠️  Could not read current directory: ${readdirError.message}`
        );
        return this.getGenericConfig();
      }

      // Look for auth-specific patterns
      const hasAuthPatterns = files.some(
        (file) =>
          file.includes("auth") ||
          file.includes("user") ||
          file.includes("login")
      );

      // Look for device-specific patterns
      const hasDevicePatterns = files.some(
        (file) =>
          file.includes("device") ||
          file.includes("registry") ||
          file.includes("measurement")
      );

      // Check models directory for more specific detection
      const modelsPath = path.join(currentDir, "models");
      if (fs.existsSync(modelsPath)) {
        try {
          const modelFiles = fs.readdirSync(modelsPath);
          const hasUserModel = modelFiles.some((file) =>
            file.toLowerCase().includes("user")
          );
          const hasDeviceModel = modelFiles.some((file) =>
            file.toLowerCase().includes("device")
          );

          if (hasUserModel && !hasDeviceModel) {
            return this.getAuthServiceConfig();
          } else if (hasDeviceModel && !hasUserModel) {
            return this.getDeviceRegistryConfig();
          } else if (hasDeviceModel && hasUserModel) {
            // Both exist, check routes or other indicators
            const routesPath = path.join(currentDir, "routes");
            if (fs.existsSync(routesPath)) {
              // FIXED: Use version-compatible recursive directory reading
              const routeFiles = this.readdirRecursive(routesPath);

              const authRoutes = routeFiles.filter(
                (file) =>
                  file.includes("user") ||
                  file.includes("auth") ||
                  file.includes("login")
              ).length;

              const deviceRoutes = routeFiles.filter(
                (file) =>
                  file.includes("device") ||
                  file.includes("measurement") ||
                  file.includes("site")
              ).length;

              if (authRoutes > deviceRoutes) {
                return this.getAuthServiceConfig();
              } else if (deviceRoutes > authRoutes) {
                return this.getDeviceRegistryConfig();
              }
            }
          }
        } catch (modelsError) {
          console.warn(
            `⚠️  Could not analyze models directory: ${modelsError.message}`
          );
        }
      }

      // Check for directory-based patterns if we found them earlier
      if (hasAuthPatterns && !hasDevicePatterns) {
        return this.getAuthServiceConfig();
      } else if (hasDevicePatterns && !hasAuthPatterns) {
        return this.getDeviceRegistryConfig();
      }

      // Method 4: Fallback - check current directory name
      const dirName = path.basename(currentDir).toLowerCase();
      if (dirName.includes("auth")) {
        return this.getAuthServiceConfig();
      } else if (dirName.includes("device") || dirName.includes("registry")) {
        return this.getDeviceRegistryConfig();
      }

      // Default fallback
      console.warn(
        "⚠️  Could not auto-detect service type, using generic configuration"
      );
      return this.getGenericConfig();
    } catch (error) {
      console.warn(`⚠️  Error detecting service type: ${error.message}`);
      return this.getGenericConfig();
    }
  }

  getAuthServiceConfig() {
    return {
      serviceName: "Auth Service",
      serviceType: "auth",
      kafkaTopics: [
        "ip-address",
        "deploy-topic",
        "recall-topic",
        "sites-topic",
      ],
      defaultConsumerGroup: "auth-service-consumer-group",
      jobPatterns: [
        "incomplete-profile",
        "token-expiration",
        "active-status-job",
        "preferences-log",
        "preferences-update",
        "profile-picture-update",
        "role-init",
        "user-activities",
        "auth-service",
        "mailer",
        "notification",
        "reminder",
        "email-job",
      ],
      emergencyScriptName: "emergency-auth-killer.js",
      cleanupScriptName: "cleanup-all-auth.js",
      diagnoseScriptName: "diagnose-auth-jobs.js",
      defaultPorts: [3000, 3001, 3002, 3003],
      description: "Authentication and User Management Service",
    };
  }

  getDeviceRegistryConfig() {
    return {
      serviceName: "Device Registry",
      serviceType: "device",
      kafkaTopics: ["hourly-measurements-topic", "airqo.forecasts"],
      defaultConsumerGroup: "device-registry-consumer-group",
      jobPatterns: [
        "store-signals",
        "store-readings",
        "check-network-status",
        "check-unassigned-devices",
        "check-unassigned-sites",
        "check-active-statuses",
        "check-duplicate-site-fields",
        "update-duplicate-site-fields",
        "health-tip-checker",
        "run-migrations",
        "migration",
        "device-registry",
      ],
      emergencyScriptName: "emergency-device-killer.js",
      cleanupScriptName: "cleanup-all-device.js",
      diagnoseScriptName: "diagnose-device-jobs.js",
      defaultPorts: [3000, 3001, 3002, 3003],
      description: "Device and Data Management Service",
    };
  }

  getGenericConfig() {
    return {
      serviceName: "Unknown Service",
      serviceType: "generic",
      kafkaTopics: [],
      defaultConsumerGroup: "default-consumer-group",
      jobPatterns: ["cron", "job", "schedule", "background", "worker", "task"],
      emergencyScriptName: "emergency-killer.js",
      cleanupScriptName: "cleanup-all.js",
      diagnoseScriptName: "diagnose-jobs.js",
      defaultPorts: [3000, 3001, 3002, 3003],
      description: "Generic Node.js Service",
    };
  }

  getConfig() {
    return this.serviceConfig;
  }

  printDetectionInfo() {
    const config = this.serviceConfig;
    const nodeVer = process.versions.node;

    console.log("🔍 Service Detection Results:");
    console.log(`   Node.js Version: ${nodeVer}`);
    console.log(`   Service: ${config.serviceName}`);
    console.log(`   Type: ${config.serviceType}`);
    console.log(`   Description: ${config.description}`);
    console.log(`   Kafka Topics: ${config.kafkaTopics?.join(", ") || "None"}`);
    console.log(`   Consumer Group: ${config.defaultConsumerGroup}`);
    console.log(
      `   Job Patterns: ${config.jobPatterns?.slice(0, 5).join(", ")}${
        config.jobPatterns?.length > 5 ? "..." : ""
      }`
    );
    console.log(
      `   Default Ports: ${config.defaultPorts?.join(", ") || "None"}`
    );
  }

  isAuthService() {
    return this.serviceConfig.serviceType === "auth";
  }

  isDeviceRegistry() {
    return this.serviceConfig.serviceType === "device";
  }

  isGeneric() {
    return this.serviceConfig.serviceType === "generic";
  }

  // Utility method to check Node.js version compatibility
  getNodeCompatibilityInfo() {
    const nodeVer = process.versions.node.split(".").map(Number);
    const hasRecursive =
      nodeVer[0] > 18 || (nodeVer[0] === 18 && nodeVer[1] >= 17);

    return {
      version: process.versions.node,
      major: nodeVer[0],
      minor: nodeVer[1],
      patch: nodeVer[2],
      hasRecursiveReaddir: hasRecursive,
      recommendUpgrade: !hasRecursive,
    };
  }
}

// Create singleton instance
const serviceDetector = new ServiceDetector();

// Export both the class and singleton instance
module.exports = {
  ServiceDetector,
  serviceDetector,
  getServiceConfig: () => serviceDetector.getConfig(),
  isAuthService: () => serviceDetector.isAuthService(),
  isDeviceRegistry: () => serviceDetector.isDeviceRegistry(),
  printDetectionInfo: () => serviceDetector.printDetectionInfo(),
  getNodeCompatibilityInfo: () => serviceDetector.getNodeCompatibilityInfo(),
};

// If run directly, show detection info
if (require.main === module) {
  serviceDetector.printDetectionInfo();

  // Also show Node.js compatibility info
  const compat = serviceDetector.getNodeCompatibilityInfo();
  console.log("\n📋 Node.js Compatibility:");
  console.log(
    `   Recursive readdir support: ${
      compat.hasRecursiveReaddir ? "✅ Yes" : "⚠️  No (fallback used)"
    }`
  );
  if (compat.recommendUpgrade) {
    console.log(
      `   💡 Consider upgrading to Node.js ≥18.17.0 for better performance`
    );
  }
}
