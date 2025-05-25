// scripts/check-environment.js - Comprehensive environment diagnostic

// ============================================================================
// IMPORTS - All at the top
// ============================================================================
require("module-alias/register");
const dotenv = require("dotenv");
dotenv.config();
require("app-module-path").addPath(__dirname + "/..");

// Core imports
const path = require("path");
const fs = require("fs");

// Optional imports with fallbacks
let constants = null;
let environmentUtils = null;

try {
  constants = require("@config/constants");
} catch (error) {
  console.warn("⚠️  Could not load constants:", error.message);
}

try {
  environmentUtils = require("@utils/shared");
} catch (error) {
  console.warn("⚠️  Could not load environment utils:", error.message);
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Colors for console output
const colors = {
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  reset: "\x1b[0m",
};

const log = (color, ...args) => console.log(color, ...args, colors.reset);

// ============================================================================
// MAIN DIAGNOSTIC SCRIPT
// ============================================================================

try {
  console.log("\n" + "=".repeat(60));
  log(colors.cyan, "🔍 COMPREHENSIVE ENVIRONMENT DIAGNOSTIC");
  console.log("=".repeat(60));

  // 1. Script Information
  log(colors.blue, "\n📁 SCRIPT INFORMATION:");
  console.log("Script location:", __filename);
  console.log("Working directory:", process.cwd());
  console.log("Root directory:", path.join(__dirname, ".."));

  // 2. Import Status
  log(colors.blue, "\n📦 IMPORT STATUS:");
  console.log("Constants loaded:", constants ? "✅ Yes" : "❌ No");
  console.log(
    "Environment utils loaded:",
    environmentUtils ? "✅ Yes" : "❌ No"
  );

  // 3. Basic Environment Variables
  log(colors.blue, "\n📊 BASIC ENVIRONMENT VARIABLES:");
  console.log("NODE_ENV:", JSON.stringify(process.env.NODE_ENV));
  console.log("NODE_ENV type:", typeof process.env.NODE_ENV);
  console.log("NODE_ENV length:", process.env.NODE_ENV?.length || 0);

  if (process.env.NODE_ENV) {
    console.log(
      "NODE_ENV characters:",
      Array.from(process.env.NODE_ENV).map(
        (char) => `'${char}'(${char.charCodeAt(0)})`
      )
    );
    console.log(
      "NODE_ENV trimmed:",
      JSON.stringify(process.env.NODE_ENV.trim())
    );
    console.log(
      "NODE_ENV lowercase:",
      JSON.stringify(process.env.NODE_ENV.toLowerCase())
    );
  }

  console.log(
    "npm_lifecycle_event:",
    JSON.stringify(process.env.npm_lifecycle_event)
  );
  console.log(
    "npm_config_production:",
    JSON.stringify(process.env.npm_config_production)
  );
  console.log("PORT:", JSON.stringify(process.env.PORT || "default"));

  // 4. Process Information
  log(colors.blue, "\n🔧 PROCESS INFORMATION:");
  console.log("Process PID:", process.pid);
  console.log("Process title:", process.title);
  console.log("Process argv:", process.argv.slice(2));
  console.log("Working directory:", process.cwd());
  console.log("Node version:", process.version);

  // 5. Constants Analysis
  log(colors.blue, "\n⚙️  CONSTANTS ANALYSIS:");
  if (constants) {
    console.log(
      "constants.ENVIRONMENT:",
      JSON.stringify(constants.ENVIRONMENT)
    );
    console.log("constants.ENVIRONMENT type:", typeof constants.ENVIRONMENT);
    console.log(
      "constants.ENVIRONMENT length:",
      constants.ENVIRONMENT?.length || 0
    );

    if (constants.ENVIRONMENT) {
      console.log(
        "Character codes:",
        Array.from(constants.ENVIRONMENT).map((char) => char.charCodeAt(0))
      );
      console.log("Trimmed:", JSON.stringify(constants.ENVIRONMENT.trim()));
      console.log(
        "Lowercase:",
        JSON.stringify(constants.ENVIRONMENT.toLowerCase())
      );
    }

    // Additional constants that might be relevant
    if (constants.PORT) console.log("constants.PORT:", constants.PORT);
    if (constants.NODE_ENV)
      console.log("constants.NODE_ENV:", constants.NODE_ENV);
    if (constants.DEFAULT_TENANT)
      console.log("constants.DEFAULT_TENANT:", constants.DEFAULT_TENANT);
  } else {
    log(colors.red, "❌ Constants not loaded - cannot analyze");
  }

  // 6. Environment Detection Tests
  log(colors.blue, "\n🧪 ENVIRONMENT DETECTION TESTS:");
  const nodeEnv = process.env.NODE_ENV;
  const nodeEnvLower = nodeEnv?.toLowerCase()?.trim();

  console.log(`NODE_ENV === "development": ${nodeEnv === "development"}`);
  console.log(`NODE_ENV === "production": ${nodeEnv === "production"}`);
  console.log(`NODE_ENV === "staging": ${nodeEnv === "staging"}`);
  console.log(
    `NODE_ENV (lowercase) === "development": ${nodeEnvLower === "development"}`
  );
  console.log(`NODE_ENV !== "development": ${nodeEnv !== "development"}`);

  if (constants) {
    const constantsEnv = constants.ENVIRONMENT;
    const constantsEnvLower = constantsEnv?.toLowerCase()?.trim();

    console.log(
      `constants.ENVIRONMENT === "development": ${constantsEnv ===
        "development"}`
    );
    console.log(
      `constants.ENVIRONMENT === "DEVELOPMENT ENVIRONMENT": ${constantsEnv ===
        "DEVELOPMENT ENVIRONMENT"}`
    );
    console.log(
      `constants.ENVIRONMENT (lowercase) includes "development": ${constantsEnvLower?.includes(
        "development"
      )}`
    );
    console.log(
      `constants.ENVIRONMENT !== "development": ${constantsEnv !==
        "development"}`
    );
    console.log(
      `constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT": ${constantsEnv !==
        "DEVELOPMENT ENVIRONMENT"}`
    );
  } else {
    log(colors.yellow, "⚠️  Cannot test constants-based conditions");
  }

  // 7. Kafka Decision Logic
  log(colors.blue, "\n🚀 KAFKA DECISION LOGIC:");
  if (constants) {
    // Your current working condition
    const shouldStartKafka1 =
      constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT";
    console.log(
      `constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT": ${shouldStartKafka1}`
    );
    log(
      shouldStartKafka1 ? colors.yellow : colors.green,
      `Kafka will ${
        shouldStartKafka1 ? "START" : "NOT START"
      } with current logic`
    );
  }

  // Alternative conditions
  const shouldStartKafka2 = process.env.NODE_ENV !== "development";
  console.log(`NODE_ENV !== "development": ${shouldStartKafka2}`);
  log(
    shouldStartKafka2 ? colors.yellow : colors.green,
    `Kafka will ${
      shouldStartKafka2 ? "START" : "NOT START"
    } with NODE_ENV check`
  );

  if (constants) {
    const shouldStartKafka3 = !constants.ENVIRONMENT?.toLowerCase()?.includes(
      "development"
    );
    console.log(
      `!constants.ENVIRONMENT.toLowerCase().includes("development"): ${shouldStartKafka3}`
    );
    log(
      shouldStartKafka3 ? colors.yellow : colors.green,
      `Kafka will ${
        shouldStartKafka3 ? "START" : "NOT START"
      } with pattern matching`
    );
  }

  const shouldStartKafka4 = ["production", "staging"].includes(
    process.env.NODE_ENV?.toLowerCase()
  );
  console.log(`NODE_ENV in ["production", "staging"]: ${shouldStartKafka4}`);
  log(
    shouldStartKafka4 ? colors.yellow : colors.green,
    `Kafka will ${
      shouldStartKafka4 ? "START" : "NOT START"
    } with whitelist approach`
  );

  // 8. Recommended Solutions
  log(colors.blue, "\n💡 RECOMMENDED CONDITIONS:");
  const recommendedConditions = [
    {
      name: "Direct NODE_ENV check",
      condition: `process.env.NODE_ENV !== "development"`,
      safe: true,
    },
    {
      name: "Case-insensitive NODE_ENV",
      condition: `process.env.NODE_ENV?.toLowerCase() !== "development"`,
      safe: true,
    },
    {
      name: "Multiple development variants",
      condition: `!["development", "dev", "local"].includes(process.env.NODE_ENV?.toLowerCase())`,
      safe: true,
    },
    {
      name: "Production/Staging only",
      condition: `["production", "staging"].includes(process.env.NODE_ENV?.toLowerCase())`,
      safe: true,
    },
    {
      name: "Constants pattern matching",
      condition: `!constants.ENVIRONMENT?.toLowerCase()?.includes("development")`,
      safe: false,
      note: "Less reliable due to constants transformation",
    },
  ];

  recommendedConditions.forEach((rec, index) => {
    const status = rec.safe
      ? colors.green + "✅ SAFE"
      : colors.yellow + "⚠️  RISKY";
    console.log(`${index + 1}. ${rec.name}:`);
    console.log(`   ${rec.condition}`);
    console.log(`   ${status}${colors.reset}`);
    if (rec.note) console.log(`   Note: ${rec.note}`);
    console.log();
  });

  // 9. Current Status Summary
  log(colors.blue, "\n📋 CURRENT STATUS SUMMARY:");
  if (constants) {
    const currentCheck = constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT";
    const recommendedCheck =
      process.env.NODE_ENV?.toLowerCase() !== "development";

    if (currentCheck === recommendedCheck) {
      log(colors.green, "✅ Current and recommended checks agree");
    } else {
      log(colors.yellow, "⚠️  Current and recommended checks disagree!");
      console.log(
        `   Current (constants): Kafka will ${
          currentCheck ? "START" : "NOT start"
        }`
      );
      console.log(
        `   Recommended (NODE_ENV): Kafka will ${
          recommendedCheck ? "START" : "NOT start"
        }`
      );
    }

    console.log(
      `\nKafka will ${currentCheck ? "START" : "NOT start"} with current logic`
    );
  } else {
    log(
      colors.red,
      "❌ Cannot determine current status (constants not loaded)"
    );
  }

  // 10. Environment Utility Test
  log(colors.blue, "\n🛠️  ENVIRONMENT UTILITY TEST:");
  if (environmentUtils) {
    try {
      // Try different ways to access the utility functions
      if (environmentUtils.getDetailedInfo) {
        const detailedInfo = environmentUtils.getDetailedInfo();
        console.log("Detected environment:", detailedInfo.detected);
        console.log("Is development:", detailedInfo.isDevelopment);
        console.log("Is production:", detailedInfo.isProduction);
        console.log("Is staging:", detailedInfo.isStaging);
      } else if (environmentUtils.isDevelopment) {
        console.log("Is development:", environmentUtils.isDevelopment());
        console.log(
          "Is production:",
          environmentUtils.isProduction
            ? environmentUtils.isProduction()
            : "N/A"
        );
        console.log(
          "Is staging:",
          environmentUtils.isStaging ? environmentUtils.isStaging() : "N/A"
        );
        console.log(
          "Environment:",
          environmentUtils.getEnvironment
            ? environmentUtils.getEnvironment()
            : "N/A"
        );
      } else {
        console.log("Available utils:", Object.keys(environmentUtils));
      }
    } catch (error) {
      log(
        colors.yellow,
        "⚠️  Error testing environment utility:",
        error.message
      );
    }
  } else {
    log(colors.yellow, "⚠️  Environment utility not available");
  }

  // 11. Package.json Script Detection
  log(colors.blue, "\n📦 PACKAGE.JSON SCRIPT DETECTION:");
  const packagePath = path.join(__dirname, "../package.json");
  if (fs.existsSync(packagePath)) {
    try {
      const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8"));
      console.log("npm_lifecycle_event:", process.env.npm_lifecycle_event);

      if (process.env.npm_lifecycle_event && packageJson.scripts) {
        const script = packageJson.scripts[process.env.npm_lifecycle_event];
        console.log("Current script command:", script);

        const isDevScript = process.env.npm_lifecycle_event.includes("dev");
        console.log("Is dev script:", isDevScript);

        const scriptIncludesNodemon = script?.includes("nodemon");
        console.log("Script uses nodemon:", scriptIncludesNodemon);
      }
    } catch (error) {
      log(colors.red, "❌ Error reading package.json:", error.message);
    }
  } else {
    log(colors.yellow, "⚠️  package.json not found at:", packagePath);
  }

  console.log("\n" + "=".repeat(60));
  log(colors.cyan, "🎯 DIAGNOSIS COMPLETE");
  console.log("=".repeat(60) + "\n");
} catch (error) {
  log(colors.red, "💥 DIAGNOSTIC SCRIPT ERROR:", error.message);
  console.log("Stack trace:", error.stack);

  // Basic fallback information
  console.log("\n=== BASIC FALLBACK INFO ===");
  console.log("NODE_ENV:", process.env.NODE_ENV);
  console.log("Script location:", __filename);
  console.log("Working directory:", process.cwd());
}
