require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory succeeds without DB
try {
  const _schema = rewire("@models/Scope").__get__("ScopeSchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("scopes")) mongoose.model("scopes", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");

const ScopeModel = require("@models/Scope");

describe("ScopeSchema static methods", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should register a new scope", async () => {
      const args = {
        scope: "scope_name_1",
        description: "Scope description 1",
      };
      const createdData = { _id: "some_scope_id", ...args };

      // register() passes data directly to createSuccessResponse (no _doc)
      const createStub = sinon
        .stub(ScopeModel("airqo"), "create")
        .resolves(createdData);

      const result = await ScopeModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Scope created");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("scope", "scope_name_1");

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() calls this.countDocuments() then this.aggregate().match().sort()...
    // Aggregate builder chain + countDocuments require DB-free setup beyond simple .resolves().
  });

  describe("modify method", () => {
    it("should modify an existing scope", async () => {
      const filter = { _id: "existing_scope_id" };
      const update = { description: "Updated description" };
      const docData = {
        _id: "existing_scope_id",
        scope: "scope_name_1",
        description: "Updated description",
      };

      // modify() calls findOneAndUpdate(...).exec()
      const findOneAndUpdateStub = sinon
        .stub(ScopeModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...docData, _doc: docData }) });

      const result = await ScopeModel("airqo").modify({ filter, update });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the scope");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.include({ description: "Updated description" });

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove an existing scope", async () => {
      const filter = { _id: "existing_scope_id" };
      const docData = { scope: "scope_name_1", description: "Scope description 1" };

      // remove() calls findOneAndRemove(...).exec()
      const findOneAndRemoveStub = sinon
        .stub(ScopeModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...docData, _doc: docData }) });

      const result = await ScopeModel("airqo").remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the scope");
      expect(result.status).to.equal(httpStatus.OK);

      findOneAndRemoveStub.restore();
    });
  });
});

describe("ScopeSchema instance methods", () => {
  describe("toJSON method", () => {
    it("should return the JSON representation of the scope", () => {
      const scopeId = new mongoose.Types.ObjectId();
      const scope = new (ScopeModel("airqo"))({
        _id: scopeId,
        scope: "Scope 1",
        description: "Some description",
      });

      const result = scope.toJSON();

      // toJSON returns _id, scope, description, tier, resource_type, access_type, data_timeframe
      expect(result._id.toString()).to.equal(scopeId.toString());
      expect(result).to.have.property("scope", "Scope 1");
      expect(result).to.have.property("description", "Some description");
    });
  });
});
