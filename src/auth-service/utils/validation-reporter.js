// utils/validation-reporter.js
const log4js = require("log4js");

class ValidationReporter {
  constructor(environment = process.env.NODE_ENV || "production") {
    this.environment = environment;
    this.logger = log4js.getLogger(
      `${environment.toUpperCase()} -- ENVs validation`
    );
    this.useConsole = environment === "development";
  }

  /**
   * Logs message using console.log in dev or log4js in production
   */
  _log(level, message) {
    if (this.useConsole) {
      console.log(message);
    } else {
      this.logger[level](message);
    }
  }

  /**
   * Generates a minimal validation report - only shows problems
   */
  generateMinimalReport(validationResults) {
    const {
      missing = [],
      empty = [],
      critical = [],
      valid = [],
    } = validationResults;
    const totalIssues = missing.length + empty.length + critical.length;
    const totalChecked = totalIssues + valid.length;

    // Show summary statistics first
    this._showSummaryStats(totalChecked, valid.length, totalIssues);

    // Only show tables if there are issues
    if (totalIssues > 0) {
      this._showIssuesTable(missing, empty, critical);
    }

    return { hasIssues: totalIssues > 0, totalIssues };
  }

  /**
   * Shows clean summary statistics
   */
  _showSummaryStats(total, valid, issues) {
    this._log("info", "");
    this._log("info", "📊 ENVIRONMENT VARIABLES SUMMARY");
    this._log("info", "═".repeat(40));
    this._log("info", `Environment: ${this.environment.toUpperCase()}`);
    this._log("info", `Total Checked: ${total}`);
    this._log("info", `✅ Valid: ${valid}`);
    this._log("info", `❌ Issues: ${issues}`);
    this._log("info", "═".repeat(40));

    if (issues === 0) {
      this._log(
        "info",
        "🎉 All environment variables are properly configured!"
      );
    }
    this._log("info", "");
  }

  /**
   * Shows only problematic environment variables in a clean table
   */
  _showIssuesTable(missing, empty, critical) {
    this._log("warn", "⚠️  ENVIRONMENT VARIABLES NEEDING ATTENTION");
    this._log("warn", "─".repeat(50));
    this._log("warn", "Variable Name                    Issue");
    this._log("warn", "─".repeat(50));

    // Show critical issues first (these will crash the app)
    critical.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("error", `${name} 🚨 CRITICAL - Missing`);
    });

    // Show missing variables
    missing.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("warn", `${name} ❌ Missing`);
    });

    // Show empty variables
    empty.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("warn", `${name} ⚠️  Empty`);
    });

    this._log("warn", "─".repeat(50));
    this._log("warn", "");

    // Show quick fix instructions
    if (critical.length > 0) {
      this._log(
        "error",
        "🚨 CRITICAL: These missing variables will cause app crashes!"
      );
      this._log("error", "   Add them to your .env file immediately.");
      this._log("error", "");
    }
  }
}

// =============================================================================
// MINIMAL Environment Variable Validator
// =============================================================================

class MinimalEnvValidator {
  constructor(environment = process.env.NODE_ENV || "production") {
    this.environment = environment;
    this.reporter = new ValidationReporter(environment);
    this.useConsole = environment === "development";
  }

  /**
   * Quick validation with minimal output
   */
  validateMinimal(config) {
    const results = this._performValidation(config);
    const report = this.reporter.generateMinimalReport(results);

    // Show environment issues table in development
    if (this.environment === "development" && report.hasIssues) {
      this._showEnvIssuesOnly();
    }

    return {
      isValid: !report.hasIssues,
      ...results,
      report,
    };
  }

  /**
   * Shows only problematic environment variables from process.env
   */
  _showEnvIssuesOnly() {
    // Common environment variables - update these to match your actual variable names
    const commonEnvVars = [
      "MONGO_URI",
      "COMMAND_MONGO_URI",
      "QUERY_MONGO_URI",
      "REDIS_SERVER",
      "REDIS_PORT",
      "KAFKA_BOOTSTRAP_SERVERS",
      "AUTH_SERVICE_URL",
      "INTER_SERVICE_TOKEN",
      "DEFAULT_COHORT",
      "PARTNERS_EMAILS",
      "COMMS_EMAILS",
      "POLICY_EMAILS",
    ];

    const issues = commonEnvVars.filter((envVar) => {
      const value = process.env[envVar];
      return !value || value.trim() === "";
    });

    if (issues.length > 0) {
      console.log("\n🔍 PROCESS.ENV ISSUES DETECTED");
      console.log("─".repeat(35));
      issues.forEach((envVar) => {
        const value = process.env[envVar];
        const status = !value ? "Not Set" : "Empty";
        console.log(`❌ ${envVar}: ${status}`);
      });
      console.log("─".repeat(35));
      console.log(`Total issues: ${issues.length}`);
      console.log("");
    }
  }

  /**
   * Performs validation and categorizes results
   */
  _performValidation(config) {
    const missing = [];
    const empty = [];
    const valid = [];
    const critical = [];

    // Critical variables that will crash the app
    const criticalVars = ["MONGO_URI", "COMMAND_MONGO_URI", "QUERY_MONGO_URI"];

    this._validateConfigObject(config, "", {
      missing,
      empty,
      valid,
      critical,
      criticalVars,
    });

    return { missing, empty, valid, critical };
  }

  /**
   * Recursively validates configuration object
   */
  _validateConfigObject(obj, path, results) {
    if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
      return this._validateValue(path, obj, results);
    }

    Object.entries(obj).forEach(([key, value]) => {
      const currentPath = path ? `${path}.${key}` : key;
      this._validateConfigObject(value, currentPath, results);
    });
  }

  /**
   * Validates individual values
   */
  _validateValue(path, value, results) {
    const { missing, empty, valid, critical, criticalVars } = results;
    const envVar = this._guessEnvVarName(path);
    const isCritical = criticalVars.includes(path);

    if (value === undefined || value === null) {
      const issue = { configKey: path, envVar };

      if (isCritical) {
        critical.push(issue);
      } else {
        missing.push(issue);
      }
    } else if (typeof value === "string" && value.trim() === "") {
      const issue = { configKey: path, envVar };

      if (isCritical) {
        critical.push(issue);
      } else {
        empty.push(issue);
      }
    } else {
      valid.push({ configKey: path, envVar });
    }
  }

  /**
   * Guesses environment variable name from config path
   */
  _guessEnvVarName(configPath) {
    // Convert config path to environment variable format
    // e.g., "PARTNERS.EMAILS" -> "PARTNERS_EMAILS"
    // No automatic environment prefixes - use actual variable names
    return configPath.replace(/\./g, "_").toUpperCase();
  }

  /**
   * Super quick summary - just counts
   */
  quickSummary() {
    // Common environment variables - update these to match your actual variable names
    const commonEnvVars = [
      "MONGO_URI",
      "COMMAND_MONGO_URI",
      "QUERY_MONGO_URI",
      "REDIS_SERVER",
      "REDIS_PORT",
      "KAFKA_BOOTSTRAP_SERVERS",
      "AUTH_SERVICE_URL",
      "INTER_SERVICE_TOKEN",
      "DEFAULT_COHORT",
      "PARTNERS_EMAILS",
      "COMMS_EMAILS",
      "POLICY_EMAILS",
    ];

    let valid = 0,
      missing = 0,
      empty = 0;

    commonEnvVars.forEach((envVar) => {
      const value = process.env[envVar];
      if (!value) {
        missing++;
      } else if (value.trim() === "") {
        empty++;
      } else {
        valid++;
      }
    });

    const total = valid + missing + empty;
    const issues = missing + empty;

    if (this.useConsole) {
      console.log("\n📈 QUICK ENV SUMMARY");
      console.log("═".repeat(25));
      console.log(`Total: ${total} | Valid: ${valid} | Issues: ${issues}`);
      console.log("═".repeat(25));

      if (issues > 0) {
        console.log(`❌ ${missing} missing, ⚠️  ${empty} empty`);
      } else {
        console.log("✅ All environment variables OK");
      }
      console.log("");
    }

    return { total, valid, missing, empty, issues };
  }
}

module.exports = { MinimalEnvValidator, ValidationReporter };
