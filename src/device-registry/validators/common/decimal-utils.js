/**
 * Count decimal places in a number
 * @param {number|string} value - The value to check
 * @returns {number} - Number of decimal places
 */
const countDecimalPlaces = (value) => {
  const stringValue = String(value);
  const decimalIndex = stringValue.indexOf(".");

  if (decimalIndex === -1) {
    return 0; // No decimal point
  }

  return stringValue.length - decimalIndex - 1;
};

module.exports = {
  countDecimalPlaces,
};
