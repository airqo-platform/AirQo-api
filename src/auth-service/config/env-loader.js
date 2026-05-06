/**
 * Centralized environment loader — JSON only.
 *
 * Reads .env.{NODE_ENV}.json and applies all non-empty values to process.env.
 * Variables already present in process.env (set by Docker / K8s / shell) are
 * never overwritten — consistent with standard dotenv behaviour.
 *
 * The JSON file is the single source of truth for all environments:
 *   - Development : copy .env.development.template.json → .env.development.json, fill in values
 *   - Staging     : placed by the CI/CD pipeline from Azure Key Vault
 *   - Production  : placed by the CI/CD pipeline from Azure Key Vault
 *
 * If the JSON file is absent the loader warns and returns — the app continues
 * with whatever is already in process.env (e.g. K8s secret mounts).
 *
 * Performance: one synchronous file read at startup, under 5 ms.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

/**
 * Apply key-value pairs to process.env without overwriting existing vars.
 * Empty-string, null, and undefined values in the JSON file are treated as
 * "not yet populated" and are skipped.
 */
function applyToEnv(vars) {
  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith("_")) continue;
    if (value === "" || value === null || value === undefined) continue;
    if (process.env[key] === undefined) {
      process.env[key] = String(value);
    }
  }
}

/**
 * Load environment variables for the current NODE_ENV.
 * Must be called once, as early as possible in the process lifecycle,
 * before any config modules are required.
 */
function loadEnvironment() {
  const env = process.env.NODE_ENV || "development";
  const jsonPath = path.join(ROOT, `.env.${env}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.warn(
      `[env-loader] ${path.basename(jsonPath)} not found — relying on process.env only.`,
    );
    return;
  }

  let vars;
  try {
    vars = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch (err) {
    throw new Error(
      `[env-loader] Failed to parse ${path.basename(jsonPath)}: ${err.message}`,
    );
  }

  if (!vars || typeof vars !== "object" || Array.isArray(vars)) {
    throw new Error(
      `[env-loader] ${path.basename(jsonPath)} must contain a JSON object, got ${Array.isArray(vars) ? "array" : typeof vars}.`,
    );
  }

  applyToEnv(vars);
}

module.exports = { loadEnvironment };
