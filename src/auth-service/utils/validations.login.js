const Validator = require("validator");
const isEmpty = require("is-empty");
module.exports = function validateLoginInput(data) {
  let errors = {};
  // Convert empty fields to an empty string so we can use validator functions
  data.email = !isEmpty(data.email) ? data.email : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  // email checks
  if (Validator.isEmpty(data.email)) {
    errors.email = "email field is required";
  }
  // Password checks
  if (Validator.isEmpty(data.password)) {
    errors.password = "password field is required";
  }
  return {
    errors,
    isValid: isEmpty(errors),
  };
};
