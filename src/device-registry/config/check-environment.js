// scripts/check-environment.js - Comprehensive environment diagnostic

require("module-alias/register");
const dotenv = require("dotenv");
dotenv.config();
require("app-module-path").addPath(__dirname + "/..");

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

try {
  console.log("\n" + "=".repeat(60));
  log(colors.cyan, "🔍 COMPREHENSIVE ENVIRONMENT DIAGNOSTIC");
  console.log("=".repeat(60));

  // 1. Basic Environment Variables
  log(colors.blue, "\n📊 BASIC ENVIRONMENT VARIABLES:");
  console.log("NODE_ENV:", JSON.stringify(process.env.NODE_ENV));
  console.log(
    "npm_lifecycle_event:",
    JSON.stringify(process.env.npm_lifecycle_event)
  );
  console.log(
    "npm_config_production:",
    JSON.stringify(process.env.npm_config_production)
  );
  console.log("PORT:", JSON.stringify(process.env.PORT || "default"));

  // 2. Process Information
  log(colors.blue, "\n🔧 PROCESS INFORMATION:");
  console.log("Process PID:", process.pid);
  console.log("Process title:", process.title);
  console.log("Process argv:", process.argv.slice(2));
  console.log("Working directory:", process.cwd());

  // 3. Constants Analysis
  log(colors.blue, "\n⚙️  CONSTANTS ANALYSIS:");
  try {
    const constants = require("@config/constants");
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
  } catch (error) {
    log(colors.red, "❌ Error loading constants:", error.message);
  }

  // 4. Environment Detection Tests
  log(colors.blue, "\n🧪 ENVIRONMENT DETECTION TESTS:");

  const nodeEnv = process.env.NODE_ENV;
  const nodeEnvLower = nodeEnv?.toLowerCase()?.trim();

  console.log(`NODE_ENV === "development": ${nodeEnv === "development"}`);
  console.log(`NODE_ENV === "production": ${nodeEnv === "production"}`);
  console.log(`NODE_ENV === "staging": ${nodeEnv === "staging"}`);
  console.log(
    `NODE_ENV (lowercase) === "development": ${nodeEnvLower === "development"}`
  );

  try {
    const constants = require("@config/constants");
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
  } catch (error) {
    log(colors.red, "❌ Cannot test constants");
  }

  // 5. Kafka Decision Logic
  log(colors.blue, "\n🚀 KAFKA DECISION LOGIC:");

  try {
    const constants = require("@config/constants");

    // Your current working condition
    const shouldStartKafka1 =
      constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT";
    console.log(
      `constants.ENVIRONMENT !== "DEVELOPMENT ENVIRONMENT": ${shouldStartKafka1}`
    );

    // Alternative conditions
    const shouldStartKafka2 = process.env.NODE_ENV !== "development";
    console.log(`NODE_ENV !== "development": ${shouldStartKafka2}`);

    const shouldStartKafka3 = !constants.ENVIRONMENT?.toLowerCase()?.includes(
      "development"
    );
    console.log(
      `!constants.ENVIRONMENT.toLowerCase().includes("development"): ${shouldStartKafka3}`
    );

    const shouldStartKafka4 =
      process.env.NODE_ENV === "production" ||
      process.env.NODE_ENV === "staging";
    console.log(
      `NODE_ENV === "production" || NODE_ENV === "staging": ${shouldStartKafka4}`
    );
  } catch (error) {
    log(colors.red, "❌ Cannot test Kafka logic");
  }

  // 6. Recommended Solutions
  log(colors.blue, "\n💡 RECOMMENDED CONDITIONS:");

  // Best practices for environment checking
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

  // 7. Current Status Summary
  log(colors.blue, "\n📋 CURRENT STATUS SUMMARY:");

  try {
    const constants = require("@config/constants");
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
  } catch (error) {
    log(colors.red, "❌ Cannot determine current status");
  }

  // 8. Environment Utility Test
  log(colors.blue, "\n🛠️  ENVIRONMENT UTILITY TEST:");
  try {
    const envUtil = require("../utils/environment.util");
    const detailedInfo = envUtil.getDetailedInfo();

    console.log("Detected environment:", detailedInfo.detected);
    console.log("Is development:", detailedInfo.isDevelopment);
    console.log("Is production:", detailedInfo.isProduction);
    console.log("Is staging:", detailedInfo.isStaging);
  } catch (error) {
    log(
      colors.yellow,
      "⚠️  Environment utility not found (create utils/environment.util.js)"
    );
  }

  console.log("\n" + "=".repeat(60));
  log(colors.cyan, "🎯 DIAGNOSIS COMPLETE");
  console.log("=".repeat(60) + "\n");
} catch (error) {
  log(colors.red, "💥 DIAGNOSTIC SCRIPT ERROR:", error.message);
  console.log(error.stack);
}
