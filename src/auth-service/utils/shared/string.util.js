const sanitizeEmailString = (str = "") => {
  if (!str) return "";
  // Remove CR, LF, and other control characters
  return str.replace(/[\r\n\t\v\f]+/g, " ").trim();
};

module.exports = {
  sanitizeEmailString,
};
