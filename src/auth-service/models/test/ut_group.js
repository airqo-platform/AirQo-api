require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const mongoose = require("mongoose");
const GroupSchema = require("@models/Group");

// Replace this with the actual import path for your Group model if applicable
const GroupModel = mongoose.model("Group", GroupSchema);

describe("GroupSchema statics", () => {
  describe("register method", () => {
    it("should create a new Group and return success message with status 200", async () => {
      // Mock input data for the Group to be created
      const args = {
        grp_title: "Group Title",
        grp_status: "ACTIVE",
        grp_network_id: "some_network_id",
        grp_users: ["user_id_1", "user_id_2"],
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      // Mock the Group.create method to return a successful result
      const createStub = sinon.stub(GroupModel, "create").resolves(args);

      // Call the register method
      const result = await GroupModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("group created");
      expect(result.status).to.equal(200);
      expect(result.data).to.deep.equal(args);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return success message with status 202 if the Group is not created", async () => {
      // Mock input data for the Group (this time we'll return an empty data array)
      const args = {
        grp_title: "Group Title",
        grp_status: "ACTIVE",
        grp_network_id: "some_network_id",
        grp_users: ["user_id_1", "user_id_2"],
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      // Mock the Group.create method to return an empty data array
      const createStub = sinon.stub(GroupModel, "create").resolves([]);

      // Call the register method
      const result = await GroupModel.register(args);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "group NOT successfully created but operation successful"
      );
      expect(result.status).to.equal(202);
      expect(result.data).to.be.an("array").that.is.empty;

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Group creation encounters duplicate values", async () => {
      // Mock input data for the Group with duplicate values
      const args = {
        grp_title: "Duplicate Title",
        grp_status: "ACTIVE",
        grp_network_id: "some_network_id",
        grp_users: ["user_id_1", "user_id_2"],
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      // Mock the Group.create method to throw a duplicate key error
      const createStub = sinon.stub(GroupModel, "create").throws({
        code: 11000,
        keyValue: { grp_title: "Duplicate Title" },
      });

      // Call the register method
      const result = await GroupModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        grp_title: "Duplicate Title should be unique!",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    it("should return validation errors if the Group creation encounters other validation errors", async () => {
      // Mock input data for the Group with invalid values
      const args = {
        grp_title: "", // Empty title (invalid)
        grp_status: "ACTIVE",
        grp_network_id: "some_network_id",
        grp_users: ["user_id_1", "user_id_2"],
        grp_tasks: 5,
        grp_description: "Group Description",
      };

      // Mock the Group.create method to throw a validation error
      const createStub = sinon.stub(GroupModel, "create").throws({
        errors: {
          grp_title: {
            message: "grp_title is required",
          },
        },
      });

      // Call the register method
      const result = await GroupModel.register(args);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.errors).to.deep.equal({
        grp_title: "grp_title is required",
      });
      expect(result.message).to.equal(
        "validation errors for some of the provided fields"
      );
      expect(result.status).to.equal(409);

      // Restore the stubbed method
      createStub.restore();
    });

    // Add more test cases to cover additional scenarios
  });

  describe("list method", () => {
    it("should list groups based on the provided filter", async () => {
      // Sample groups data
      const groupsData = [
        {
          _id: "group_id_1",
          grp_title: "Group 1",
          grp_status: "active",
          grp_tasks: ["task1", "task2"],
          grp_description: "Description for Group 1",
          createdAt: new Date("2023-01-01"),
          grp_users: [
            {
              _id: "user_id_1",
              firstName: "John",
              lastName: "Doe",
              email: "john.doe@example.com",
            },
            {
              _id: "user_id_2",
              firstName: "Jane",
              lastName: "Smith",
              email: "jane.smith@example.com",
            },
          ],
          network: {
            _id: "network_id_1",
            networkName: "Network 1",
            networkStatus: "active",
          },
        },
        // Add more sample data if needed
      ];

      // Stub the aggregate method of the model to return the groups data
      const aggregateStub = sinon
        .stub(GroupModel, "aggregate")
        .resolves(groupsData);

      // Call the list method with sample filter
      const filter = { grp_status: "active" };
      const result = await GroupModel.list({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully retrieved the groups"
      );
      expect(result).to.have.property("data").that.deep.equals(groupsData);

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    it("should return 'groups do not exist' message if no groups found", async () => {
      // Stub the aggregate method of the model to return an empty array (no groups found)
      const aggregateStub = sinon.stub(GroupModel, "aggregate").resolves([]);

      // Call the list method with sample filter
      const filter = { grp_status: "inactive" };
      const result = await GroupModel.list({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "groups do not exist, please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.NOT_FOUND);
      expect(result).to.have.property("data").that.is.an("array").that.is.empty;

      // Restore the aggregate method to its original implementation
      aggregateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
    it("should modify the group and return the updated group", async () => {
      // Sample group data before update
      const initialGroupData = {
        _id: "group_id_1",
        grp_title: "Group 1",
        grp_status: "active",
        grp_users: ["user_id_1", "user_id_2"],
        createdAt: new Date("2023-01-01"),
      };

      // Sample update data
      const updateData = {
        grp_status: "inactive",
        grp_users: ["user_id_2", "user_id_3"],
      };

      // Stub the findOneAndUpdate method of the model to return the updated group
      const findOneAndUpdateStub = sinon
        .stub(GroupModel, "findOneAndUpdate")
        .resolves({
          _doc: {
            ...initialGroupData,
            ...updateData,
          },
        });

      // Call the modify method with sample filter and update data
      const filter = { _id: "group_id_1" };
      const result = await GroupModel.modify({ filter, update: updateData });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully modified the group"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result)
        .to.have.property("data")
        .that.deep.equals({
          ...initialGroupData,
          ...updateData,
        });

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    it("should return 'group does not exist' message if no group found for modification", async () => {
      // Stub the findOneAndUpdate method of the model to return null (no group found for modification)
      const findOneAndUpdateStub = sinon
        .stub(GroupModel, "findOneAndUpdate")
        .resolves(null);

      // Call the modify method with sample filter and update data
      const filter = { _id: "non_existent_group_id" };
      const updateData = { grp_status: "inactive" };
      const result = await GroupModel.modify({ filter, update: updateData });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "group does not exist, please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.NOT_FOUND);
      expect(result).to.have.property("data").that.is.an("array").that.is.empty;

      // Restore the findOneAndUpdate method to its original implementation
      findOneAndUpdateStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove method", () => {
    it("should remove the group and return the removed group data", async () => {
      // Sample group data
      const groupData = {
        _id: "group_id_1",
        grp_title: "Group 1",
        grp_status: "active",
        grp_description: "Group description",
        createdAt: new Date("2023-01-01"),
      };

      // Stub the findOneAndRemove method of the model to return the removed group
      const findOneAndRemoveStub = sinon
        .stub(GroupModel, "findOneAndRemove")
        .resolves({
          _doc: groupData,
        });

      // Call the remove method with sample filter
      const filter = { _id: "group_id_1" };
      const result = await GroupModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "successfully removed the group"
      );
      expect(result).to.have.property("status", httpStatus.OK);
      expect(result).to.have.property("data").that.deep.equals(groupData);

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    it("should return 'group does not exist' message if no group found for removal", async () => {
      // Stub the findOneAndRemove method of the model to return null (no group found for removal)
      const findOneAndRemoveStub = sinon
        .stub(GroupModel, "findOneAndRemove")
        .resolves(null);

      // Call the remove method with sample filter
      const filter = { _id: "non_existent_group_id" };
      const result = await GroupModel.remove({ filter });

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("success", true);
      expect(result).to.have.property(
        "message",
        "group does not exist, please crosscheck"
      );
      expect(result).to.have.property("status", httpStatus.NOT_FOUND);
      expect(result).to.have.property("data").that.is.an("array").that.is.empty;

      // Restore the findOneAndRemove method to its original implementation
      findOneAndRemoveStub.restore();
    });

    // Add more test cases to cover other scenarios
  });

  // Add more tests for other static methods if applicable
});

describe("GroupSchema methods", () => {
  describe("toJSON method", () => {
    it("should return a JSON object with specific properties", () => {
      // Create a new instance of GroupSchema with mock data
      const group = new GroupModel({
        _id: "some_id",
        grp_title: "Group Title",
        grp_status: "ACTIVE",
        grp_users: ["user_id_1", "user_id_2"],
        grp_tasks: 5,
        grp_description: "Group Description",
        grp_network_id: "some_network_id",
        createdAt: "2023-07-25T12:34:56.789Z",
      });

      // Call the toJSON method on the group instance
      const result = group.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "some_id");
      expect(result).to.have.property("grp_title", "Group Title");
      expect(result).to.have.property("grp_status", "ACTIVE");
      expect(result)
        .to.have.property("grp_users")
        .that.deep.equals(["user_id_1", "user_id_2"]);
      expect(result).to.have.property("grp_tasks", 5);
      expect(result).to.have.property("grp_description", "Group Description");
      expect(result).to.have.property("grp_network_id", "some_network_id");
      expect(result).to.have.property("createdAt", "2023-07-25T12:34:56.789Z");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  // Add more tests for other methods if applicable
});
