require("module-alias/register");
const rewire = require("rewire");
try {
  const _schema = rewire("@models/CompromisedTokenLog").__get__(
    "CompromisedTokenLogSchema"
  );
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("compromised_token_logs")) {
    mongoose.model("compromised_token_logs", _schema);
  }
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const CompromisedTokenLogModel = require("@models/CompromisedTokenLog");

describe("CompromisedTokenLogModel", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("Static Method: logCompromise", () => {
    it("should create a log entry and return success", async () => {
      const details = {
        email: "user@example.com",
        tokenHash: "abc123hash",
        tokenSuffix: "xyz",
        ip: "192.168.1.1",
      };

      const createStub = sinon
        .stub(CompromisedTokenLogModel("airqo"), "create")
        .resolves({ ...details, _id: "some-id" });

      const result = await CompromisedTokenLogModel("airqo").logCompromise(
        details
      );

      expect(result).to.be.an("object");
      expect(result.success).to.equal(true);
      expect(result.data).to.include({ email: "user@example.com" });
    });

    it("should return failure when create throws", async () => {
      const createStub = sinon
        .stub(CompromisedTokenLogModel("airqo"), "create")
        .throws(new Error("DB write failed"));

      const result = await CompromisedTokenLogModel("airqo").logCompromise({
        email: "user@example.com",
        tokenHash: "h",
        tokenSuffix: "s",
        ip: "1.2.3.4",
      });

      expect(result.success).to.equal(false);
      expect(result.message).to.equal("DB write failed");
    });
  });
});
