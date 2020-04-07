const Validator = require("validator");
const isEmpty = require("is-empty");
module.exports = function validateLoginInput(data) {
  let errors = {};
  // Convert empty fields to an empty string so we can use validator functions
  data.userName = !isEmpty(data.userName) ? data.userName : "";
  data.password = !isEmpty(data.password) ? data.password : "";
  // Email checks

  // userName checks
  if (Validator.isEmpty(data.userName)) {
    errors.userName = "userName field is required";
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
