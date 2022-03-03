const Validator = require("validator");
const isEmpty = require("is-empty");
const joi = require("joi");
const httpStatus = require("http-status");
const { logObject, logElement } = require("./log");
constants = require("../config/constants");
const kickbox = require("kickbox")
  .client(`${constants.KICKBOX_API_KEY}`)
  .kickbox();
const emailExistence = require("email-existence");

const validation = {
  candidate: (data) => {
    let errors = {};
    // Convert empty fields to an empty string so as to use validator functions
    data.firstName = !isEmpty(data.firstName) ? data.firstName : "";
    data.lastName = !isEmpty(data.lastName) ? data.lastName : "";
    data.email = !isEmpty(data.email) ? data.email : "";
    data.description = !isEmpty(data.description) ? data.description : "";
    data.long_organization = !isEmpty(data.long_organization)
      ? data.long_organization
      : "";
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

    if (Validator.isEmpty(data.long_organization)) {
      errors.long_organization = "long_organization name is required";
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
  forgot: (email) => {
    let errors = {};
    // Convert empty fields to an empty string so we can use validator functions
    email = !isEmpty(email) ? email : "";

    // Email checks
    if (Validator.isEmpty(email)) {
      errors.email = "Email field is required";
    } else if (!Validator.isEmail(email)) {
      errors.email = "Email is invalid";
    }

    return {
      errors,
      isValid: isEmpty(errors),
    };
  },
  passwordReg: /(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{6,}/,
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
    data.firstName = !isEmpty(data.firstName) ? data.firstName : "";
    data.lastName = !isEmpty(data.lastName) ? data.lastName : "";
    data.email = !isEmpty(data.email) ? data.email : "";
    data.privilege = !isEmpty(data.privilege) ? data.privilege : "";
    data.organization = !isEmpty(data.organization) ? data.organization : "";
    data.long_organization = !isEmpty(data.long_organization)
      ? data.long_organization
      : "";

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

    if (Validator.isEmpty(data.long_organization)) {
      errors.long_organization = "long_organization name is required";
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
  updateKnownPassword: (data) => {
    let errors = {};
    data.password = !isEmpty(data.password) ? data.password : "";
    data.old_password = !isEmpty(data.old_password) ? data.old_password : "";

    if (Validator.isEmpty(data.old_password)) {
      errors.old_password = "the old password is required";
    }
    if (!Validator.isLength(data.password, { min: 6, max: 30 })) {
      errors.password = "Password must be at least 6 characters";
    }
    if (Validator.isEmpty(data.password)) {
      errors.password = "password field is required";
    }

    return {
      errors,
      isValid: isEmpty(errors),
    };
  },
  /**
   *
   * @param {string} email
   * @param {function} callback
   */
  checkEmailExistance: async (email, callback) => {
    try {
      return await emailExistence.check(email, (response, error) => {
        logObject("response from email existence--code", response.code);
        if (response.code === "ENODATA") {
          callback({
            success: false,
            message: "email address does not exist",
            errors: { message: "email address does not exist" },
            status: httpStatus.BAD_REQUEST,
          });
        } else {
          callback({
            success: true,
            message: "email exists",
            status: httpStatus.OK,
          });
        }
        if (error) {
          callback({
            success: false,
            message: "email address does not exist",
            errors: { message: error },
            status: httpStatus.BAD_GATEWAY,
          });
        }
      });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
  /**
   *
   * @param {string} email
   * @param {function} callback
   */
  checkEmailExistenceUsingKickbox: async (email, callback) => {
    try {
      await kickbox.verify(email, async (err, response) => {
        if (response.body.result === "undeliverable") {
          callback({
            success: false,
            message: `undeliverable email, did you mean ${response.body.did_you_mean}?`,
            errors: { message: response.body.reason },
            status: httpStatus.BAD_REQUEST,
          });
        }

        if (err) {
          callback({
            success: false,
            message: "email verification error",
            errors: { message: err },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        }

        if (response.body.result === "deliverable") {
          callback({
            success: true,
            message: "deliverable",
            status: httpStatus.OK,
          });
        }

        if (response.body.result === "risky") {
          callback({
            success: false,
            message: "risky email",
            errors: { message: response.body.reason },
            status: httpStatus.BAD_REQUEST,
          });
        }

        if (response.body.result === "unknown") {
          callback({
            success: false,
            message: "unknown email",
            errors: { message: response.body.reason },
            status: httpStatus.INTERNAL_SERVER_ERROR,
          });
        }

        if (response.body.role === true) {
          callback({
            success: false,
            message: "role email addresses are not accepted",
            errors: { message: "role email addresses are not accepted" },
            status: httpStatus.BAD_REQUEST,
          });
        }
      });
    } catch (error) {
      callback({
        success: false,
        message: "Internal Server Error",
        errors: {
          message: error.message,
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    }
  },
};

module.exports = validation;
