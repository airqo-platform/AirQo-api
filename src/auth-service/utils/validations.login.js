const Validator = require("validator");
const isEmpty = require("is-empty");
module.exports = function validateLoginInput(data) {
  let errors = {};
  data.userName = !isEmpty(data.userName) ? data.userName : "";
  data.password = !isEmpty(data.password) ? data.password : "";

  if (Validator.isEmpty(data.userName)) {
    errors.userName = "the userName field is required";
  }

  if (Validator.isEmpty(data.password)) {
    errors.password = "password field is required";
  }
  return {
    errors,
    isValid: isEmpty(errors),
  };
};
