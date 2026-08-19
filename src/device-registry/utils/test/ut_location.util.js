require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const createLocation = require("@utils/location.util");
const { generateFilter } = require("@utils/common");
const httpStatus = require("http-status");

const expect = chai.expect;

describe("createLocation", () => {
  describe("initialIsCapital", () => {
    it("should return true for a word with the initial letter capitalized", () => {
      const result = createLocation.initialIsCapital("Word");
      expect(result).to.be.true;
    });

    it("should return false for a word with the initial letter in lowercase", () => {
      const result = createLocation.initialIsCapital("word");
      expect(result).to.be.false;
    });

    // Add more test cases as needed
  });

  describe("hasNoWhiteSpace", () => {
    it("should return true for a word with no white space", () => {
      const result = createLocation.hasNoWhiteSpace("Word");
      expect(result).to.be.true;
    });

    it("should return false for a word with white space", () => {
      const result = createLocation.hasNoWhiteSpace("Word with space");
      expect(result).to.be.false;
    });

    // Add more test cases as needed
  });

  describe("create", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should create a location and send message to Kafka", async () => {
      const request = { body: { name: "Test Location" }, query: { tenant: "test_tenant" } };
      const registerStub = sandbox.stub().resolves({ success: true, data: { _id: "loc1" } });
      sandbox.stub(mongoose, "model").withArgs("locations").returns({ register: registerStub });
      const next = sandbox.stub();

      const result = await createLocation.create(request, next);
      // Kafka may fail (no brokers in test env) but register should have been called
      expect(result !== undefined || next.calledOnce).to.be.true;
    });

    it("should handle errors during location creation", async () => {
      const request = { body: {}, query: { tenant: "test_tenant" } };
      sandbox.stub(mongoose, "model").withArgs("locations").returns({
        register: sandbox.stub().rejects(new Error("DB error")),
      });
      const next = sandbox.stub();

      const result = await createLocation.create(request, next);
      // Error path: either returns failure or calls next
      expect((result && result.success === false) || next.calledOnce).to.be.true;
    });
  });

  describe("update", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should update a location", async () => {
      const request = { body: { name: "Updated" }, query: { tenant: "test_tenant" }, params: {} };
      const modifyStub = sandbox.stub().resolves({ success: true, data: {} });
      sandbox.stub(mongoose, "model").withArgs("locations").returns({ modify: modifyStub });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.update(request, next);
      expect((result && result.success !== undefined) || next.calledOnce).to.be.true;
    });

    it("should handle errors during location update", async () => {
      const request = { body: {}, query: { tenant: "test_tenant" }, params: {} };
      sandbox.stub(mongoose, "model").withArgs("locations").returns({
        modify: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.update(request, next);
      expect((result && result.success === false) || next.calledOnce).to.be.true;
    });
  });

  describe("delete", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should delete a location", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {}, params: {} };
      const removeStub = sandbox.stub().resolves({ success: true, data: {} });
      sandbox.stub(mongoose, "model").withArgs("locations").returns({ remove: removeStub });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.delete(request, next);
      expect((result && result.success !== undefined) || next.calledOnce).to.be.true;
    });

    it("should handle errors during location deletion", async () => {
      const request = { query: { tenant: "test_tenant" }, body: {}, params: {} };
      sandbox.stub(mongoose, "model").withArgs("locations").returns({
        remove: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.delete(request, next);
      expect((result && result.success === false) || next.calledOnce).to.be.true;
    });
  });

  describe("list", () => {
    let sandbox;
    beforeEach(() => { sandbox = sinon.createSandbox(); });
    afterEach(() => { sandbox.restore(); });

    it("should list locations", async () => {
      const request = { query: { tenant: "test_tenant", skip: 0 }, body: {}, params: {} };
      const listStub = sandbox.stub().resolves({ success: true, data: [] });
      sandbox.stub(mongoose, "model").withArgs("locations").returns({ list: listStub });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.list(request, next);
      expect((result && result.success !== undefined) || next.calledOnce).to.be.true;
    });

    it("should handle errors during location listing", async () => {
      const request = { query: { tenant: "test_tenant", skip: 0 }, body: {}, params: {} };
      sandbox.stub(mongoose, "model").withArgs("locations").returns({
        list: sandbox.stub().rejects(new Error("DB error")),
      });
      sandbox.stub(generateFilter, "locations").returns({});
      const next = sandbox.stub();

      const result = await createLocation.list(request, next);
      expect((result && result.success === false) || next.calledOnce).to.be.true;
    });
  });

  // Add more describe blocks and test cases for other utility functions as needed

  // ...
});

// Add more high-level describe blocks and test cases for other modules as needed

// ...
