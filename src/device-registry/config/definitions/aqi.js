/**
 * Air Quality Index (AQI) related constants
 * Used for categorizing and displaying air pollution levels based on PM2.5 values
 *
 * This file consolidates all AQI-related constants to prevent namespace collisions
 * and provides a single source of truth for air quality calculations and display.
 */

/**
 * AQI range definitions for PM2.5 values
 * Used for calculation logic in MongoDB aggregations and filtering
 * @type {Object.<string, {min: number, max: number|null}>}
 */
const AQI_RANGES = {
  good: { min: 0, max: 9.1 },
  moderate: { min: 9.101, max: 35.49 },
  u4sg: { min: 35.491, max: 55.49 },
  unhealthy: { min: 55.491, max: 125.49 },
  very_unhealthy: { min: 125.491, max: 225.49 },
  hazardous: { min: 225.491, max: null },
};

/**
 * AQI index mapping (identical to AQI_RANGES)
 * Kept for backward compatibility with existing code
 * @type {Object.<string, {min: number, max: number|null}>}
 */
const AQI_INDEX = {
  good: { min: 0, max: 9.1 },
  moderate: { min: 9.101, max: 35.49 },
  u4sg: { min: 35.491, max: 55.49 },
  unhealthy: { min: 55.491, max: 125.49 },
  very_unhealthy: { min: 125.491, max: 225.49 },
  hazardous: { min: 225.491, max: null },
};

/**
 * Human-readable category labels for display in UI
 * @type {Object.<string, string>}
 */
const AQI_CATEGORIES = {
  good: "Good",
  moderate: "Moderate",
  u4sg: "Unhealthy for Sensitive Groups",
  unhealthy: "Unhealthy",
  very_unhealthy: "Very Unhealthy",
  hazardous: "Hazardous",
  unknown: "Unknown",
};

/**
 * Hex color codes for AQI categories (without # prefix)
 * Used for styling and visual representation
 * @type {Object.<string, string>}
 */
const AQI_COLORS = {
  good: "34C759",
  moderate: "ECAA06",
  u4sg: "FF851F",
  unhealthy: "F7453C",
  very_unhealthy: "AC5CD9",
  hazardous: "D95BA3",
  unknown: "Unknown",
};

/**
 * Color names corresponding to AQI categories
 * Used for accessibility and text-based representations
 * @type {Object.<string, string>}
 */
const AQI_COLOR_NAMES = {
  good: "Green",
  moderate: "Yellow",
  u4sg: "Orange",
  unhealthy: "Red",
  very_unhealthy: "Purple",
  hazardous: "Maroon",
  unknown: "Unknown",
};

/**
 * Ordered array of AQI category keys
 * Used for iteration, validation, and maintaining consistent ordering
 * @type {string[]}
 */
const AQI_CATEGORY_KEYS = [
  "good",
  "moderate",
  "u4sg",
  "unhealthy",
  "very_unhealthy",
  "hazardous",
];

/**
 * Consolidated AQI constants object for namespaced usage
 * Recommended approach to prevent naming conflicts
 */
const AQI_CONSTANTS = {
  RANGES: AQI_RANGES,
  INDEX: AQI_INDEX,
  CATEGORIES: AQI_CATEGORIES,
  COLORS: AQI_COLORS,
  COLOR_NAMES: AQI_COLOR_NAMES,
  CATEGORY_KEYS: AQI_CATEGORY_KEYS,
};

/**
 * PM2.5 AQI numeric breakpoints (2024 EPA NAAQS revision).
 * Maps PM2.5 concentration ranges (µg/m³) to AQI value ranges (0–500).
 * Used for piecewise linear interpolation in calculatePm25Aqi() and the
 * equivalent MongoDB aggregation expression in aqi.util.js.
 *
 * Formula: AQI = round( ((AQI_Hi - AQI_Lo) / (C_Hi - C_Lo)) * (C - C_Lo) + AQI_Lo )
 * Reference: EPA-454/B-24-002 (2024)
 */
const PM25_AQI_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, aqiLow: 0, aqiHigh: 50 }, // Good
  { cLow: 9.1, cHigh: 35.4, aqiLow: 51, aqiHigh: 100 }, // Moderate
  { cLow: 35.5, cHigh: 55.4, aqiLow: 101, aqiHigh: 150 }, // Unhealthy for Sensitive Groups
  { cLow: 55.5, cHigh: 125.4, aqiLow: 151, aqiHigh: 200 }, // Unhealthy
  { cLow: 125.5, cHigh: 225.4, aqiLow: 201, aqiHigh: 300 }, // Very Unhealthy
  { cLow: 225.5, cHigh: 325.4, aqiLow: 301, aqiHigh: 500 }, // Hazardous
];

/**
 * PM2.5 concentration breakpoints (µg/m³) per AQI category, keyed the same
 * way as AQI_RANGES above. Kept as a separate name (rather than reusing
 * AQI_RANGES directly) so SUPPORTED_POLLUTANTS below can list PM2.5 and PM10
 * side by side without implying AQI_RANGES itself is pollutant-specific to
 * callers that still import it directly (ingestion pipeline, aqi.util.js
 * defaults) for backward compatibility.
 * @type {Object.<string, {min: number, max: number|null}>}
 */
const PM25_AQI_RANGES = AQI_RANGES;

/**
 * PM10 AQI concentration breakpoints (µg/m³), EPA 24-hour standard.
 * Unlike PM2.5, these breakpoints were not revised in the 2024 NAAQS update.
 * Reference: EPA-454/B-24-002 (2024), Table 2.
 * @type {Object.<string, {min: number, max: number|null}>}
 */
const PM10_AQI_RANGES = {
  good: { min: 0, max: 54 },
  moderate: { min: 54.1, max: 154 },
  u4sg: { min: 154.1, max: 254 },
  unhealthy: { min: 254.1, max: 354 },
  very_unhealthy: { min: 354.1, max: 424 },
  hazardous: { min: 424.1, max: null },
};

/**
 * PM10 AQI numeric breakpoints (EPA 24-hour standard), same shape and use as
 * PM25_AQI_BREAKPOINTS — piecewise linear interpolation table mapping PM10
 * concentration ranges (µg/m³) to AQI value ranges (0–500).
 * Reference: EPA-454/B-24-002 (2024), Table 2.
 */
const PM10_AQI_BREAKPOINTS = [
  { cLow: 0, cHigh: 54, aqiLow: 0, aqiHigh: 50 }, // Good
  { cLow: 55, cHigh: 154, aqiLow: 51, aqiHigh: 100 }, // Moderate
  { cLow: 155, cHigh: 254, aqiLow: 101, aqiHigh: 150 }, // Unhealthy for Sensitive Groups
  { cLow: 255, cHigh: 354, aqiLow: 151, aqiHigh: 200 }, // Unhealthy
  { cLow: 355, cHigh: 424, aqiLow: 201, aqiHigh: 300 }, // Very Unhealthy
  { cLow: 425, cHigh: 604, aqiLow: 301, aqiHigh: 500 }, // Hazardous
];

/**
 * Registry of pollutants supported by the dynamic AQI ranges endpoint
 * (GET/PUT/DELETE /api/v2/devices/aqi-ranges?pollutant=<key>). AQI category
 * labels/colors/keys (AQI_CATEGORIES, AQI_COLORS, AQI_COLOR_NAMES,
 * AQI_CATEGORY_KEYS) are shared across every pollutant here — Good/Moderate/
 * etc. and their colors are a property of the AQI band itself, not of which
 * pollutant produced the underlying concentration. Only the concentration
 * breakpoints (`ranges`) and the numeric-AQI interpolation table
 * (`breakpoints`) are pollutant-specific.
 *
 * To add a new pollutant: define its `*_AQI_RANGES` / `*_AQI_BREAKPOINTS`
 * pair above (following an authoritative standard — see the CO2 note below)
 * and add an entry here. No other file needs a hardcoded pollutant list;
 * aqi.util.js and the validators all derive supported keys from this object.
 *
 * CO2 is deliberately not listed here: EPA/WHO AQI (the 0–500,
 * Good..Hazardous banding used by every entry below) is only defined for
 * criteria pollutants (PM2.5, PM10, O3, NO2, SO2, CO). CO2 air-quality
 * guidance (e.g. ASHRAE ventilation ppm thresholds) uses a different scale
 * and would need its own non-AQI representation, not a `ranges` entry here.
 */
const SUPPORTED_POLLUTANTS = {
  pm2_5: {
    label: "PM2.5",
    standard: "US EPA PM2.5 AQI (2024 NAAQS revision)",
    ranges: PM25_AQI_RANGES,
    breakpoints: PM25_AQI_BREAKPOINTS,
  },
  pm10: {
    label: "PM10",
    standard: "US EPA PM10 AQI (24-hour standard)",
    ranges: PM10_AQI_RANGES,
    breakpoints: PM10_AQI_BREAKPOINTS,
  },
};

const SUPPORTED_POLLUTANT_KEYS = Object.keys(SUPPORTED_POLLUTANTS);

// Export individual constants for backward compatibility
module.exports = {
  // Individual exports (existing code compatibility)
  AQI_RANGES,
  AQI_INDEX,
  AQI_CATEGORIES,
  AQI_COLORS,
  AQI_COLOR_NAMES,
  AQI_CATEGORY_KEYS,
  PM25_AQI_BREAKPOINTS,

  // Namespaced export (recommended for new code)
  AQI_CONSTANTS,

  // Alternative name for the keys array (matches existing usage in static-lists.js)
  AQI_CATEGORIES_KEYS: AQI_CATEGORY_KEYS,

  // Multi-pollutant support (GET/PUT/DELETE /aqi-ranges?pollutant=<key>)
  PM25_AQI_RANGES,
  PM10_AQI_RANGES,
  PM10_AQI_BREAKPOINTS,
  SUPPORTED_POLLUTANTS,
  SUPPORTED_POLLUTANT_KEYS,
};
