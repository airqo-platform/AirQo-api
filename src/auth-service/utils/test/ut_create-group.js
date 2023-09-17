require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const httpStatus = require("http-status");
const createGroup = require("@utils/create-group");
const GroupModel = require("@models/Group");
const UserModel = require("@models/User");
const generateFilter = require("@utils/generate-filter");

describe("createGroup Module", () => {
  describe("create Function", () => {
    it("should return a success response when group is successfully created", async () => {
      // Mock GroupModel.register to return a successful response
      const groupModelStub = sinon.stub(GroupModel, "register");
      groupModelStub.resolves({
        success: true,
        status: httpStatus.CREATED,
        message: "Group Created",
        data: {
          /* Mocked group data */
        },
      });

      // Mock the request object
      const request = {
        body: {
          /* Mocked request body */
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the create function
      const response = await createGroup.create(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.CREATED);
      expect(response.message).to.equal("Group Created");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock GroupModel.register to throw an error
      const groupModelStub = sinon.stub(GroupModel, "register");
      groupModelStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const request = {
        body: {
          /* Mocked request body */
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the create function
      const response = await createGroup.create(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("update Function", () => {
    it("should return a success response when group is successfully updated", async () => {
      // Mock GroupModel.exists to return true
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(true);

      // Mock generateFilter.groups to return a filter
      const generateFilterStub = sinon.stub(generateFilter, "groups");
      generateFilterStub.resolves({
        success: true,
        data: {
          /* Mocked filter data */
        },
      });

      // Mock GroupModel.modify to return a successful response
      const groupModelModifyStub = sinon.stub(GroupModel, "modify");
      groupModelModifyStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group Updated",
        data: {
          /* Mocked updated group data */
        },
      });

      // Mock the request object
      const request = {
        body: {
          /* Mocked request body */
        },
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "group_id",
        },
      };

      // Call the update function
      const response = await updateGroup.update(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Group Updated");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
      generateFilterStub.restore();
      groupModelModifyStub.restore();
    });

    it("should return a bad request error when the group does not exist", async () => {
      // Mock GroupModel.exists to return false
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(false);

      // Mock the request object
      const request = {
        body: {
          /* Mocked request body */
        },
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "nonexistent_group_id",
        },
      };

      // Call the update function
      const response = await updateGroup.update(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.equal(
        "Group nonexistent_group_id not found"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock GroupModel.exists to throw an error
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const request = {
        body: {
          /* Mocked request body */
        },
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "group_id",
        },
      };

      // Call the update function
      const response = await updateGroup.update(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("delete Function", () => {
    it("should return a success response when group is successfully deleted", async () => {
      // Mock GroupModel.exists to return true
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(true);

      // Mock generateFilter.groups to return a filter
      const generateFilterStub = sinon.stub(generateFilter, "groups");
      generateFilterStub.resolves({
        success: true,
        data: {
          /* Mocked filter data */
        },
      });

      // Mock GroupModel.remove to return a successful response
      const groupModelRemoveStub = sinon.stub(GroupModel, "remove");
      groupModelRemoveStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Group Deleted",
        data: {
          /* Mocked deleted group data */
        },
      });

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "group_id",
        },
      };

      // Call the delete function
      const response = await deleteGroup.delete(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Group Deleted");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
      generateFilterStub.restore();
      groupModelRemoveStub.restore();
    });

    it("should return a bad request error when the group does not exist", async () => {
      // Mock GroupModel.exists to return false
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(false);

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "nonexistent_group_id",
        },
      };

      // Call the delete function
      const response = await deleteGroup.delete(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.equal(
        "Group nonexistent_group_id not found"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock GroupModel.exists to throw an error
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "group_id",
        },
      };

      // Call the delete function
      const response = await deleteGroup.delete(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelExistsStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("list Function", () => {
    it("should return a list of groups when successful", async () => {
      // Mock generateFilter.groups to return a filter
      const generateFilterStub = sinon.stub(generateFilter, "groups");
      generateFilterStub.resolves({
        success: true,
        data: {
          /* Mocked filter data */
        },
      });

      // Mock GroupModel.list to return a successful response
      const groupModelListStub = sinon.stub(GroupModel, "list");
      groupModelListStub.resolves({
        success: true,
        status: httpStatus.OK,
        message: "Groups List",
        data: [
          {
            /* Mocked group data */
          },
        ],
      });

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Call the list function
      const response = await listGroup.list(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("Groups List");
      expect(response.data).to.be.an("array");
      expect(response.data).to.have.lengthOf(1);
      // Add more assertions as needed
      // ...

      // Restore stubs
      generateFilterStub.restore();
      groupModelListStub.restore();
    });

    it("should return a bad request error when filter generation fails", async () => {
      // Mock generateFilter.groups to return an error response
      const generateFilterStub = sinon.stub(generateFilter, "groups");
      generateFilterStub.resolves({
        success: false,
        status: httpStatus.BAD_REQUEST,
        errors: { message: "Filter generation error" },
      });

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Call the list function
      const response = await listGroup.list(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.equal("Filter generation error");
      // Add more assertions as needed
      // ...

      // Restore stubs
      generateFilterStub.restore();
    });

    it("should return an internal server error response when an error occurs", async () => {
      // Mock generateFilter.groups to throw an error
      const generateFilterStub = sinon.stub(generateFilter, "groups");
      generateFilterStub.rejects(new Error("Internal Server Error"));

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Call the list function
      const response = await listGroup.list(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors.message).to.equal("Internal Server Error");
      // Add more assertions as needed
      // ...

      // Restore stubs
      generateFilterStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("assignUsers Function", () => {
    it("should assign users to a group successfully", async () => {
      // Mock the GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
        grp_network_id: "networkId",
      });

      // Mock the UserModel.findById method to return a user
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub
        .onFirstCall()
        .resolves({ _id: "userId1", groups: [] });
      userModelFindByIdStub
        .onSecondCall()
        .resolves({ _id: "userId2", groups: [] });

      // Mock UserModel.bulkWrite to return a success response
      const userModelBulkWriteStub = sinon.stub(UserModel, "bulkWrite");
      userModelBulkWriteStub.resolves({ nModified: 2, n: 2 });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
        },
        body: {
          user_ids: ["userId1", "userId2"],
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignUsers function
      const response = await assignUsersModule.assignUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully assigned all the provided users to the Group"
      );
      expect(response.data).to.be.an("array").that.is.empty;
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
      userModelBulkWriteStub.restore();
    });

    it("should handle user not found error", async () => {
      // Mock the GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
        grp_network_id: "networkId",
      });

      // Mock the UserModel.findById method to return a user for the first call
      // and null (user not found) for the second call
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub
        .onFirstCall()
        .resolves({ _id: "userId1", groups: [] });
      userModelFindByIdStub.onSecondCall().resolves(null);

      // Mock UserModel.bulkWrite to return a success response
      const userModelBulkWriteStub = sinon.stub(UserModel, "bulkWrite");
      userModelBulkWriteStub.resolves({ nModified: 1, n: 2 });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
        },
        body: {
          user_ids: ["userId1", "userId2"],
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignUsers function
      const response = await assignUsersModule.assignUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Operation partially successful; some 1 of the provided users were not found in the system"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
      userModelBulkWriteStub.restore();
    });

    it("should handle existing user assignment error", async () => {
      // Mock the GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
        grp_network_id: "networkId",
      });

      // Mock the UserModel.findById method to return a user
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub
        .onFirstCall()
        .resolves({ _id: "userId1", groups: [{ group: "groupId" }] });

      // Mock UserModel.bulkWrite to return a success response
      const userModelBulkWriteStub = sinon.stub(UserModel, "bulkWrite");
      userModelBulkWriteStub.resolves({ nModified: 0, n: 1 });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
        },
        body: {
          user_ids: ["userId1"],
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignUsers function
      const response = await assignUsersModule.assignUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "User userId1 is already assigned to the Group groupId"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
      userModelBulkWriteStub.restore();
    });

    it("should handle group not found error", async () => {
      // Mock the GroupModel.findById method to return null (group not found)
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves(null);

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
        },
        body: {
          user_ids: ["userId1"],
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignUsers function
      const response = await assignUsersModule.assignUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Invalid group ID groupId");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("assignOneUser Function", () => {
    it("should assign a user to a group successfully", async () => {
      // Mock UserModel.exists method to return true (user exists)
      const userModelExistsStub = sinon.stub(UserModel, "exists");
      userModelExistsStub.resolves(true);

      // Mock GroupModel.exists method to return true (group exists)
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(true);

      // Mock UserModel.findById method to return a user
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves({
        _id: "userId",
        groups: [],
      });

      // Mock UserModel.findByIdAndUpdate method to return an updated user
      const userModelFindByIdAndUpdateStub = sinon.stub(
        UserModel,
        "findByIdAndUpdate"
      );
      userModelFindByIdAndUpdateStub.resolves({
        _id: "userId",
        groups: [{ group: "groupId" }],
      });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignOneUser function
      const response = await assignOneUserModule.assignOneUser(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("User assigned to the Group");
      expect(response.data).to.deep.equal({
        _id: "userId",
        groups: [{ group: "groupId" }],
      });
      // Add more assertions as needed
      // ...

      // Restore stubs
      userModelExistsStub.restore();
      groupModelExistsStub.restore();
      userModelFindByIdStub.restore();
      userModelFindByIdAndUpdateStub.restore();
    });

    it("should handle user not found error", async () => {
      // Mock UserModel.exists method to return false (user not found)
      const userModelExistsStub = sinon.stub(UserModel, "exists");
      userModelExistsStub.resolves(false);

      // Mock GroupModel.exists method to return true (group exists)
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(true);

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignOneUser function
      const response = await assignOneUserModule.assignOneUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("User or Group not found");
      expect(response.errors.message).to.equal("User or Group not found");
      // Add more assertions as needed
      // ...

      // Restore stubs
      userModelExistsStub.restore();
      groupModelExistsStub.restore();
    });

    it("should handle group not found error", async () => {
      // Mock UserModel.exists method to return true (user exists)
      const userModelExistsStub = sinon.stub(UserModel, "exists");
      userModelExistsStub.resolves(true);

      // Mock GroupModel.exists method to return false (group not found)
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(false);

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignOneUser function
      const response = await assignOneUserModule.assignOneUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("User or Group not found");
      expect(response.errors.message).to.equal("User or Group not found");
      // Add more assertions as needed
      // ...

      // Restore stubs
      userModelExistsStub.restore();
      groupModelExistsStub.restore();
    });

    it("should handle user already assigned error", async () => {
      // Mock UserModel.exists method to return true (user exists)
      const userModelExistsStub = sinon.stub(UserModel, "exists");
      userModelExistsStub.resolves(true);

      // Mock GroupModel.exists method to return true (group exists)
      const groupModelExistsStub = sinon.stub(GroupModel, "exists");
      groupModelExistsStub.resolves(true);

      // Mock UserModel.findById method to return a user with an existing assignment
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves({
        _id: "userId",
        groups: [{ group: "groupId" }],
      });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the assignOneUser function
      const response = await assignOneUserModule.assignOneUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Group already assigned to User"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      userModelExistsStub.restore();
      groupModelExistsStub.restore();
      userModelFindByIdStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("unAssignUser Function", () => {
    it("should unassign a user from a group successfully", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.findById method to return a user with an existing assignment
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves({
        _id: "userId",
        groups: [{ group: "groupId" }],
      });

      // Mock UserModel.findByIdAndUpdate method to return an updated user
      const userModelFindByIdAndUpdateStub = sinon.stub(
        UserModel,
        "findByIdAndUpdate"
      );
      userModelFindByIdAndUpdateStub.resolves({
        _id: "userId",
        groups: [],
      });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignUser function
      const response = await unAssignUserModule.unAssignUser(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully unassigned User from the Group"
      );
      expect(response.data).to.deep.equal({
        _id: "userId",
        groups: [],
      });
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
      userModelFindByIdAndUpdateStub.restore();
    });

    it("should handle group not found error", async () => {
      // Mock GroupModel.findById method to return null (group not found)
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves(null);

      // Mock UserModel.findById method to return a user
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves({
        _id: "userId",
        groups: [{ group: "groupId" }],
      });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignUser function
      const response = await unAssignUserModule.unAssignUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Group groupId or User userId not found"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
    });

    it("should handle user not found error", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.findById method to return null (user not found)
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves(null);

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignUser function
      const response = await unAssignUserModule.unAssignUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Group groupId or User userId not found"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
    });

    it("should handle user not assigned error", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.findById method to return a user without the assignment
      const userModelFindByIdStub = sinon.stub(UserModel, "findById");
      userModelFindByIdStub.resolves({
        _id: "userId",
        groups: [],
      });

      // Mock the request object
      const request = {
        params: {
          grp_id: "groupId",
          user_id: "userId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignUser function
      const response = await unAssignUserModule.unAssignUser(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Group groupId is not assigned to the user"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindByIdStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("unAssignManyUsers Function", () => {
    it("should unassign many users from a group successfully", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.find method to return existing users
      const userModelFindStub = sinon.stub(UserModel, "find");
      userModelFindStub.resolves([
        {
          _id: "userId1",
          groups: [{ group: "groupId" }],
        },
        {
          _id: "userId2",
          groups: [{ group: "groupId" }],
        },
      ]);

      // Mock UserModel.updateMany method to return the number of modified users
      const userModelUpdateManyStub = sinon.stub(UserModel, "updateMany");
      userModelUpdateManyStub.resolves({
        nModified: 2,
      });

      // Mock the request object
      const request = {
        body: {
          user_ids: ["userId1", "userId2"],
        },
        params: {
          grp_id: "groupId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignManyUsers function
      const response = await unAssignManyUsersModule.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully unassigned all the provided users from the group groupId"
      );
      expect(response.data).to.deep.equal([]);
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindStub.restore();
      userModelUpdateManyStub.restore();
    });

    it("should handle group not found error", async () => {
      // Mock GroupModel.findById method to return null (group not found)
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves(null);

      // Mock UserModel.find method to return existing users
      const userModelFindStub = sinon.stub(UserModel, "find");
      userModelFindStub.resolves([
        {
          _id: "userId1",
          groups: [{ group: "groupId" }],
        },
      ]);

      // Mock the request object
      const request = {
        body: {
          user_ids: ["userId1"],
        },
        params: {
          grp_id: "groupId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignManyUsers function
      const response = await unAssignManyUsersModule.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal("Group groupId not found");
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindStub.restore();
    });

    it("should handle user not found error", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.find method to return empty users array (users not found)
      const userModelFindStub = sinon.stub(UserModel, "find");
      userModelFindStub.resolves([]);

      // Mock the request object
      const request = {
        body: {
          user_ids: ["userId1"],
        },
        params: {
          grp_id: "groupId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignManyUsers function
      const response = await unAssignManyUsersModule.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "The following users do not exist: userId1"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindStub.restore();
    });

    it("should handle users not assigned error", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.find method to return existing users
      const userModelFindStub = sinon.stub(UserModel, "find");
      userModelFindStub.resolves([
        {
          _id: "userId1",
          groups: [],
        },
      ]);

      // Mock the request object
      const request = {
        body: {
          user_ids: ["userId1"],
        },
        params: {
          grp_id: "groupId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignManyUsers function
      const response = await unAssignManyUsersModule.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Some of the provided User IDs are not assigned to this group groupId"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindStub.restore();
    });

    it("should handle no matching users found error", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.find method to return existing users
      const userModelFindStub = sinon.stub(UserModel, "find");
      userModelFindStub.resolves([
        {
          _id: "userId1",
          groups: [],
        },
        {
          _id: "userId2",
          groups: [],
        },
      ]);

      // Mock UserModel.updateMany method to return no modified users
      const userModelUpdateManyStub = sinon.stub(UserModel, "updateMany");
      userModelUpdateManyStub.resolves({
        nModified: 0,
      });

      // Mock the request object
      const request = {
        body: {
          user_ids: ["userId1", "userId2"],
        },
        params: {
          grp_id: "groupId",
        },
        query: {
          tenant: "tenant",
        },
      };

      // Call the unAssignManyUsers function
      const response = await unAssignManyUsersModule.unAssignManyUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "No matching User found in the system"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelFindStub.restore();
      userModelUpdateManyStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("listAvailableUsers Function", () => {
    it("should list available users for a group successfully", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.aggregate method to return available users
      const userModelAggregateStub = sinon.stub(UserModel, "aggregate");
      userModelAggregateStub.returns([
        {
          _id: "userId1",
          grp_title: "User1",
          grp_status: "Active",
          grp_tasks: [],
          createdAt: "2023-09-15 10:30:00",
          grp_description: "Description1",
        },
        {
          _id: "userId2",
          grp_title: "User2",
          grp_status: "Inactive",
          grp_tasks: [],
          createdAt: "2023-09-15 11:30:00",
          grp_description: "Description2",
        },
      ]);

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "groupId",
        },
      };

      // Call the listAvailableUsers function
      const response = await listAvailableUsersModule.listAvailableUsers(
        request
      );

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "retrieved all available users for group groupId"
      );
      expect(response.data).to.deep.equal([
        {
          _id: "userId1",
          grp_title: "User1",
          grp_status: "Active",
          grp_tasks: [],
          createdAt: "2023-09-15 10:30:00",
          grp_description: "Description1",
        },
        {
          _id: "userId2",
          grp_title: "User2",
          grp_status: "Inactive",
          grp_tasks: [],
          createdAt: "2023-09-15 11:30:00",
          grp_description: "Description2",
        },
      ]);
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelAggregateStub.restore();
    });

    it("should handle invalid group ID error", async () => {
      // Mock GroupModel.findById method to return null (group not found)
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves(null);

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "invalidGroupId",
        },
      };

      // Call the listAvailableUsers function
      const response = await listAvailableUsersModule.listAvailableUsers(
        request
      );

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Invalid group ID invalidGroupId, please crosscheck"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("listAssignedUsers Function", () => {
    it("should list assigned users for a group successfully", async () => {
      // Mock GroupModel.findById method to return a group
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves({
        _id: "groupId",
      });

      // Mock UserModel.aggregate method to return assigned users
      const userModelAggregateStub = sinon.stub(UserModel, "aggregate");
      userModelAggregateStub.returns([
        {
          _id: "userId1",
          grp_title: "User1",
          grp_status: "Active",
          grp_tasks: [],
          createdAt: "2023-09-15 10:30:00",
          grp_description: "Description1",
        },
        {
          _id: "userId2",
          grp_title: "User2",
          grp_status: "Inactive",
          grp_tasks: [],
          createdAt: "2023-09-15 11:30:00",
          grp_description: "Description2",
        },
      ]);

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "groupId",
        },
      };

      // Call the listAssignedUsers function
      const response = await listAssignedUsersModule.listAssignedUsers(request);

      // Assertions
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Retrieved all assigned users for group groupId"
      );
      expect(response.data).to.deep.equal([
        {
          _id: "userId1",
          grp_title: "User1",
          grp_status: "Active",
          grp_tasks: [],
          createdAt: "2023-09-15 10:30:00",
          grp_description: "Description1",
        },
        {
          _id: "userId2",
          grp_title: "User2",
          grp_status: "Inactive",
          grp_tasks: [],
          createdAt: "2023-09-15 11:30:00",
          grp_description: "Description2",
        },
      ]);
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
      userModelAggregateStub.restore();
    });

    it("should handle invalid group ID error", async () => {
      // Mock GroupModel.findById method to return null (group not found)
      const groupModelFindByIdStub = sinon.stub(GroupModel, "findById");
      groupModelFindByIdStub.resolves(null);

      // Mock the request object
      const request = {
        query: {
          tenant: "tenant",
        },
        params: {
          grp_id: "invalidGroupId",
        },
      };

      // Call the listAssignedUsers function
      const response = await listAssignedUsersModule.listAssignedUsers(request);

      // Assertions
      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Invalid group ID invalidGroupId, please crosscheck"
      );
      // Add more assertions as needed
      // ...

      // Restore stubs
      groupModelFindByIdStub.restore();
    });

    // Add more test cases for different scenarios
  });
});
