const generatePassword = require("generate-password");
const constants = require("../config/constants");

const createPassword = () => {
  try {
    let password = generatePassword.generate(
      constants.RANDOM_PASSWORD_CONFIGURATION
    );
    return {
      success: true,
      message: "password generated",
      data: password,
    };
  } catch (e) {
    logElement("generate password util error message", e.message);
    return {
      success: false,
      message: "generate password util server error",
      error: e.message,
    };
  }
};

module.exports = createPassword;
