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
  describe("removeUniqueConstraint", () => {
    it("should remove unique constraint for each group", async () => {
      // Create a sample array of groups for testing
      const groups = [
        { _id: "group1", grp_website: "website1" },
        { _id: "group2", grp_website: "website2" },
      ];

      // Mock the GroupModel.find function to return the sample groups
      const findStub = sinon.stub(GroupModel, "find").resolves(groups);

      // Mock the GroupModel.modify function to return a success response
      const modifyStub = sinon
        .stub(GroupModel, "modify")
        .resolves({ success: true, message: "Updated" });

      // Call the function
      const result = await createGroup.removeUniqueConstraint();

      // Assertions
      expect(result).to.deep.equal({
        success: true,
        message: "migration complete",
        httpStatus: "OK", // You may want to define 'OK' as a variable in your test file
      });

      // Check if the find and modify functions were called as expected
      expect(findStub).to.have.been.calledOnce;
      expect(modifyStub).to.have.been.calledTwice; // Called once for each group

      // Restore the stubbed functions to their original implementations
      findStub.restore();
      modifyStub.restore();
    });

    it("should handle errors and return a failure response", async () => {
      // Mock the GroupModel.find function to throw an error
      const findStub = sinon
        .stub(GroupModel, "find")
        .rejects(new Error("Test error"));

      // Call the function
      const result = await createGroup.removeUniqueConstraint();

      // Assertions
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error -- Migration failed",
        errors: { message: "Test error" },
      });

      // Check if the find function was called as expected
      expect(findStub).to.have.been.calledOnce;

      // Restore the stubbed function to its original implementation
      findStub.restore();
    });
  });
  describe("create()", () => {
    it("should create a new group and assign a user as SUPER_ADMIN", async () => {
      // Mock your UserModel and GroupModel functions as needed
      const UserModel = {
        findById: sinon.stub().returns({
          _id: "user_id",
          email: "user@example.com",
          firstName: "John",
          lastName: "Doe",
        }),
        findByIdAndUpdate: sinon.stub().returns({
          /* updated user */
        }),
      };

      const GroupModel = {
        register: sinon.stub().returns({
          success: true,
          data: {
            _doc: { _id: "group_id" },
          },
        }),
      };

      // Mock controlAccessUtil functions as needed
      const controlAccessUtil = {
        createRole: sinon.stub().returns({
          success: true,
          data: { _id: "role_id" },
        }),
        assignPermissionsToRole: sinon.stub().returns({
          success: true,
          data: {}, // You can customize the response as needed
        }),
      };

      // Mock constants.SUPER_ADMIN_PERMISSIONS or any other constants

      const request = {
        body: {
          /* request body with user_id, etc. */
        },
        query: {
          tenant: "test-tenant",
        },
        user: {
          /* user object if needed */
        },
      };

      const response = await createGroup.create(
        request,
        UserModel,
        GroupModel,
        controlAccessUtil
      );

      // Assert the response and expected behavior
      expect(response.success).to.equal(true);
      expect(response.message).to.equal("Success message"); // Customize the expected message
      // Additional assertions based on the expected behavior
      // ...

      // Optionally, assert that the UserModel and GroupModel functions were called as expected
      sinon.assert.calledOnce(UserModel.findById);
      sinon.assert.calledOnce(GroupModel.register);
      sinon.assert.calledOnce(controlAccessUtil.createRole);
      sinon.assert.calledOnce(controlAccessUtil.assignPermissionsToRole);
      sinon.assert.calledOnce(UserModel.findByIdAndUpdate);
    });

    it("should handle the case where the user is not registered", async () => {
      // Mock UserModel.findById to return null or an empty object
      const UserModel = {
        findById: sinon.stub().resolves(null), // Simulate user not found
      };

      // Mock your GroupModel and controlAccessUtil functions as needed
      const GroupModel = {
        // Mock GroupModel as needed
      };

      const controlAccessUtil = {
        // Mock controlAccessUtil functions as needed
      };

      const request = {
        body: {
          user_id: "non_existent_user_id", // Provide a user_id that doesn't exist
          /* other request body properties */
        },
        query: {
          tenant: "test-tenant",
        },
      };

      const response = await createGroup.create(
        request,
        UserModel,
        GroupModel,
        controlAccessUtil
      );

      // Assert that the response indicates that the user is not registered
      expect(response.success).to.equal(false);
      expect(response.message).to.equal("Your account is not registered");
      // Additional assertions based on the expected behavior

      // Optionally, assert that UserModel.findById was called as expected
      sinon.assert.calledOnce(UserModel.findById);
    });

    it("should handle other error cases and edge scenarios", async () => {
      // Define and test other scenarios, such as when certain functions return errors or specific responses
      // Customize the test cases based on your function's error handling
      // You can create test cases to cover various error scenarios and edge cases
      // Mock UserModel, GroupModel, and controlAccessUtil functions as needed
      // Assert the responses and expected behavior for each test case
    });
  });
  describe("update()", () => {
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

      // Call the update()
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

      // Call the update()
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

      // Call the update()
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
  describe("delete()", () => {
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

      // Call the delete()
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

      // Call the delete()
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

      // Call the delete()
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
  describe("list()", () => {
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

      // Call the list()
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

      // Call the list()
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

      // Call the list()
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
  describe("assignUsers()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
        body: {},
      };
    });

    it("should assign multiple users to a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user_ids = ["user1", "user2", "user3"];

      // Stub the GroupModel.findById method to return the group
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ grp_network_id: "network_id" });

      // Stub the UserModel.findById method to return existing users
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: "user1", group_roles: [] });

      // Stub the UserModel.bulkWrite method to return modified count
      sinon
        .stub(UserModel(tenant), "bulkWrite")
        .resolves({ nModified: user_ids.length, n: user_ids.length });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.assignUsers(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully assigned all the provided users to the Group"
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledThrice(UserModel(tenant).findById);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).bulkWrite,
        sinon.match.array
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).bulkWrite.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";
      const user_ids = ["user1", "user2", "user3"];

      // Stub the GroupModel.findById method to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.assignUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(`Invalid group ID ${groupId}`);

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);

      GroupModel(tenant).findById.restore();
    });

    it("should handle the case where some users do not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user_ids = ["user1", "non_existent_user", "user2"];

      // Stub the GroupModel.findById method to return the group
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ grp_network_id: "network_id" });

      // Stub the UserModel.findById method to return existing users
      sinon.stub(UserModel(tenant), "findById").callsFake((userId) => {
        if (userId === "non_existent_user") {
          return null;
        }
        return { _id: userId, group_roles: [] };
      });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.assignUsers(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Operation partially successful; some 1 of the provided users were not found in the system"
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledThrice(UserModel(tenant).findById);

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
    });

    it("should handle the case where users are already assigned to the group", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user_ids = ["user1", "user2", "user3"];

      // Stub the GroupModel.findById method to return the group
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ grp_network_id: "network_id" });

      // Stub the UserModel.findById method to return users with existing assignments
      sinon.stub(UserModel(tenant), "findById").callsFake((userId) => {
        return { _id: userId, group_roles: [{ group: groupId }] };
      });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.assignUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `User user1 is already assigned to the Group ${groupId}`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledThrice(UserModel(tenant).findById);

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user_ids = ["user1", "user2", "user3"];

      // Stub the GroupModel.findById method to return the group
      sinon
        .stub(GroupModel(tenant), "findById")
        .resolves({ grp_network_id: "network_id" });

      // Stub the UserModel.findById method to return existing users
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: "user1", group_roles: [] });

      // Stub the UserModel.bulkWrite method to throw an error
      sinon
        .stub(UserModel(tenant), "bulkWrite")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.assignUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledThrice(UserModel(tenant).findById);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).bulkWrite,
        sinon.match.array
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).bulkWrite.restore();
    });
  });

  describe("assignUsersHybrid", () => {
    it("should assign users to the group and return success", async () => {
      // Create mock data and stubs for GroupModel and UserModel
      const request = {
        params: { grp_id: "valid_group_id" },
        body: { user_ids: ["user1", "user2"] },
        query: { tenant: "test_tenant" },
      };
      const GroupModel = {
        findById: sinon.stub().resolves({}),
      };
      const UserModel = {
        findById: sinon.stub(),
        bulkWrite: sinon.stub(),
      };

      // Stub findById to return user data when called
      UserModel.findById
        .withArgs("user1")
        .resolves({ group_roles: [] })
        .withArgs("user2")
        .resolves({ group_roles: [] });

      // Stub bulkWrite to simulate a successful operation
      UserModel.bulkWrite.resolves({ nModified: 2 });

      const logger = {
        error: sinon.stub(),
      };

      // Call the function and make assertions
      const result = await createGroup.assignUsersHybrid(request, {
        UserModel,
        GroupModel,
        logger,
      });
      expect(result.success).to.equal(true);
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.include("All users have been assigned");
    });

    it("should handle invalid group ID", async () => {
      // Create mock data and stubs
      const request = {
        params: { grp_id: "invalid_group_id" },
        body: { user_ids: ["user1"] },
        query: { tenant: "test_tenant" },
      };
      const GroupModel = {
        findById: sinon.stub().resolves(null), // Group not found
      };

      const logger = {
        error: sinon.stub(),
      };

      // Call the function and make assertions
      const result = await createGroup.assignUsersHybrid(request, {
        GroupModel,
        logger,
      });
      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.include("Invalid group ID");
    });

    // Add more test cases for different scenarios

    // Don't forget to clean up stubs after each test.
    afterEach(() => {
      sinon.restore();
    });
  });
  describe("assignOneUser()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
      };
    });

    it("should assign a user to a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";

      // Stub the UserModel.exists and GroupModel.exists methods to return true
      sinon.stub(UserModel(tenant), "exists").resolves(true);
      sinon.stub(GroupModel(tenant), "exists").resolves(true);

      // Stub the UserModel.findById method to return the user
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [] });

      // Stub the UserModel.findByIdAndUpdate method to return the updated user
      sinon
        .stub(UserModel(tenant), "findByIdAndUpdate")
        .resolves({ _id: userId, group_roles: [{ group: groupId }] });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.assignOneUser(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("User assigned to the Group");
      expect(response.data._id).to.equal(userId);

      sinon.assert.calledOnceWithExactly(UserModel(tenant).exists, {
        _id: userId,
      });
      sinon.assert.calledOnceWithExactly(GroupModel(tenant).exists, {
        _id: groupId,
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).findByIdAndUpdate,
        userId,
        sinon.match.object,
        { new: true }
      );

      UserModel(tenant).exists.restore();
      GroupModel(tenant).exists.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).findByIdAndUpdate.restore();
    });

    it("should handle the case where the user does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "non_existent_user_id";

      // Stub the UserModel.exists method to return false
      sinon.stub(UserModel(tenant), "exists").resolves(false);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.assignOneUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("User or Group not found");
      expect(response.errors.message).to.equal("User or Group not found");

      sinon.assert.calledOnceWithExactly(UserModel(tenant).exists, {
        _id: userId,
      });

      UserModel(tenant).exists.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";
      const userId = "test_user_id";

      // Stub the UserModel.exists method to return true
      sinon.stub(UserModel(tenant), "exists").resolves(true);

      // Stub the GroupModel.exists method to return false
      sinon.stub(GroupModel(tenant), "exists").resolves(false);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.assignOneUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("User or Group not found");
      expect(response.errors.message).to.equal("User or Group not found");

      sinon.assert.calledOnceWithExactly(UserModel(tenant).exists, {
        _id: userId,
      });
      sinon.assert.calledOnceWithExactly(GroupModel(tenant).exists, {
        _id: groupId,
      });

      UserModel(tenant).exists.restore();
      GroupModel(tenant).exists.restore();
    });

    it("should handle the case where the user is already assigned to the group", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";

      // Stub the UserModel.exists and GroupModel.exists methods to return true
      sinon.stub(UserModel(tenant), "exists").resolves(true);
      sinon.stub(GroupModel(tenant), "exists").resolves(true);

      // Stub the UserModel.findById method to return the user with an existing assignment
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [{ group: groupId }] });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.assignOneUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "Group already assigned to User"
      );

      sinon.assert.calledOnceWithExactly(UserModel(tenant).exists, {
        _id: userId,
      });
      sinon.assert.calledOnceWithExactly(GroupModel(tenant).exists, {
        _id: groupId,
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);

      UserModel(tenant).exists.restore();
      GroupModel(tenant).exists.restore();
      UserModel(tenant).findById.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";

      // Stub the UserModel.exists and GroupModel.exists methods to return true
      sinon.stub(UserModel(tenant), "exists").resolves(true);
      sinon.stub(GroupModel(tenant), "exists").resolves(true);

      // Stub the UserModel.findById method to return the user
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [] });

      // Stub the UserModel.findByIdAndUpdate method to throw an error
      sinon
        .stub(UserModel(tenant), "findByIdAndUpdate")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.assignOneUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(UserModel(tenant).exists, {
        _id: userId,
      });
      sinon.assert.calledOnceWithExactly(GroupModel(tenant).exists, {
        _id: groupId,
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).findByIdAndUpdate,
        userId,
        sinon.match.object,
        { new: true }
      );

      UserModel(tenant).exists.restore();
      GroupModel(tenant).exists.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).findByIdAndUpdate.restore();
    });
  });
  describe("unAssignUser()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
      };
    });

    it("should unassign a user from a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";
      const groupAssignmentIndex = 0; // Assuming it's the first assignment

      // Stub the GroupModel.findById and UserModel.findById methods to return group and user
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [{ group: groupId }] });

      // Stub the UserModel.findByIdAndUpdate method to return the updated user
      sinon
        .stub(UserModel(tenant), "findByIdAndUpdate")
        .resolves({ _id: userId, group_roles: [] });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.unAssignUser(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "Successfully unassigned User from the Group"
      );
      expect(response.data._id).to.equal(userId);

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).findByIdAndUpdate,
        userId,
        { group_roles: [] },
        { new: true }
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).findByIdAndUpdate.restore();
    });

    it("should handle the case where the group or user does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";
      const userId = "non_existent_user_id";

      // Stub the GroupModel.findById and UserModel.findById methods to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);
      sinon.stub(UserModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.unAssignUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `Group ${groupId} or User ${userId} not found`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
    });

    it("should handle the case where the user is not assigned to the group", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";

      // Stub the GroupModel.findById and UserModel.findById methods to return group and user
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [] });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.unAssignUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `Group ${groupId.toString()} is not assigned to the user`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const userId = "test_user_id";
      const groupAssignmentIndex = 0; // Assuming it's the first assignment

      // Stub the GroupModel.findById and UserModel.findById methods to return group and user
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });
      sinon
        .stub(UserModel(tenant), "findById")
        .resolves({ _id: userId, group_roles: [{ group: groupId }] });

      // Stub the UserModel.findByIdAndUpdate method to throw an error
      sinon
        .stub(UserModel(tenant), "findByIdAndUpdate")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.params.user_id = userId;

      const response = await createGroup.unAssignUser(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).findById, userId);
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).findByIdAndUpdate,
        userId,
        sinon.match.object,
        { new: true }
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).findById.restore();
      UserModel(tenant).findByIdAndUpdate.restore();
    });
  });
  describe("unAssignManyUsers()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
        body: {},
      };
    });

    it("should unassign many users from a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user1Id = "user_id_1";
      const user2Id = "user_id_2";
      const user_ids = [user1Id, user2Id];

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.find and updateMany methods to return the users and update result
      sinon.stub(UserModel(tenant), "find").resolves([
        { _id: user1Id, group_roles: [{ group: groupId }] },
        { _id: user2Id, group_roles: [{ group: groupId }] },
      ]);
      sinon.stub(UserModel(tenant), "updateMany").resolves({ nModified: 2 });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        `Successfully unassigned all the provided users from the group ${groupId}`
      );
      expect(response.data).to.be.an("array").that.is.empty;

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).find, {
        _id: { $in: user_ids },
        "group_roles.group": groupId,
      });
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).updateMany,
        {
          _id: { $in: user_ids },
          group_roles: { $elemMatch: { group: groupId } },
        },
        {
          $pull: {
            group_roles: { group: groupId },
          },
        }
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).find.restore();
      UserModel(tenant).updateMany.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";
      const user_ids = ["user_id_1", "user_id_2"];

      // Stub the GroupModel.findById method to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(`Group ${groupId} not found`);

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);

      GroupModel(tenant).findById.restore();
    });

    it("should handle the case where some users do not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const existingUserId = "user_id_1";
      const nonExistentUserId = "non_existent_user_id";
      const user_ids = [existingUserId, nonExistentUserId];

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.find method to return only one existing user
      sinon
        .stub(UserModel(tenant), "find")
        .resolves([{ _id: existingUserId, group_roles: [{ group: groupId }] }]);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `The following users do not exist: ${nonExistentUserId}`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).find, {
        _id: { $in: user_ids },
        "group_roles.group": groupId,
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).find.restore();
    });

    it("should handle the case where some users are not assigned to the group", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user1Id = "user_id_1";
      const user2Id = "user_id_2";
      const user_ids = [user1Id, user2Id];

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.find method to return only one user assigned to the group
      sinon
        .stub(UserModel(tenant), "find")
        .resolves([{ _id: user1Id, group_roles: [{ group: groupId }] }]);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `Some of the provided User IDs are not assigned to this group ${groupId}`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).find, {
        _id: { $in: user_ids },
        "group_roles.group": groupId,
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).find.restore();
    });

    it("should handle the case where no users are found for update", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user_ids = ["user_id_1", "user_id_2"];

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.find and updateMany methods to return the users but no updates
      sinon.stub(UserModel(tenant), "find").resolves([
        { _id: "user_id_1", group_roles: [] },
        { _id: "user_id_2", group_roles: [] },
      ]);
      sinon.stub(UserModel(tenant), "updateMany").resolves({ nModified: 0 });

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        "No matching User found in the system"
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).find, {
        _id: { $in: user_ids },
        "group_roles.group": groupId,
      });
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).updateMany,
        {
          _id: { $in: user_ids },
          group_roles: { $elemMatch: { group: groupId } },
        },
        {
          $pull: {
            group_roles: { group: groupId },
          },
        }
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).find.restore();
      UserModel(tenant).updateMany.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";
      const user1Id = "user_id_1";
      const user2Id = "user_id_2";
      const user_ids = [user1Id, user2Id];

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.find and updateMany methods to return the users and throw an error
      sinon.stub(UserModel(tenant), "find").resolves([
        { _id: user1Id, group_roles: [{ group: groupId }] },
        { _id: user2Id, group_roles: [{ group: groupId }] },
      ]);
      sinon
        .stub(UserModel(tenant), "updateMany")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;
      requestMock.body.user_ids = user_ids;

      const response = await createGroup.unAssignManyUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant).find, {
        _id: { $in: user_ids },
        "group_roles.group": groupId,
      });
      sinon.assert.calledOnceWithExactly(
        UserModel(tenant).updateMany,
        {
          _id: { $in: user_ids },
          group_roles: { $elemMatch: { group: groupId } },
        },
        {
          $pull: {
            group_roles: { group: groupId },
          },
        }
      );

      GroupModel(tenant).findById.restore();
      UserModel(tenant).find.restore();
      UserModel(tenant).updateMany.restore();
    });
  });
  describe("listAvailableUsers()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
      };
    });

    it("should list available users for a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.aggregate method to return available users
      const availableUsers = [
        {
          _id: "user_id_1",
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          createdAt: new Date(),
          email: "john@example.com",
        },
        {
          _id: "user_id_2",
          firstName: "Jane",
          lastName: "Smith",
          userName: "janesmith",
          createdAt: new Date(),
          email: "jane@example.com",
        },
      ];
      sinon.stub(UserModel(tenant), "aggregate").resolves(availableUsers);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAvailableUsers(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        `retrieved all available users for group ${groupId}`
      );
      expect(response.data).to.deep.equal(availableUsers);

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $match: {
          "group_roles.group": { $ne: groupId },
        },
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          email: 1,
        },
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).aggregate.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";

      // Stub the GroupModel.findById method to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAvailableUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `Invalid group ID ${groupId}, please crosscheck`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);

      GroupModel(tenant).findById.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.aggregate method to throw an error
      sinon
        .stub(UserModel(tenant), "aggregate")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAvailableUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $match: {
          "group_roles.group": { $ne: groupId },
        },
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          email: 1,
        },
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).aggregate.restore();
    });
  });
  describe("listAssignedUsers()", () => {
    let requestMock;

    beforeEach(() => {
      requestMock = {
        query: {},
        params: {},
      };
    });

    it("should list assigned users for a group and return success", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.aggregate method to return assigned users
      const assignedUsers = [
        {
          _id: "user_id_1",
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          createdAt: new Date(),
          email: "john@example.com",
        },
        {
          _id: "user_id_2",
          firstName: "Jane",
          lastName: "Smith",
          userName: "janesmith",
          createdAt: new Date(),
          email: "jane@example.com",
        },
      ];
      sinon.stub(UserModel(tenant), "aggregate").resolves(assignedUsers);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAssignedUsers(requestMock);

      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        `Retrieved all assigned users for group ${groupId}`
      );
      expect(response.data).to.deep.equal(assignedUsers);

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $match: {
          "group_roles.group": groupId,
        },
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          email: 1,
        },
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).aggregate.restore();
    });

    it("should handle the case where the group does not exist", async () => {
      const tenant = "test_tenant";
      const groupId = "non_existent_group_id";

      // Stub the GroupModel.findById method to return null
      sinon.stub(GroupModel(tenant), "findById").resolves(null);

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAssignedUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.message).to.equal("Bad Request Error");
      expect(response.errors.message).to.equal(
        `Invalid group ID ${groupId}, please crosscheck`
      );

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);

      GroupModel(tenant).findById.restore();
    });

    it("should handle internal server errors gracefully", async () => {
      const tenant = "test_tenant";
      const groupId = "test_group_id";

      // Stub the GroupModel.findById method to return the group
      sinon.stub(GroupModel(tenant), "findById").resolves({ _id: groupId });

      // Stub the UserModel.aggregate method to throw an error
      sinon
        .stub(UserModel(tenant), "aggregate")
        .throws(new Error("Internal server error"));

      requestMock.query.tenant = tenant;
      requestMock.params.grp_id = groupId;

      const response = await createGroup.listAssignedUsers(requestMock);

      expect(response.success).to.equal(false);
      expect(response.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.message).to.equal("Internal Server Error");

      sinon.assert.calledOnceWithExactly(GroupModel(tenant).findById, groupId);
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $match: {
          "group_roles.group": groupId,
        },
      });
      sinon.assert.calledOnceWithExactly(UserModel(tenant), {
        $project: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          userName: 1,
          createdAt: {
            $dateToString: {
              format: "%Y-%m-%d %H:%M:%S",
              date: "$_id",
            },
          },
          email: 1,
        },
      });

      GroupModel(tenant).findById.restore();
      UserModel(tenant).aggregate.restore();
    });
  });
});
