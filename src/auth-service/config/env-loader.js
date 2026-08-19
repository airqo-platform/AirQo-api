/**
 * Centralized environment loader.
 *
 * Reads .env.{NODE_ENV}.json (if present) and applies non-empty values to
 * process.env without overwriting variables that are already set.
 *
 * The JSON file is a local-development convenience only:
 *   - Development : copy .env.development.template.json → .env.development.json, fill in values
 *   - Staging     : not present in the image — K8s injects vars via envFrom.secretRef (AKV)
 *   - Production  : not present in the image — K8s injects vars via envFrom.secretRef (AKV)
 *
 * When the file is absent the loader logs a warning and returns; the app
 * continues with whatever is already in process.env.
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

// Guards against repeat invocation: bin/index.js, config/check-environment.js,
// and config/constants.js can all call loadEnvironment() (deliberately, so
// population doesn't depend on which one happens to run first — see
// constants.js). Without this flag, a missing .env.{NODE_ENV}.json in
// staging/production — expected there, per the module doc above — would log
// its warning once per caller instead of once per process.
let loaded = false;

/**
 * Load environment variables for the current NODE_ENV.
 * Safe to call multiple times/from multiple entry points — only the first
 * call in a process does any work.
 */
function loadEnvironment() {
  if (loaded) return;
  loaded = true;

  const env = process.env.NODE_ENV || "development";
  const jsonPath = path.join(ROOT, `.env.${env}.json`);

  if (!fs.existsSync(jsonPath)) {
    console.warn(
      `[env-loader] .env.${env}.json not found (NODE_ENV=${env}) — relying on process.env only. ` +
        `Running outside K8s? Create .env.${env}.json from .env.development.template.json.`,
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
