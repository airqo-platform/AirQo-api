const TRAILING_PUNCT_RE = /[.,;'"]+$/;

/**
 * Strip trailing punctuation/quotes from an api_code string.
 * Used as the Mongoose setter on Device.api_code and in all util write paths
 * so the sanitization rule stays in one place.
 */
const sanitizeApiCode = (v) =>
  typeof v === "string" ? v.replace(TRAILING_PUNCT_RE, "") : v;

module.exports = { sanitizeApiCode };
