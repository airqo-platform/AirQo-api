/**
 * Centralized environment loader with Azure Key Vault JSON support.
 *
 * Both the JSON file and the flat dotenv file are read when they exist, then
 * merged before being applied to process.env. The merge rule is:
 *
 *   JSON non-empty value  > flat value  > nothing
 *
 * An empty string ("") in the JSON file is treated as "not yet populated by
 * Azure Key Vault" — the flat file's value for that key is used instead.
 * This lets the two files coexist during migration: Azure KV gradually fills
 * the JSON file, and any keys it hasn't set yet are transparently served from
 * the flat file that was already in place.
 *
 * Load order per environment:
 *   1. .env.{NODE_ENV}.json  — Azure Key Vault format (primary for non-empty values)
 *   2. .env.{NODE_ENV}       — flat dotenv format (fills in any empty/absent JSON keys)
 *   3. .env                  — base fallback (used only if neither env-specific file exists)
 *
 * Sync behaviour (runs on every startup when both files exist):
 *   JSON → flat  : Any JSON key with a non-empty value is written into the flat
 *                  file so that legacy tooling reading the flat file always gets
 *                  up-to-date values from Azure Key Vault.
 *   Drift logging: Keys that are non-empty in one file but absent/empty in the
 *                  other are logged as warnings so operators know what still needs
 *                  to be migrated to Azure Key Vault (or removed from the flat file).
 *
 * Auto-bootstrap (one-time write when only one format exists):
 *   - Only JSON exists  → flat file is generated from it
 *   - Only flat exists  → JSON file is generated from it
 *
 * Variables already present in process.env (set by Docker/K8s/shell) are
 * never overwritten — consistent with the default dotenv behaviour.
 *
 * Flat files now use canonical key names (MONGO_URI, AUTH_SERVICE_URL) — one
 * file per environment, so environment prefixes are unnecessary. The
 * KNOWN_FLAT_ALIASES table below is retained to suppress drift warnings for any
 * legacy-prefixed entries that may still exist in older copies of the flat files.
 *
 * Performance: two small synchronous file reads + at most one write at startup.
 * Typical cost is under 10 ms and does not block the event loop after startup.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// Keys that are expected to be environment-specific prefixed names in the flat
// file — these are intentional and should not be reported as drift.
// Format: canonical key → array of prefixed flat-file aliases (any suffix/prefix).
// This list shrinks as the prefix-removal migration progresses.
const KNOWN_FLAT_ALIASES = {
  MONGO_URI: ["MONGO_URI_DEV", "MONGO_URI_STAGE", "MONGO_URI_PROD"],
  COMMAND_MONGO_URI: ["COMMAND_MONGO_URI_DEV", "COMMAND_MONGO_URI_STAGE", "COMMAND_MONGO_URI_PROD"],
  QUERY_MONGO_URI: ["QUERY_MONGO_URI_DEV", "QUERY_MONGO_URI_STAGE", "QUERY_MONGO_URI_PROD"],
  DB_NAME: ["MONGO_DEV", "MONGO_STAGE", "MONGO_PROD"],
  KAFKA_BOOTSTRAP_SERVERS: ["KAFKA_BOOTSTRAP_SERVERS_DEV", "KAFKA_BOOTSTRAP_SERVERS_STAGE", "KAFKA_BOOTSTRAP_SERVERS_PROD"],
  KAFKA_TOPICS: ["KAFKA_TOPICS_DEV", "KAFKA_TOPICS_STAGE", "KAFKA_TOPICS_PROD"],
  KAFKA_CLIENT_ID: ["KAFKA_CLIENT_ID_DEV", "KAFKA_CLIENT_ID_STAGE", "KAFKA_CLIENT_ID_PROD"],
  KAFKA_CLIENT_GROUP: ["KAFKA_CLIENT_GROUP_DEV", "KAFKA_CLIENT_GROUP_STAGE", "KAFKA_CLIENT_GROUP_PROD"],
  SCHEMA_REGISTRY: ["SCHEMA_REGISTRY_DEV", "SCHEMA_REGISTRY_STAGE", "SCHEMA_REGISTRY_PROD"],
  KAFKA_RAW_MEASUREMENTS_TOPICS: ["KAFKA_RAW_MEASUREMENTS_TOPICS_DEV", "KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE", "KAFKA_RAW_MEASUREMENTS_TOPICS_PROD"],
  GROUPS_TOPIC: ["GROUPS_TOPIC_DEV", "GROUPS_TOPIC_STAGE", "GROUPS_TOPIC_PROD"],
  BIGQUERY_DEVICE_UPTIME_TABLE: ["DEV_BIGQUERY_DEVICE_UPTIME_TABLE", "STAGE_BIGQUERY_DEVICE_UPTIME_TABLE", "PROD_BIGQUERY_DEVICE_UPTIME_TABLE"],
  BIGQUERY_SITES: ["DEV_BIGQUERY_SITES", "STAGE_BIGQUERY_SITES", "PROD_BIGQUERY_SITES"],
  BIGQUERY_AIRQLOUDS_SITES: ["DEV_BIGQUERY_AIRQLOUDS_SITES", "STAGE_BIGQUERY_AIRQLOUDS_SITES", "PROD_BIGQUERY_AIRQLOUDS_SITES"],
  BIGQUERY_AIRQLOUDS: ["DEV_BIGQUERY_AIRQLOUDS", "STAGE_BIGQUERY_AIRQLOUDS", "PROD_BIGQUERY_AIRQLOUDS"],
  BIGQUERY_GRIDS_SITES: ["DEV_BIGQUERY_GRIDS_SITES", "STAGE_BIGQUERY_GRIDS_SITES", "PROD_BIGQUERY_GRIDS_SITES"],
  BIGQUERY_GRIDS: ["DEV_BIGQUERY_GRIDS", "STAGE_BIGQUERY_GRIDS", "PROD_BIGQUERY_GRIDS"],
  BIGQUERY_COHORTS_DEVICES: ["DEV_BIGQUERY_COHORTS_DEVICES", "STAGE_BIGQUERY_COHORTS_DEVICES", "PROD_BIGQUERY_COHORTS_DEVICES"],
  BIGQUERY_COHORTS: ["DEV_BIGQUERY_COHORTS", "STAGE_BIGQUERY_COHORTS", "PROD_BIGQUERY_COHORTS"],
  BIGQUERY_RAW_DATA: ["DEV_BIGQUERY_RAW_DATA", "STAGE_BIGQUERY_RAW_DATA", "PROD_BIGQUERY_RAW_DATA"],
  BIGQUERY_HOURLY_DATA: ["DEV_BIGQUERY_HOURLY_DATA", "STAGE_BIGQUERY_HOURLY_DATA", "PROD_BIGQUERY_HOURLY_DATA"],
  BIGQUERY_DEVICES: ["DEV_BIGQUERY_DEVICES", "STAGE_BIGQUERY_DEVICES", "PROD_BIGQUERY_DEVICES"],
  DATAWAREHOUSE_METADATA: ["DATAWAREHOUSE_METADATA_DEV", "DATAWAREHOUSE_METADATA_STAGE", "DATAWAREHOUSE_METADATA_PROD"],
  DATAWAREHOUSE_AVERAGED_DATA: ["DATAWAREHOUSE_AVERAGED_DATA_DEV", "DATAWAREHOUSE_AVERAGED_DATA_STAGE", "DATAWAREHOUSE_AVERAGED_DATA_PROD"],
  AUTH_SERVICE_URL: ["DEV_AUTH_SERVICE_URL", "STAGE_AUTH_SERVICE_URL", "PROD_AUTH_SERVICE_URL"],
  INTER_SERVICE_TOKEN: ["DEV_INTER_SERVICE_TOKEN", "STAGE_INTER_SERVICE_TOKEN", "PROD_INTER_SERVICE_TOKEN"],
  ADMIN_MIGRATION_KEY: ["DEV_ADMIN_MIGRATION_KEY", "STAGE_ADMIN_MIGRATION_KEY", "PROD_ADMIN_MIGRATION_KEY"],
  DEPLOYMENT_URL: ["DEV_DEPLOYMENT_URL", "STAGE_DEPLOYMENT_URL", "PROD_DEPLOYMENT_URL"],
  SERVICE_JWT_TOKEN: ["DEV_SERVICE_JWT_TOKEN", "STAGE_SERVICE_JWT_TOKEN", "PROD_SERVICE_JWT_TOKEN"],
  API_BASE_URL: ["DEV_API_BASE_URL", "STAGE_API_BASE_URL", "PROD_API_BASE_URL"],
  API_TOKEN: ["DEV_API_TOKEN", "STAGE_API_TOKEN", "PROD_API_TOKEN"],
  ADMIN_SETUP_SECRET: ["DEV_ADMIN_SETUP_SECRET", "STAGE_ADMIN_SETUP_SECRET", "PROD_ADMIN_SETUP_SECRET"],
  HCAPTCHA_SECRET_KEY: ["DEV_HCAPTCHA_SECRET_KEY", "STAGE_HCAPTCHA_SECRET_KEY", "PROD_HCAPTCHA_SECRET_KEY"],
  DEFAULT_COHORT: ["DEV_DEFAULT_COHORT", "STAGE_DEFAULT_COHORT", "PROD_DEFAULT_COHORT"],
  PROTECTED_COHORT_NAMES: ["DEV_PROTECTED_COHORT_NAMES", "STAGE_PROTECTED_COHORT_NAMES", "PROD_PROTECTED_COHORT_NAMES"],
};

// Build a reverse lookup: prefixed alias → canonical key, for drift suppression.
const ALIAS_TO_CANONICAL = {};
for (const [canonical, aliases] of Object.entries(KNOWN_FLAT_ALIASES)) {
  for (const alias of aliases) {
    ALIAS_TO_CANONICAL[alias] = canonical;
  }
}

/**
 * Parse a flat dotenv file into a key-value object.
 * Ignores blank lines, comment lines (#), and lines without an `=`.
 * Value is preserved verbatim (no quote-stripping) so that values containing
 * special characters round-trip cleanly between formats.
 */
function parseFlat(content) {
  const result = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const val = trimmed.slice(idx + 1);
    if (key) result[key] = val;
  }
  return result;
}

/**
 * Serialize a key-value object to flat dotenv format.
 */
function toFlat(obj) {
  return (
    Object.entries(obj)
      .map(([k, v]) => `${k}=${v}`)
      .join("\n") + "\n"
  );
}

/**
 * Merge jsonVars and flatVars with clear precedence:
 *   - flatVars is the base (provides all keys that have any value)
 *   - jsonVars non-empty values override the flat values for the same key
 *   - jsonVars empty string ("") or null/undefined does NOT override flat
 *
 * This means a key present in flat but absent from JSON keeps its flat value.
 * A key present in JSON with a real value overrides the flat value for that key.
 */
function mergeVars(jsonVars, flatVars) {
  const merged = { ...(flatVars || {}) };
  if (jsonVars) {
    for (const [key, value] of Object.entries(jsonVars)) {
      if (value !== "" && value !== null && value !== undefined) {
        merged[key] = String(value);
      }
    }
  }
  return merged;
}

/**
 * Apply key-value pairs to process.env without overwriting existing vars.
 */
function applyToEnv(vars) {
  for (const [key, value] of Object.entries(vars)) {
    if (process.env[key] === undefined) {
      process.env[key] = String(value ?? "");
    }
  }
}

/**
 * Best-effort synchronous file write — failure is non-fatal.
 */
function tryWriteSync(filePath, content) {
  try {
    fs.writeFileSync(filePath, content, "utf8");
  } catch (_) {
    // Intentionally silent: sync is a convenience, not a requirement.
  }
}

/**
 * Sync JSON values into the flat file so legacy tooling stays up-to-date.
 *
 * Strategy: read the existing flat file line by line, replacing values for
 * canonical keys that have a non-empty JSON value. Appends any canonical keys
 * present in JSON but entirely absent from the flat file. Prefixed keys already
 * in the flat file are left untouched — they will be removed manually as the
 * migration progresses.
 *
 * This is intentionally one-directional (JSON → flat). Flat → JSON sync is
 * handled at bootstrap time only, to avoid promoting stale prefixed keys into
 * the canonical JSON format.
 */
function syncJsonToFlat(flatPath, flatVars, jsonVars) {
  if (!jsonVars) return;

  // Determine which canonical JSON keys have non-empty values that differ from
  // what the flat file currently has (or are absent from the flat file).
  const updates = {};
  for (const [key, value] of Object.entries(jsonVars)) {
    if (value === "" || value === null || value === undefined) continue;
    const flatVal = flatVars[key];
    if (flatVal === undefined || flatVal !== String(value)) {
      updates[key] = String(value);
    }
  }

  if (Object.keys(updates).length === 0) return;

  // Rewrite the flat file: replace in-place where key exists, append new keys.
  const lines = (fs.existsSync(flatPath) ? fs.readFileSync(flatPath, "utf8") : "").split("\n");
  const seen = new Set();

  const newLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return line;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return line;
    const key = trimmed.slice(0, idx).trim();
    if (key in updates) {
      seen.add(key);
      return `${key}=${updates[key]}`;
    }
    return line;
  });

  // Append keys that were in JSON but not in the flat file at all.
  const appended = [];
  for (const [key, value] of Object.entries(updates)) {
    if (!seen.has(key)) {
      appended.push(`${key}=${value}`);
    }
  }
  if (appended.length > 0) {
    newLines.push("", "# Auto-synced from JSON (Azure Key Vault)", ...appended);
  }

  tryWriteSync(flatPath, newLines.join("\n").trimEnd() + "\n");
}

/**
 * Detect and log drift between JSON and flat files.
 *
 * Reports:
 *  - JSON keys that are empty/absent while the flat file has a real value
 *    (Azure KV hasn't been populated yet for this key).
 *  - Flat file keys with real values that have no JSON equivalent and are not
 *    known prefixed aliases (genuinely missing from JSON).
 *
 * Suppresses noise from known prefixed aliases (e.g. MONGO_URI_DEV maps to
 * MONGO_URI) since those are expected during the migration period.
 */
function reportDrift(jsonPath, flatPath, jsonVars, flatVars) {
  if (!jsonVars || !flatVars) return;

  const jsonBase = path.basename(jsonPath);
  const flatBase = path.basename(flatPath);

  // Flat keys with real values that JSON doesn't have (or has empty).
  const missingFromJson = [];
  for (const [key, value] of Object.entries(flatVars)) {
    if (!value) continue;
    // Skip if it's a known alias for a canonical key that IS in JSON.
    if (key in ALIAS_TO_CANONICAL) {
      const canonical = ALIAS_TO_CANONICAL[key];
      const jsonVal = jsonVars[canonical];
      if (jsonVal !== undefined && jsonVal !== "" && jsonVal !== null) continue;
      // The canonical key in JSON is empty — this alias is doing useful work.
      missingFromJson.push(`  ${key} → needs ${canonical} populated in ${jsonBase}`);
      continue;
    }
    // Skip if the canonical key is already non-empty in JSON.
    if (key in jsonVars && jsonVars[key] !== "" && jsonVars[key] !== null) continue;
    // Key absent from JSON entirely — not yet tracked in Azure KV.
    if (!(key in jsonVars)) {
      missingFromJson.push(`  ${key} → present in ${flatBase} but not tracked in ${jsonBase}`);
      continue;
    }
    missingFromJson.push(`  ${key} → present in ${flatBase} but empty in ${jsonBase}`);
  }

  // JSON keys with real values that are completely absent from flat (shouldn't
  // happen after first sync, but worth catching).
  const missingFromFlat = [];
  for (const [key, value] of Object.entries(jsonVars)) {
    if (value === "" || value === null || value === undefined) continue;
    if (!(key in flatVars)) {
      missingFromFlat.push(`  ${key} → present in ${jsonBase} but absent from ${flatBase}`);
    }
  }

  if (missingFromJson.length > 0) {
    console.warn(
      `[env-loader] Drift detected — flat file has values not yet in JSON:\n${missingFromJson.join("\n")}`,
    );
  }
  if (missingFromFlat.length > 0) {
    console.warn(
      `[env-loader] Drift detected — JSON has values not yet in flat file (will be synced):\n${missingFromFlat.join("\n")}`,
    );
  }
}

/**
 * Load environment variables for the current NODE_ENV.
 * Must be called once, as early as possible in the process lifecycle,
 * before any config modules are required.
 */
function loadEnvironment() {
  const env = process.env.NODE_ENV || "production";
  const jsonPath = path.join(ROOT, `.env.${env}.json`);
  const flatPath = path.join(ROOT, `.env.${env}`);
  const basePath = path.join(ROOT, ".env");

  let jsonVars = null;
  let flatVars = null;

  // Read JSON (Azure Key Vault format)
  if (fs.existsSync(jsonPath)) {
    try {
      jsonVars = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    } catch (err) {
      console.warn(
        `[env-loader] Failed to parse ${path.basename(jsonPath)}: ${err.message}`,
      );
    }
  }

  // Read flat dotenv (backward-compat format)
  if (fs.existsSync(flatPath)) {
    try {
      flatVars = parseFlat(fs.readFileSync(flatPath, "utf8"));
    } catch (err) {
      console.warn(
        `[env-loader] Failed to read ${path.basename(flatPath)}: ${err.message}`,
      );
    }
  }

  if (jsonVars !== null || flatVars !== null) {
    // Merge: JSON non-empty values take precedence; flat fills in the rest.
    const merged = mergeVars(jsonVars, flatVars);
    applyToEnv(merged);

    if (jsonVars !== null && flatVars !== null) {
      // Both files exist — sync JSON → flat and report any remaining drift.
      syncJsonToFlat(flatPath, flatVars, jsonVars);
      reportDrift(jsonPath, flatPath, jsonVars, flatVars);
    } else if (jsonVars !== null && flatVars === null) {
      // Only JSON exists — bootstrap the flat file from it.
      tryWriteSync(flatPath, toFlat(merged));
    } else if (flatVars !== null && jsonVars === null) {
      // Only flat exists — bootstrap the JSON file from it.
      tryWriteSync(jsonPath, JSON.stringify(merged, null, 2) + "\n");
    }

    return;
  }

  // No environment-specific file found — fall back to base .env
  if (fs.existsSync(basePath)) {
    try {
      applyToEnv(parseFlat(fs.readFileSync(basePath, "utf8")));
    } catch (_) {}
  }
}

module.exports = { loadEnvironment };
