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

class EnvOnlyValidator {
  constructor(environment = process.env.NODE_ENV || "production") {
    this.environment = environment;
    this.reporter = new ValidationReporter(environment);
    this.useConsole = environment === "development";

    // Critical config keys that will crash the app if missing
    this.criticalKeys = ["MONGO_URI", "COMMAND_MONGO_URI", "QUERY_MONGO_URI"];
  }

  /**
   * Validates only actual environment variables - ignores static config
   */
  validateMinimal(config) {
    const results = this._performValidation(config);
    const report = this.reporter.generateMinimalReport(results);

    // Show process.env issues in development
    if (this.environment === "development" && report.hasIssues) {
      this._showActualEnvIssues(results);
    }

    return {
      isValid: !report.hasIssues,
      ...results,
      report,
    };
  }

  /**
   * Shows actual process.env issues for problematic variables only
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
        const status = !value
          ? "Not Set"
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
    if (!path) return; // Skip root level

    // CRITICAL FILTER: Only validate values that are actually from process.env
    if (!this._isEnvironmentVariable(path, value)) {
      return; // Skip static config, functions, objects, etc.
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
   * Determines if a config value is actually sourced from environment variable
   */
  _isEnvironmentVariable(path, value) {
    // Skip if it's a function, complex object, or array
    if (typeof value === "function" || Array.isArray(value)) {
      return false;
    }

    if (typeof value === "object" && value !== null) {
      return false;
    }

    // Skip common static config patterns
    const staticConfigPatterns = [
      /mappings/i,
      /fields.*descriptions/i,
      /positions.*labels/i,
      /field\d+/i,
      /defaults/i,
      /item\./i,
      /remove/i,
      /operate/i,
      /each/i,
      /PREDEFINED_FILTER_VALUES/i,
      /COMBINATIONS/i,
      /ALIASES/i,
      /METADATA_PATHS/i,
      /THINGSPEAK/i,
    ];

    const pathUpper = path.toUpperCase();
    if (staticConfigPatterns.some((pattern) => pattern.test(pathUpper))) {
      return false;
    }

    // Check if there's a corresponding environment variable
    const envVar = this._guessEnvVarName(path);

    // If value matches process.env exactly, it's likely from env
    if (process.env[envVar] === value) {
      return true;
    }

    // If it's a string and looks like typical env var content
    if (typeof value === "string") {
      // Common env patterns: URLs, database strings, tokens, emails, etc.
      const envValuePatterns = [
        /mongodb:\/\//i,
        /redis:\/\//i,
        /postgres:\/\//i,
        /http[s]?:\/\//i,
        /@.*\.(com|org|net)/i, // emails
        /^[A-Z0-9_]{8,}$/i, // tokens/keys
        /localhost:\d+/i,
        /:\d{4,5}$/i, // ports
      ];

      if (envValuePatterns.some((pattern) => pattern.test(value))) {
        return true;
      }
    }

    // If it's a simple value and env var exists, likely from env
    if (
      (typeof value === "string" || typeof value === "number") &&
      process.env[envVar] !== undefined
    ) {
      return true;
    }

    // Common environment variable naming patterns
    const envVarPatterns = [
      /^[A-Z_]+_URI$/i,
      /^[A-Z_]+_URL$/i,
      /^[A-Z_]+_PORT$/i,
      /^[A-Z_]+_HOST$/i,
      /^[A-Z_]+_TOKEN$/i,
      /^[A-Z_]+_KEY$/i,
      /^[A-Z_]+_SECRET$/i,
      /^[A-Z_]+_PASSWORD$/i,
      /^[A-Z_]+_EMAIL[S]?$/i,
      /^[A-Z_]+_DATABASE$/i,
      /^[A-Z_]+_SERVICE/i,
      /^NODE_ENV$/i,
      /^ENVIRONMENT$/i,
    ];

    const envVarName = this._guessEnvVarName(path);
    if (envVarPatterns.some((pattern) => pattern.test(envVarName))) {
      return true;
    }

    return false;
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
