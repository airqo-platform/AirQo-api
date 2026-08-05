require("module-alias/register");
const { expect } = require("chai");
const constants = require("@config/constants");

describe("PASSWORD_REGEX", () => {
  describe("accepts passwords using the full allowed special-character set", () => {
    const validPasswords = [
      "Zx9Qw7##",
      "Xz9!#$%^&*()+_-Q",
      "Qw12Er34",
      "ab12!@#?.,",
    ];

    validPasswords.forEach((password) => {
      it(`accepts "${password}"`, () => {
        expect(constants.PASSWORD_REGEX.test(password)).to.be.true;
      });
    });
  });

  describe("rejects passwords that fail the requirements", () => {
    const invalidPasswords = {
      "no digit": "NoDigitsXY!!",
      "no letter": "000000!!",
      "too short": "Ab1!",
      "disallowed character (space)": "Testval 1",
      "disallowed character (backslash)": "Testval1\\",
    };

    Object.entries(invalidPasswords).forEach(([reason, password]) => {
      it(`rejects "${password}" (${reason})`, () => {
        expect(constants.PASSWORD_REGEX.test(password)).to.be.false;
      });
    });
  });
});
