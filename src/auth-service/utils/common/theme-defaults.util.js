//utils/theme-defaults.util.js - helper file for theme defaults

/**
 * Gets the default theme values that match the ThemeSchema defaults
 * This should be kept in sync with models/ThemeSchema.js
 *
 * @returns {Object} Default theme object
 */
const getDefaultTheme = () => {
  return {
    primaryColor: "#1976d2", // Default blue color from schema
    mode: "light", // Default from schema
    interfaceStyle: "bordered", // Default from schema (NOT "default")
    contentLayout: "wide", // Default from schema (NOT "wide")
  };
};

/**
 * Validates if a theme object has any meaningful values
 * @param {Object} theme - Theme object to validate
 * @returns {boolean} True if theme has valid content
 */
const hasValidTheme = (theme) => {
  if (!theme || typeof theme !== "object") {
    return false;
  }

  // Check if theme has any properties and at least one non-empty value
  const keys = Object.keys(theme);
  return (
    keys.length > 0 &&
    keys.some(
      (key) =>
        theme[key] !== null && theme[key] !== undefined && theme[key] !== "",
    )
  );
};

/**
 * Merges user/group theme with defaults to ensure all required fields are present
 * @param {Object} theme - Partial theme object
 * @returns {Object} Complete theme object with defaults filled in
 */
const mergeWithDefaults = (theme) => {
  const defaults = getDefaultTheme();
  return { ...defaults, ...theme };
};

module.exports = {
  getDefaultTheme,
  hasValidTheme,
  mergeWithDefaults,
};
