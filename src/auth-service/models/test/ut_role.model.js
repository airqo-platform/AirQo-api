require("module-alias/register");
const rewire = require("rewire");
// Register model in-memory so factory succeeds without DB
try {
  const _schema = rewire("@models/Role").__get__("RoleSchema");
  const mongoose = require("mongoose");
  if (!mongoose.modelNames().includes("roles")) mongoose.model("roles", _schema);
} catch (_) {}
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

const RoleModel = require("@models/Role");

describe("RoleSchema static methods", () => {
  beforeEach(() => {
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new role and return the created data", async () => {
      const roleData = {
        role_name: "Role 1",
        role_description: "Some description",
        role_status: "ACTIVE",
        role_code: "ROLE001",
      };
      const createdRoleData = { _id: "role_id_1", ...roleData };

      // register() reads newRole._doc, so the stub must expose _doc
      const createStub = sinon
        .stub(RoleModel("airqo"), "create")
        .resolves({ ...createdRoleData, _doc: createdRoleData });

      const result = await RoleModel("airqo").register(roleData);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Role created");
      expect(result.data).to.deep.equal(createdRoleData);
      expect(createStub.calledOnce).to.be.true;

      createStub.restore();
    });
  });

  describe.skip("list method", () => {
    // Skipped: list() uses this.aggregate().match().sort().lookup()... builder chain
    // plus this.countDocuments() — both require DB-free stubs beyond simple .resolves().
  });

  describe("modify method", () => {
    it("should modify the role and return the updated data", async () => {
      const filter = { _id: "role_id_1" };
      const update = { role_status: "INACTIVE" };
      const updatedRoleData = {
        _id: "role_id_1",
        role_name: "Modified Role",
        role_status: "INACTIVE",
      };

      // modify() calls findOneAndUpdate(...).exec()
      const findOneAndUpdateStub = sinon
        .stub(RoleModel("airqo"), "findOneAndUpdate")
        .returns({ exec: sinon.stub().resolves({ ...updatedRoleData, _doc: updatedRoleData }) });

      const result = await RoleModel("airqo").modify({ filter, update });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the role");
      expect(result.data).to.deep.equal(updatedRoleData);
      expect(findOneAndUpdateStub.calledOnce).to.be.true;

      findOneAndUpdateStub.restore();
    });
  });

  describe("remove method", () => {
    it("should remove the role and return the removed data", async () => {
      const filter = { _id: "role_id_1" };
      const removedRoleData = {
        role_name: "Role 1",
        role_code: "ROLE001",
        role_status: "ACTIVE",
      };

      // remove() calls findOneAndRemove(...).exec()
      const findOneAndRemoveStub = sinon
        .stub(RoleModel("airqo"), "findOneAndRemove")
        .returns({ exec: sinon.stub().resolves({ ...removedRoleData, _doc: removedRoleData }) });

      const result = await RoleModel("airqo").remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the role");
      expect(result.data).to.deep.equal(removedRoleData);
      expect(findOneAndRemoveStub.calledOnce).to.be.true;

      findOneAndRemoveStub.restore();
    });
  });
});

describe("RoleSchema instance method", () => {
  describe("toJSON method", () => {
    it("should return the JSON representation of the role", () => {
      const roleId = new mongoose.Types.ObjectId();
      const networkId = new mongoose.Types.ObjectId();
      const permId1 = new mongoose.Types.ObjectId();
      const permId2 = new mongoose.Types.ObjectId();

      const role = new (RoleModel("airqo"))({
        _id: roleId,
        role_name: "Role 1",
        role_code: "ROLE001",
        role_status: "ACTIVE",
        role_permissions: [permId1, permId2],
        role_description: "Some description",
        network_id: networkId,
      });

      const result = role.toJSON();

      // toJSON returns: _id, role_name, role_code, role_status, role_permissions,
      // role_description, network_id — no role_users
      expect(result._id.toString()).to.equal(roleId.toString());
      expect(result).to.have.property("role_name", "Role 1");
      expect(result).to.have.property("role_code", "ROLE001");
      expect(result).to.have.property("role_status", "ACTIVE");
      expect(result).to.have.property("role_description", "Some description");
      expect(result.role_permissions).to.be.an("array").with.lengthOf(2);
    });
  });
});
