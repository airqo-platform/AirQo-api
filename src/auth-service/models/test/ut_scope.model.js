require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory succeeds without DB
try {
  const _schema = rewire("/Scope").__get__("ScopeSchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("scopes")) mongoose.model("scopes", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const mongoose = require("mongoose");
const httpStatus = require("http-status");

const ScopeModel = require("@models/Scope");

describe("ScopeSchema static methods", () => {
  describe("register method", () => {
    it("should register a new scope", async () => {
      const args = {
        scope: "scope_name_1",
        network_id: "network_id_1",
        description: "Scope description 1",
      };

      const result = await ScopeModel("airqo").register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Scope created");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id");
      expect(result.data.scope).to.equal("scope_name_1");
      expect(result.data.network_id).to.equal("network_id_1");
      expect(result.data.description).to.equal("Scope description 1");
    });

    // Add more test cases to cover other scenarios
  });

  describe("list method", () => {
    it("should list all scopes", async () => {
      const result = await ScopeModel("airqo").list();

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully listed the Scopes");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
    it("should modify an existing scope", async () => {
      // Assuming there is an existing scope with ID "existing_scope_id"
      const filter = { _id: "existing_scope_id" };
      const update = { description: "Updated description" };

      const result = await ScopeModel("airqo").modify({ filter, update });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the Scope");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id", "existing_scope_id");
      expect(result.data).to.have.property(
        "description",
        "Updated description"
      );
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove method", () => {
    it("should remove an existing scope", async () => {
      // Assuming there is an existing scope with ID "existing_scope_id"
      const filter = { _id: "existing_scope_id" };

      const result = await ScopeModel("airqo").remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the Scope");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id", "existing_scope_id");
    });

    // Add more test cases to cover other scenarios
  });
});

describe("ScopeSchema instance methods", () => {
  describe("toJSON method", () => {
    it("should return the JSON representation of the scope", () => {
      // Sample scope document
      const scope = new (ScopeModel("airqo"))({
        _id: "scope_id_1",
        scope: "Scope 1",
        description: "Some description",
      });

      // Call the toJSON method
      const result = scope.toJSON();

      // Assertions
      expect(result).to.deep.equal({
        _id: "scope_id_1",
        scope: "Scope 1",
        description: "Some description",
      });
    });

    // Add more test cases to cover other scenarios
  });
});
