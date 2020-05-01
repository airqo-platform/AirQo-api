const Validator = require("validator");
const isEmpty = require("is-empty");
module.exports = function validateRegisterInput(data) {
  let errors = {};
  // Convert empty fields to an empty string so we can use validator functions
  data.firstName = !isEmpty(data.firstName) ? data.firstName : "";
  data.lastName = !isEmpty(data.lastName) ? data.lastName : "";
  data.email = !isEmpty(data.email) ? data.email : "";
  // Name checks
  if (Validator.isEmpty(data.firstName)) {
    errors.firstName = "firstName field is required";
  }

  if (Validator.isEmpty(data.phoneNumber)) {
    errors.phoneNumber = "Phone Number is required";
  }

  if (Validator.isEmpty(data.country)) {
    errors.country = "Country is required";
  }

  if (Validator.isEmpty(data.desc)) {
    errors.desc = "Description is required";
  }

  if (Validator.isEmpty(data.company)) {
    errors.company = "company name is required";
  }

  if (Validator.isEmpty(data.jobTitle)) {
    errors.jobTitle = "Job Title is required";
  }

  if (Validator.isEmpty(data.lastName)) {
    errors.lastName = "lastName field is required";
  }
  // Email checks
  if (Validator.isEmpty(data.email)) {
    errors.email = "Email field is required";
  } else if (!Validator.isEmail(data.email)) {
    errors.email = "Email is invalid";
  }

  return {
    errors,
    isValid: isEmpty(errors),
  };
};
