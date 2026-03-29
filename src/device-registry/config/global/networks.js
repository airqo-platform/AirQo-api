/**
 * Static network adapter configurations.
 *
 * Each entry describes how to communicate with a specific device manufacturer's
 * API.  These values are the canonical fallback used by feed.util.js when a
 * network's adapter config has not yet been persisted to the Network model in
 * the database.  Once an admin saves adapter fields on a Network document, the
 * DB record takes precedence over these static entries.
 *
 * Fields mirror the `adapter` sub-document added to the Network schema:
 *   api_code_is_full_url  – device.api_code already is the full fetch URL
 *   api_base_url          – base URL when constructing from a template
 *   api_url_template      – path template; {serial_number} is substituted
 *   auth_type             – "none" | "query_param" | "header_bearer" | "header_basic"
 *   auth_key_param        – query-param name or HTTP header name for the credential
 *   serial_number_regex   – regex string to extract serial_number from api_code
 *   field_map             – maps manufacturer field names → AirQo internal field names
 *   online_check_via_feed – infer online status from feed freshness (not device_number)
 *
 * Adding a new manufacturer:
 *   1. Add an entry here keyed by network name (lowercase, matches device.network).
 *   2. Optionally persist it to the DB via a migration / admin update so the
 *      config survives even if this file is not redeployed.
 */

const NETWORK_ADAPTERS = {
  // ── AirQo ──────────────────────────────────────────────────────────────────
  // AirQo devices use ThingSpeak.  The feed path is handled separately in
  // feed.util.js; this entry exists purely for completeness and reference.
  airqo: {
    api_code_is_full_url: false,
    auth_type: "query_param",
    auth_key_param: "api_key",
    uses_thingspeak: true,          // sentinel: feed.util routes to ThingSpeak path
    online_check_via_feed: false,   // online status is driven by events pipeline
    field_map: null,
    serial_number_regex: null,
  },

  // ── AirGradient ────────────────────────────────────────────────────────────
  // Public API — no auth required.
  // api_code example: https://api.airgradient.com/public/api/v1/locations/174349/measures/current
  // serial_number "174349" lives in the URL path.
  airgradient: {
    api_code_is_full_url: true,
    auth_type: "none",
    auth_key_param: null,
    serial_number_regex: "/locations/([^/?#]+)/",
    online_check_via_feed: true,
    field_map: {
      // AirGradient field name  →  AirQo internal field name
      pm01: "pm1",
      pm02: "pm2_5",
      pm10: "pm10",
      rco2: "co2",
      tvoc: "tvoc",
      nox: "nox",
      atmp: "temperature",
      rhum: "humidity",
      wifi: "wifi_rssi",
      boot: "boot_count",
      // Timestamp fields — kept as-is
      timestamp: "timestamp",
    },
  },

  // ── IQAir ──────────────────────────────────────────────────────────────────
  // Authenticated API.  The device serial_number is the IQAir node ID which
  // appears at the end of the device URL.
  // URL example (from description field): https://device.iqair.com/v2/6796fa282f158127e2a1f9f3
  // access_code on the device (or net_api_key on the Network doc) holds the key.
  iqair: {
    api_code_is_full_url: true,
    api_base_url: "https://device.iqair.com",
    api_url_template: "/v2/{serial_number}",
    auth_type: "header_bearer",
    auth_key_param: "Authorization",
    serial_number_regex: "/v2/([^/?#]+)$",
    online_check_via_feed: true,
    field_map: {
      // IQAir field names will be confirmed once API access is established.
      // Placeholder mappings based on known IQAir data schema:
      "pm2.5": "pm2_5",
      pm10: "pm10",
      temperature: "temperature",
      humidity: "humidity",
      co2: "co2",
      timestamp: "timestamp",
    },
  },

  // ── Clarity ────────────────────────────────────────────────────────────────
  // Clarity (KCCA network) — connection details not yet confirmed for active
  // devices.  Placeholder entry; field_map to be filled when API access exists.
  clarity: {
    api_code_is_full_url: false,
    auth_type: "header_bearer",
    auth_key_param: "Authorization",
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },

  // ── MetOne ─────────────────────────────────────────────────────────────────
  // Reference-grade BAM devices operated by US Embassy programme.
  // Connection details not yet confirmed.  Placeholder only.
  metone: {
    api_code_is_full_url: false,
    auth_type: "header_basic",
    auth_key_param: "Authorization",
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },

  // ── AirBeam ────────────────────────────────────────────────────────────────
  airbeam: {
    api_code_is_full_url: false,
    auth_type: "none",
    auth_key_param: null,
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },

  // ── Airly ──────────────────────────────────────────────────────────────────
  airly: {
    api_code_is_full_url: false,
    auth_type: "header_bearer",
    auth_key_param: "apikey",
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },

  // ── PlumeLabsEco ───────────────────────────────────────────────────────────
  plumelabs: {
    api_code_is_full_url: false,
    auth_type: "header_bearer",
    auth_key_param: "Authorization",
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },

  // ── QuantAQ ────────────────────────────────────────────────────────────────
  "quant-aq": {
    api_code_is_full_url: false,
    auth_type: "query_param",
    auth_key_param: "api_key",
    serial_number_regex: null,
    online_check_via_feed: true,
    field_map: null,
  },
};

module.exports = { NETWORK_ADAPTERS };
