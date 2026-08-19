require("module-alias/register");
const httpStatus = require("http-status");
const chai = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const createHealthTips = require("@utils/health-tips.util");
const { generateFilter } = require("@utils/common");
const { expect } = chai;

describe("createHealthTips", () => {
  let sandbox;
  beforeEach(() => { sandbox = sinon.createSandbox(); });
  afterEach(() => { sandbox.restore(); });

  describe("list", () => {
    it("should list health tips successfully", async () => {
      // list uses aggregate().allowDiskUse(true), not .list()
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        aggregate: sandbox.stub().returns({
          allowDiskUse: sandbox.stub().resolves([{ paginatedResults: [], totalCount: [] }]),
        }),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const result = await createHealthTips.list({ query: { tenant: "testTenant" } }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        aggregate: sandbox.stub().returns({
          allowDiskUse: sandbox.stub().rejects(new Error("DB error")),
        }),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const next = sandbox.stub();
      await createHealthTips.list({ query: { tenant: "testTenant" } }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("delete", () => {
    it("should delete health tip successfully", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        remove: sandbox.stub().resolves({ success: true }),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const result = await createHealthTips.delete({ query: { tenant: "testTenant" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        remove: sandbox.stub().rejects(new Error("Database error")),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const next = sandbox.stub();
      await createHealthTips.delete({ query: { tenant: "testTenant" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("update", () => {
    it("should update health tip successfully", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        modify: sandbox.stub().resolves({ success: true }),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const result = await createHealthTips.update({ query: { tenant: "testTenant" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.true;
    });

    it("should handle internal server error", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        modify: sandbox.stub().rejects(new Error("Database error")),
      });
      sandbox.stub(generateFilter, "tips").returns({});
      const next = sandbox.stub();
      await createHealthTips.update({ query: { tenant: "testTenant" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });

  describe("create", () => {
    it("should handle registration failure", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        register: sandbox.stub().resolves({ success: false }),
      });
      const result = await createHealthTips.create({ query: { tenant: "testTenant" }, body: {} }, sandbox.stub());
      expect(result.success).to.be.false;
    });

    it("should handle internal server error during registration", async () => {
      sandbox.stub(mongoose, "model").withArgs("healthtips").returns({
        register: sandbox.stub().rejects(new Error("Database error")),
      });
      const next = sandbox.stub();
      await createHealthTips.create({ query: { tenant: "testTenant" }, body: {} }, next);
      expect(next.calledOnce).to.be.true;
    });
  });
});
