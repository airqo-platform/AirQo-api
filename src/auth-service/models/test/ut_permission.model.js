require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const httpStatus = require("http-status");
const mongoose = require("mongoose");

const PermissionModel = require("@models/Permission");

describe("PermissionSchema statics and methods", () => {
  beforeEach(() => {
    // Clear any stubs or spies before each test case
    sinon.restore();
  });

  describe("register static method", () => {
    it("should create a new permission and return the created data", async () => {
      // Mock the input data for creating a new permission
      const args = {
        permission: "CREATE_POST",
        network_id: "network_id",
        description: "Permission to create a post",
      };

      // Mock the create method of the PermissionModel to return the created permission
      const createStub = sinon.stub(PermissionModel, "create").resolves({
        _id: "permission_id",
        permission: "CREATE_POST",
        network_id: "network_id",
        description: "Permission to create a post",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Call the register method
      const result = await PermissionModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Permission created");
      expect(result.data).to.deep.equal({
        _id: "permission_id",
        permission: "CREATE_POST",
        description: "Permission to create a post",
      });
      expect(result.status).to.equal(httpStatus.OK);

      // Ensure that the create method is called with the correct arguments
      expect(createStub.calledOnceWith(args)).to.be.true;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should handle validation errors properly and return an error response", async () => {
      // Mock the input data for creating a new permission (with duplicate permission value)
      const args = {
        permission: "CREATE_POST",
        network_id: "network_id",
        description: "Permission to create a post",
      };

      // Mock the create method of the PermissionModel to throw a validation error
      const createStub = sinon.stub(PermissionModel, "create").throws({
        keyValue: { permission: args.permission },
      });

      // Call the register method
      const result = await PermissionModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.errors).to.deep.equal({
        permission: "the permission must be unique",
      });
      expect(result.status).to.equal(httpStatus.CONFLICT);

      // Ensure that the create method is called with the correct arguments
      expect(createStub.calledOnceWith(args)).to.be.true;

      // Restore the stubbed method
      createStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  describe("list static method", () => {
    // Unit tests for the list method
    // Add your test cases here

    // Example test case for when the list is successful
    it("should list permissions and return the data", async () => {
      // Mock the input filter and options
      const filter = { network_id: "network_id" };
      const skip = 0;
      const limit = 10;

      // Mock the aggregate method of the PermissionModel to return the list of permissions
      const aggregateStub = sinon.stub(PermissionModel, "aggregate").resolves([
        {
          _id: "permission_id_1",
          permission: "CREATE_POST",
          description: "Permission to create a post",
          network: { _id: "network_id", name: "Network 1" },
        },
        {
          _id: "permission_id_2",
          permission: "EDIT_POST",
          description: "Permission to edit a post",
          network: { _id: "network_id", name: "Network 1" },
        },
        // More permissions...
      ]);

      // Call the list method
      const result = await PermissionModel.list({ skip, limit, filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully listed the permissions");
      expect(result.data).to.deep.equal([
        {
          _id: "permission_id_1",
          permission: "CREATE_POST",
          description: "Permission to create a post",
        },
        {
          _id: "permission_id_2",
          permission: "EDIT_POST",
          description: "Permission to edit a post",
        },
        // More permissions...
      ]);
      expect(result.status).to.equal(httpStatus.OK);

      // Ensure that the aggregate method is called with the correct arguments
      const expectedPipeline = [
        { $match: filter },
        { $sort: { createdAt: -1 } },
        {
          $lookup: {
            from: "networks",
            localField: "network_id",
            foreignField: "_id",
            as: "network",
          },
        },
        {
          $project: {
            _id: 1,
            permission: 1,
            description: 1,
            network: { $arrayElemAt: ["$network", 0] },
          },
        },
        {
          $project: {
            "network.__v": 0,
            "network.createdAt": 0,
            "network.updatedAt": 0,
          },
        },
        { $skip: skip },
        { $limit: limit },
        { $allowDiskUse: true },
      ];
      expect(aggregateStub.calledOnceWith(expectedPipeline)).to.be.true;

      // Restore the stubbed method
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  describe("modify static method", () => {
    beforeEach(() => {
      // Clear any stubs or spies before each test case
      sinon.restore();
    });

    it("should modify the permission and return the updated data", async () => {
      // Mock the filter and update data for modifying the permission
      const filter = { _id: "permission_id" };
      const update = { description: "Updated description" };

      // Sample permission document to be returned after update
      const updatedPermissionData = {
        _id: "permission_id",
        permission: "CREATE_POST",
        description: "Updated description",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock the findOneAndUpdate method of the PermissionModel to return the updated permission
      const findOneAndUpdateStub = sinon
        .stub(PermissionModel, "findOneAndUpdate")
        .resolves(updatedPermissionData);

      // Call the modify method
      const result = await PermissionModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the Permission");
      expect(result.data).to.deep.equal(updatedPermissionData);
      expect(result.status).to.equal(httpStatus.OK);

      // Ensure that the findOneAndUpdate method is called with the correct arguments
      expect(findOneAndUpdateStub.calledOnceWith(filter, update, { new: true }))
        .to.be.true;

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    it("should handle the case when the permission does not exist", async () => {
      // Mock the filter and update data for modifying the permission (non-existent permission)
      const filter = { _id: "non_existent_permission_id" };
      const update = { description: "Updated description" };

      // Mock the findOneAndUpdate method of the PermissionModel to return null (permission not found)
      const findOneAndUpdateStub = sinon
        .stub(PermissionModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method
      const result = await PermissionModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "Permission does not exist, please crosscheck"
      );
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.OK);

      // Ensure that the findOneAndUpdate method is called with the correct arguments
      expect(findOneAndUpdateStub.calledOnceWith(filter, update, { new: true }))
        .to.be.true;

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      // Mock the filter and update data for modifying the permission
      const filter = { _id: "permission_id" };
      const update = { description: "Updated description" };

      // Mock an internal server error (e.g., database connection issue)
      const error = new Error("Internal server error");
      const findOneAndUpdateStub = sinon
        .stub(PermissionModel, "findOneAndUpdate")
        .throws(error);

      // Call the modify method
      const result = await PermissionModel.modify({ filter, update });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("internal server error");
      expect(result.error).to.equal(error.message);
      expect(result.errors).to.deep.equal({
        message: "internal server error",
        error: error.message,
      });
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      // Ensure that the findOneAndUpdate method is called with the correct arguments
      expect(findOneAndUpdateStub.calledOnceWith(filter, update, { new: true }))
        .to.be.true;

      // Restore the stubbed method
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  describe("remove static method", () => {
    beforeEach(() => {
      // Clear any stubs or spies before each test case
      sinon.restore();
    });

    it("should remove the permission and return the removed data", async () => {
      // Mock the filter data for removing the permission
      const filter = { _id: "permission_id" };

      // Sample permission document to be returned after removal
      const removedPermissionData = {
        _id: "permission_id",
        permission: "CREATE_POST",
        description: "Some description",
      };

      // Mock the findOneAndRemove method of the PermissionModel to return the removed permission
      const findOneAndRemoveStub = sinon
        .stub(PermissionModel, "findOneAndRemove")
        .resolves(removedPermissionData);

      // Call the remove method
      const result = await PermissionModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the Permission");
      expect(result.data).to.deep.equal(removedPermissionData);
      expect(result.status).to.equal(httpStatus.OK);

      // Ensure that the findOneAndRemove method is called with the correct arguments
      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: { _id: 0, permission: 1, description: 1 },
        })
      ).to.be.true;

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    it("should handle the case when the permission does not exist", async () => {
      // Mock the filter data for removing the permission (non-existent permission)
      const filter = { _id: "non_existent_permission_id" };

      // Mock the findOneAndRemove method of the PermissionModel to return null (permission not found)
      const findOneAndRemoveStub = sinon
        .stub(PermissionModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method
      const result = await PermissionModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "Permission does not exist, please crosscheck"
      );
      expect(result.data).to.deep.equal([]);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);

      // Ensure that the findOneAndRemove method is called with the correct arguments
      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: { _id: 0, permission: 1, description: 1 },
        })
      ).to.be.true;

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    it("should handle internal server errors and return an error response", async () => {
      // Mock the filter data for removing the permission
      const filter = { _id: "permission_id" };

      // Mock an internal server error (e.g., database connection issue)
      const error = new Error("Internal server error");
      const findOneAndRemoveStub = sinon
        .stub(PermissionModel, "findOneAndRemove")
        .throws(error);

      // Call the remove method
      const result = await PermissionModel.remove({ filter });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("internal server error");
      expect(result.error).to.equal(error.message);
      expect(result.errors).to.deep.equal({
        message: "internal server error",
        error: error.message,
      });
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      // Ensure that the findOneAndRemove method is called with the correct arguments
      expect(
        findOneAndRemoveStub.calledOnceWith(filter, {
          projection: { _id: 0, permission: 1, description: 1 },
        })
      ).to.be.true;

      // Restore the stubbed method
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });
  // Add unit tests for the modify static method and the remove static method

  describe("toJSON method", () => {
    it("should convert the permission document to a JSON object", () => {
      // Create a sample permission document
      const permission = new PermissionModel({
        _id: "permission_id",
        permission: "CREATE_POST",
        description: "Permission to create a post",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Call the toJSON method
      const result = permission.toJSON();

      // Assertions
      expect(result).to.deep.equal({
        _id: "permission_id",
        permission: "CREATE_POST",
        description: "Permission to create a post",
      });
    });
  });

  // ... other test cases for other methods
});
