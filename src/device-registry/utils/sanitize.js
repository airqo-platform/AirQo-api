const sanitize = {
  roundAccurately: (number, decimalPlaces) =>
    Number(Math.round(number + "e" + decimalPlaces) + "e-" + decimalPlaces),
};

module.exports = sanitize;
