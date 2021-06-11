const Validator = require("validator");
const isEmpty = require("is-empty");

const validation = {
  candidate: (data) => {
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
  },
  forgot: (data) => {
    let errors = {};
    // Convert empty fields to an empty string so we can use validator functions
    data.email = !isEmpty(data.email) ? data.email : "";

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
  },
  passwordReg: () => {
    let passwordReg = /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/;
    return passwordReg;
  },
  login: (data) => {
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
  },
  register: (data) => {
    let errors = {};
    // Convert empty fields to an empty string so we can use validator functions
    data.userName = !isEmpty(data.userName) ? data.userName : "";
    data.firstName = !isEmpty(data.firstName) ? data.firstName : "";
    data.lastName = !isEmpty(data.lastName) ? data.lastName : "";
    data.email = !isEmpty(data.email) ? data.email : "";
    data.password = !isEmpty(data.password) ? data.password : "";
    data.password2 = !isEmpty(data.password2) ? data.password2 : "";
    data.privilege = !isEmpty(data.privilege) ? data.privilege : "";
    data.organization = !isEmpty(data.organization) ? data.organization : "";
    // Name checks
    if (Validator.isEmpty(data.firstName)) {
      errors.firstName = "firstName field is required";
    }

    if (Validator.isEmpty(data.lastName)) {
      errors.lastName = "lastName field is required";
    }

    //privilege checks
    if (Validator.isEmpty(data.privilege)) {
      errors.privilege = "privilege field is required";
    }

    //organization checks
    if (Validator.isEmpty(data.organization)) {
      errors.organization = "organization field is required";
    }

    //userName checks
    if (Validator.isEmpty(data.userName || data.email)) {
      errors.userName = "userName field is required";
      errors.email = "userName field is required";
    }

    // Email checks
    if (Validator.isEmpty(data.email)) {
      errors.email = "Email field is required";
    } else if (!Validator.isEmail(data.email)) {
      errors.email = "Email is invalid";
    }
    // Password checks
    if (Validator.isEmpty(data.password)) {
      errors.password = "Password field is required";
    }
    if (Validator.isEmpty(data.password2)) {
      errors.password2 = "Confirm password field is required";
    }
    if (!Validator.isLength(data.password, { min: 6, max: 30 })) {
      errors.password = "Password must be at least 6 characters";
    }
    if (!Validator.equals(data.password, data.password2)) {
      errors.password2 = "Passwords must match";
    }
    return {
      errors,
      isValid: isEmpty(errors),
    };
  },
  updateKnownPassword: () => {
    let errors = {};
    // Convert empty fields to an empty string so we can use validator functions
    data.password = !isEmpty(data.password) ? data.password : "";
    data.password2 = !isEmpty(data.password2) ? data.password2 : "";
    // Email checks

    // Password checks
    if (Validator.isEmpty(data.password)) {
      errors.password = "password field is required";
    }
    if (Validator.isEmpty(data.password2)) {
      errors.password2 = "Confirm password field is required";
    }

    if (!Validator.isLength(data.password, { min: 6, max: 30 })) {
      errors.password = "Password must be at least 6 characters";
    }

    if (!Validator.equals(data.password, data.password2)) {
      errors.password2 = "Passwords must match";
    }
    return {
      errors,
      isValid: isEmpty(errors),
    };
  },
};

module.exports = validation;
