require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const httpStatus = require("http-status");
const createCandidate = require("@utils/candidate.util");

describe("createCandidate", () => {
  describe("create()", () => {
    it("should return deprecated response", async () => {
      const result = await createCandidate.create({}, () => {});
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Deprecated Functionality");
      expect(result.status).to.equal(httpStatus.GONE);
      expect(result.errors.message).to.include("deprecated");
    });
  });

  describe("list()", () => {
    it("should return deprecated response", async () => {
      const result = await createCandidate.list({ query: {}, body: {}, params: {} }, () => {});
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Deprecated Functionality");
      expect(result.status).to.equal(httpStatus.GONE);
    });
  });

  describe("update()", () => {
    it("should return deprecated response", async () => {
      const result = await createCandidate.update({ query: {}, body: {}, params: {} }, () => {});
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Deprecated Functionality");
      expect(result.status).to.equal(httpStatus.GONE);
    });
  });

  describe("confirm()", () => {
    it("should return deprecated response", async () => {
      const result = await createCandidate.confirm({ query: {}, body: {}, params: {} }, () => {});
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Deprecated Functionality");
      expect(result.status).to.equal(httpStatus.GONE);
    });
  });

  describe("delete()", () => {
    it("should return deprecated response", async () => {
      const result = await createCandidate.delete({ query: {}, body: {}, params: {} }, () => {});
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Deprecated Functionality");
      expect(result.status).to.equal(httpStatus.GONE);
    });
  });
});
