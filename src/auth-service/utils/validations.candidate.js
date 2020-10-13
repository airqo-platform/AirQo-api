const Validator = require("validator");
const isEmpty = require("is-empty");
module.exports = function validateCandidateInput(data) {
  let errors = {};
  // Convert empty fields to an empty string so as to use validator functions
  data.firstName = !isEmpty(data.firstName) ? data.firstName : "";
  data.lastName = !isEmpty(data.lastName) ? data.lastName : "";
  data.email = !isEmpty(data.email) ? data.email : "";
  data.description = !isEmpty(data.description) ? data.description : "";
  data.organization = !isEmpty(data.organization) ? data.organization : "";
  data.jobTitle = !isEmpty(data.jobTitle) ? data.jobTitle : "";
  data.category = !isEmpty(data.category) ? data.category : "";
  data.website = !isEmpty(data.website) ? data.website : "";

  if (Validator.isEmpty(data.firstName)) {
    errors.firstName = "firstName field is required";
  }

  if (Validator.isEmpty(data.category)) {
    errors.category = "Category is required";
  }

  if (Validator.isEmpty(data.website)) {
    errors.website = "Website is required";
  }

  if (Validator.isEmpty(data.description)) {
    errors.description = "Description is required";
  }

  if (Validator.isEmpty(data.organization)) {
    errors.organization = "organization name is required";
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
