require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const { expect } = chai;

const v1 = require("@routes/v1");
const v2 = require("@routes/v2");

describe("API", () => {
  describe("v1", () => {
    it('should have a property called "v1"', () => {
      expect(v1).to.have.property("v1");
    });

    it('should have the expected value for "v1"', () => {
      expect(v1.v1).to.equal("v1");
    });
  });

  describe("v2", () => {
    it('should have a property called "v2"', () => {
      expect(v2).to.have.property("v2");
    });

    it('should have the expected value for "v2"', () => {
      expect(v2.v2).to.equal("v2");
    });
  });

  // Add more test cases if needed
});
