require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

const RoleModel = require("@models/Role");

describe("RoleSchema static methods", () => {
  beforeEach(() => {
    // Clear any stubs or spies before each test case
    sinon.restore();
  });

  describe("register method", () => {
    it("should create a new role and return the created data", async () => {
      // Mock the role data to be registered
      const roleData = {
        role_name: "Role 1",
        role_description: "Some description",
        role_status: "ACTIVE",
        role_code: "ROLE001",
        network_id: "network_id_1",
        role_permissions: ["permission_id_1", "permission_id_2"],
      };

      // Sample role document to be returned after registration
      const createdRoleData = {
        _id: "role_id_1",
        ...roleData,
      };

      // Mock the create method of the RoleModel to return the created role
      const createStub = sinon
        .stub(RoleModel, "create")
        .resolves(createdRoleData);

      // Call the register method
      const result = await RoleModel.register(roleData);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Role created");
      expect(result.data).to.deep.equal(createdRoleData);

      // Ensure that the create method is called with the correct arguments
      expect(createStub.calledOnceWith(roleData)).to.be.true;

      // Restore the stubbed method
      createStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("list method", () => {
    it("should list roles with the given filter and pagination options", async () => {
      // Mock the filter and pagination options
      const filter = { role_status: "ACTIVE" };
      const skip = 0;
      const limit = 10;

      // Sample roles to be returned from the database
      const sampleRoles = [
        { _id: "role_id_1", role_name: "Role 1" },
        { _id: "role_id_2", role_name: "Role 2" },
      ];

      // Mock the aggregate method of the RoleModel to return the sample roles
      const aggregateStub = sinon
        .stub(RoleModel, "aggregate")
        .resolves(sampleRoles);

      // Call the list method
      const result = await RoleModel.list({ filter, skip, limit });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully listed the roles");
      expect(result.data).to.deep.equal(sampleRoles);

      // Ensure that the aggregate method is called with the correct arguments
      expect(aggregateStub.calledOnce).to.be.true;
      expect(aggregateStub.args[0][0]).to.deep.include(filter);
      expect(aggregateStub.args[0][0]).to.have.property("$skip", skip);
      expect(aggregateStub.args[0][0]).to.have.property("$limit", limit);

      // Restore the stubbed method
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
    it("should modify the role and return the updated data", async () => {
      // Mock the filter and update data for modifying the role
      const filter = { _id: "role_id_1" };
      const update = {
        role_permissions: ["permission_id_1", "permission_id_3"],
        role_status: "INACTIVE",
      };

      // Sample role document to be returned after modification
      const updatedRoleData = {
        _id: "role_id_1",
        role_name: "Modified Role",
        role_status: "INACTIVE",
        role_permissions: ["permission_id_1", "permission_id_3"],
      };

      // Mock the findOneAndUpdate method of the RoleModel to return the updated role
      const findOneAndUpdateStub = sinon
        .stub(RoleModel, "findOneAndUpdate")
        .resolves(updatedRoleData);

      // Call the modify method
      const result = await RoleModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the Role");
      expect(result.data).to.deep.equal(updatedRoleData);

      // Ensure that the findOneAndUpdate method is called with the correct arguments
      expect(findOneAndUpdateStub.calledOnceWith(filter, update, { new: true }))
        .to.be.true;

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove method", () => {
    it("should remove the role and return the removed data", async () => {
      // Mock the filter data for removing the role
      const filter = { _id: "role_id_1" };

      // Sample role document to be returned after removal
      const removedRoleData = {
        _id: "role_id_1",
        role_name: "Role 1",
        role_code: "ROLE001",
        role_status: "ACTIVE",
      };

      // Mock the findOneAndRemove method of the RoleModel to return the removed role
      const findOneAndRemoveStub = sinon
        .stub(RoleModel, "findOneAndRemove")
        .resolves(removedRoleData);

      // Call the remove method
      const result = await RoleModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the Role");
      expect(result.data).to.deep.equal(removedRoleData);

      // Ensure that the findOneAndRemove method is called with the correct arguments
      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: { _id: 0, role_name: 1, role_code: 1, role_status: 1 },
        })
      ).to.be.true;

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
});

describe("RoleSchema instance method", () => {
  describe("toJSON method", () => {
    it("should return the JSON representation of the role", () => {
      // Sample role document
      const role = new RoleModel({
        _id: "role_id_1",
        role_name: "Role 1",
        role_code: "ROLE001",
        role_status: "ACTIVE",
        role_permissions: ["permission_id_1", "permission_id_2"],
        role_description: "Some description",
        network_id: "network_id_1",
        role_users: ["user_id_1", "user_id_2"],
      });

      // Call the toJSON method
      const result = role.toJSON();

      // Assertions
      expect(result).to.deep.equal({
        _id: "role_id_1",
        role_name: "Role 1",
        role_code: "ROLE001",
        role_status: "ACTIVE",
        role_permissions: ["permission_id_1", "permission_id_2"],
        role_description: "Some description",
        network_id: "network_id_1",
        role_users: ["user_id_1", "user_id_2"],
      });
    });

    // Add more test cases to cover other scenarios
  });
});
