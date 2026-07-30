require("module-alias/register");
const { expect } = require("chai");
const constants = require("@config/constants");

describe("PASSWORD_REGEX", () => {
  describe("accepts passwords using the full allowed special-character set", () => {
    const validPasswords = [
      "Allahisgreat99##",
      "Pluto@!#$%^&*()+_-1",
      "Password1",
      "abc123!@#?.,",
    ];

    validPasswords.forEach((password) => {
      it(`accepts "${password}"`, () => {
        expect(constants.PASSWORD_REGEX.test(password)).to.be.true;
      });
    });
  });

  describe("rejects passwords that fail the requirements", () => {
    const invalidPasswords = {
      "no digit": "NoDigitsHere!!",
      "no letter": "123456!!",
      "too short": "Ab1!",
      "disallowed character (space)": "Password 1",
      "disallowed character (backslash)": "Password1\\",
    };

    Object.entries(invalidPasswords).forEach(([reason, password]) => {
      it(`rejects "${password}" (${reason})`, () => {
        expect(constants.PASSWORD_REGEX.test(password)).to.be.false;
      });
    });
  });
});
