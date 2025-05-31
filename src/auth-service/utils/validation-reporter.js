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

    this._showSummaryStats(totalChecked, valid.length, totalIssues);

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

    critical.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("error", `${name} 🚨 CRITICAL - Missing`);
    });

    missing.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("warn", `${name} ❌ Missing`);
    });

    empty.forEach((issue) => {
      const name = issue.envVar.padEnd(32);
      this._log("warn", `${name} ⚠️  Empty`);
    });

    this._log("warn", "─".repeat(50));
    this._log("warn", "");

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

class EnvOnlyValidator {
  constructor(options = {}) {
    const {
      environment = process.env.NODE_ENV || "production",
      criticalKeys = null,
      throwOnCritical = true,
    } = options;

    this.environment = environment;
    this.reporter = new ValidationReporter(environment);
    this.useConsole = environment === "development";
    this.throwOnCritical = throwOnCritical;

    this.criticalKeys = this._loadCriticalKeys(criticalKeys);
  }

  /**
   * Load critical keys from options, environment, or defaults
   */
  _loadCriticalKeys(providedKeys) {
    if (providedKeys && Array.isArray(providedKeys)) {
      return providedKeys;
    }

    const envCriticalKeys = process.env.CRITICAL_ENV_KEYS;
    if (envCriticalKeys) {
      return envCriticalKeys.split(",").map((key) => key.trim());
    }

    return ["MONGO_URI", "COMMAND_MONGO_URI", "QUERY_MONGO_URI"];
  }

  /**
   * Validates only actual environment variables with proper error handling
   */
  validateMinimal(config) {
    const results = this._performValidation(config);
    const report = this.reporter.generateMinimalReport(results);

    if (this.environment === "development" && report.hasIssues) {
      this._showActualEnvIssues(results);
    }

    // Handle critical validation failures
    if (
      this.throwOnCritical &&
      results.critical &&
      results.critical.length > 0
    ) {
      const criticalVars = results.critical.map((c) => c.envVar).join(", ");
      throw new Error(
        `Critical environment variables missing: ${criticalVars}`
      );
    }

    return {
      isValid: !report.hasIssues,
      ...results,
      report,
    };
  }

  /**
   * Shows actual process.env issues with explicit status checking
   */
  _showActualEnvIssues(results) {
    const allIssues = [
      ...results.missing,
      ...results.empty,
      ...results.critical,
    ];

    if (allIssues.length > 0) {
      console.log("\n🔍 ACTUAL PROCESS.ENV ISSUES");
      console.log("─".repeat(35));

      allIssues.forEach((issue) => {
        const value = process.env[issue.envVar];
        const status =
          value === undefined
            ? "Not Set"
            : value === null
            ? "Null"
            : value.trim() === ""
            ? "Empty"
            : "Invalid";

        const icon =
          issue.configKey && this.criticalKeys.includes(issue.configKey)
            ? "🚨"
            : "❌";
        console.log(`${icon} ${issue.envVar}: ${status}`);
      });

      console.log("─".repeat(35));
      console.log(`Total actual env issues: ${allIssues.length}`);
      console.log("");
    }
  }

  /**
   * Performs validation by walking only env-sourced values
   */
  _performValidation(config) {
    const missing = [];
    const empty = [];
    const valid = [];
    const critical = [];

    this._validateConfigObject(config, "", {
      missing,
      empty,
      valid,
      critical,
    });

    return { missing, empty, valid, critical };
  }

  /**
   * Recursively validates configuration object - ONLY process.env values
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
   * Validates individual values - ONLY checks env-sourced values
   */
  _validateValue(path, value, results) {
    if (!path) return;

    if (!this._isEnvironmentVariable(path, value)) {
      return;
    }

    const { missing, empty, valid, critical } = results;
    const envVar = this._guessEnvVarName(path);
    const isCritical = this.criticalKeys.includes(path);

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
   * Simple environment variable detection - only checks process.env directly
   */
  _isEnvironmentVariable(path, value) {
    // Skip functions, arrays, and complex objects
    if (!this._isValidValueType(value)) {
      return false;
    }

    // Convert config path to environment variable name
    const envVar = this._guessEnvVarName(path);

    // Check if this environment variable exists in process.env
    if (!(envVar in process.env)) {
      return false;
    }

    // For simple values, check if they could be from this env var
    const envValue = process.env[envVar];

    // Direct match - definitely from environment
    if (value === envValue) {
      return true;
    }

    // For undefined/null config values, still consider it an env var if process.env has it
    if ((value === undefined || value === null) && envValue !== undefined) {
      return true;
    }

    // For numbers, check if env var can be parsed to match
    if (typeof value === "number" && !isNaN(Number(envValue))) {
      return Number(envValue) === value;
    }

    // For booleans, check if env var can be parsed to match
    if (typeof value === "boolean") {
      const envBool = envValue?.toLowerCase();
      return (
        (value === true && (envBool === "true" || envBool === "1")) ||
        (value === false &&
          (envBool === "false" || envBool === "0" || envBool === ""))
      );
    }

    return false;
  }

  /**
   * Check if value type is valid for environment variables
   */
  _isValidValueType(value) {
    return !(
      typeof value === "function" ||
      Array.isArray(value) ||
      (typeof value === "object" && value !== null)
    );
  }

  /**
   * Converts config path to environment variable name
   */
  _guessEnvVarName(configPath) {
    return configPath.replace(/\./g, "_").toUpperCase();
  }

  /**
   * Shows only actual environment variables and their status
   */
  getActualEnvStatus() {
    const envVars = Object.keys(process.env);
    const appEnvVars = envVars.filter(
      (envVar) =>
        !envVar.startsWith("npm_") &&
        !envVar.startsWith("NODE_") &&
        !["PATH", "HOME", "USER", "SHELL", "PWD"].includes(envVar)
    );

    let valid = 0,
      empty = 0;

    appEnvVars.forEach((envVar) => {
      const value = process.env[envVar];
      if (value && value.trim() !== "") {
        valid++;
      } else {
        empty++;
      }
    });

    if (this.useConsole) {
      console.log("\n📈 ACTUAL ENV STATUS");
      console.log("═".repeat(25));
      console.log(`App Env Vars: ${appEnvVars.length}`);
      console.log(`Valid: ${valid} | Empty: ${empty}`);
      console.log("═".repeat(25));
      console.log("");
    }

    return { total: appEnvVars.length, valid, empty };
  }
}

module.exports = { EnvOnlyValidator, ValidationReporter };
