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

// Export individual constants for backward compatibility
module.exports = {
  // Individual exports (existing code compatibility)
  AQI_RANGES,
  AQI_INDEX,
  AQI_CATEGORIES,
  AQI_COLORS,
  AQI_COLOR_NAMES,
  AQI_CATEGORY_KEYS,

  // Namespaced export (recommended for new code)
  AQI_CONSTANTS,

  // Alternative name for the keys array (matches existing usage in static-lists.js)
  AQI_CATEGORIES_KEYS: AQI_CATEGORY_KEYS,
};
