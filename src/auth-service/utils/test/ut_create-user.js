require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const bcrypt = require("bcrypt");
// const generateFilter = require("@utils/generate-filter");
const mailer = require("@utils/mailer");
const moment = require("moment-timezone");
const { ObjectId } = require("mongoose").Types;
const createUser = require("@utils/create-user");
const mailchimp = require("@config/mailchimp");
const crypto = require("crypto");
const admin = require("firebase-admin");
// const { mockFirebaseAdmin } = require("@firebase/mocks");
const {
  lookUpFirebaseUser,
  generateSignInWithEmailLink,
  delete: deleteUser,
  sendFeedback,
  create,
  register,
  forgotPassword,
  updateForgottenPassword,
  updateKnownPassword,
  generateResetToken,
  isPasswordTokenValid,
  subscribeToNewsLetter,
  createFirebaseUser,
  loginWithFirebase,
} = createUser;
const { getAuth } = require("firebase-admin/auth");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const rewire = require("rewire");
const rewireCreateUser = rewire("@utils/create-user");
const UserModel = rewireCreateUser.__get__("UserModel");
const LogModel = rewireCreateUser.__get__("LogModel");
const AccessTokenModel = rewireCreateUser.__get__("AccessTokenModel");
const ClientModel = rewireCreateUser.__get__("ClientModel");
const NetworkModel = rewireCreateUser.__get__("NetworkModel");
const RoleModel = rewireCreateUser.__get__("RoleModel");
const accessCodeGenerator = require("generate-password");

// Mock the lookUpFirebaseUser and createFirebaseUser functions
const mockLookUpFirebaseUser = sinon.stub();
const mockCreateFirebaseUser = sinon.stub();

// Stub the UserModel methods
const mockUserModel = sinon.stub(UserModel);

describe("create-user-util", function () {
  describe("listLogs", function () {
    it("should return a list of logs", async function () {
      // Mock the request object with the necessary properties
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Stub the generateFilter.logs function to return a sample filter
      const generateFilterLogsStub = sinon
        .stub(generateFilter, "logs")
        .returns({
          success: true,
          data: {
            // Sample filter properties here
          },
        });

      // Stub the LogModel.list function to return a sample response
      const logModelListStub = sinon.stub(LogModel, "list").returns({
        success: true,
        message: "Logs retrieved successfully",
        data: [
          // Sample logs data here
        ],
      });

      // Call the listLogs function with the mocked request object
      const result = await createUser.listLogs(request);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Logs retrieved successfully");
      expect(result.data).to.be.an("array");
      // Add more specific assertions based on your sample data

      // Restore the stubbed functions
      generateFilterLogsStub.restore();
      logModelListStub.restore();
    });

    it("should handle errors from generateFilter.logs", async function () {
      // Mock the request object with the necessary properties
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Stub the generateFilter.logs function to return an error response
      const generateFilterLogsStub = sinon
        .stub(generateFilter, "logs")
        .returns({
          success: false,
          message: "Invalid filter",
          errors: {
            message: "Invalid filter",
          },
        });

      // Call the listLogs function with the mocked request object
      const result = await createUser.listLogs(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter");
      expect(result.errors).to.deep.equal({ message: "Invalid filter" });

      // Restore the stubbed function
      generateFilterLogsStub.restore();
    });

    it("should handle errors from LogModel.list", async function () {
      // Mock the request object with the necessary properties
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Stub the generateFilter.logs function to return a sample filter
      const generateFilterLogsStub = sinon
        .stub(generateFilter, "logs")
        .returns({
          success: true,
          data: {
            // Sample filter properties here
          },
        });

      // Stub the LogModel.list function to return an error response
      const logModelListStub = sinon.stub(LogModel, "list").returns({
        success: false,
        message: "Error fetching logs",
        errors: {
          message: "Error fetching logs",
        },
      });

      // Call the listLogs function with the mocked request object
      const result = await createUser.listLogs(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error fetching logs");
      expect(result.errors).to.deep.equal({ message: "Error fetching logs" });

      // Restore the stubbed functions
      generateFilterLogsStub.restore();
      logModelListStub.restore();
    });
  });
  describe("listStatistics", function () {
    it("should return statistics data", async function () {
      // Mock the tenant value
      const tenant = "example_tenant";

      // Sample statistics data
      const sampleStatisticsData = {
        // Add sample statistics data here
      };

      // Stub the UserModel.listStatistics function to return sample statistics data
      const userModelListStatisticsStub = sinon
        .stub(UserModel(tenant), "listStatistics")
        .returns({
          success: true,
          message: "Statistics retrieved successfully",
          data: sampleStatisticsData,
        });

      // Call the listStatistics function with the mocked tenant
      const result = await createUser.listStatistics(tenant);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Statistics retrieved successfully");
      expect(result.data).to.deep.equal(sampleStatisticsData);

      // Restore the stubbed function
      userModelListStatisticsStub.restore();
    });

    it("should handle errors from UserModel.listStatistics", async function () {
      // Mock the tenant value
      const tenant = "example_tenant";

      // Stub the UserModel.listStatistics function to return an error response
      const userModelListStatisticsStub = sinon
        .stub(UserModel(tenant), "listStatistics")
        .returns({
          success: false,
          message: "Error fetching statistics",
          errors: {
            message: "Error fetching statistics",
          },
        });

      // Call the listStatistics function with the mocked tenant
      const result = await createUser.listStatistics(tenant);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error fetching statistics");
      expect(result.errors).to.deep.equal({
        message: "Error fetching statistics",
      });

      // Restore the stubbed function
      userModelListStatisticsStub.restore();
    });
  });
  describe("list", function () {
    it("should return a list of users", async function () {
      // Mock the request object with query parameters
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample list of users data
      const sampleUserListData = [
        {
          // Add sample user data here
        },
        {
          // Add sample user data here
        },
        // Add more sample user data as needed
      ];

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.list function to return sample user list data
      const userModelListStub = sinon
        .stub(UserModel(request.query.tenant), "list")
        .returns({
          success: true,
          message: "Users retrieved successfully",
          data: sampleUserListData,
        });

      // Call the list function with the mocked request object
      const result = await createUser.list(request);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Users retrieved successfully");
      expect(result.data).to.deep.equal(sampleUserListData);

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelListStub.restore();
    });

    it("should handle errors from generateFilter.users function", async function () {
      // Mock the request object with query parameters
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Stub the generateFilter.users function to return an error response
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: false,
          message: "Invalid filter parameters",
          errors: {
            message: "Invalid filter parameters",
          },
        });

      // Call the list function with the mocked request object
      const result = await createUser.list(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
      expect(result.errors).to.deep.equal({
        message: "Invalid filter parameters",
      });

      // Restore the stubbed function
      generateFilterUsersStub.restore();
    });

    it("should handle errors from UserModel.list function", async function () {
      // Mock the request object with query parameters
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.list function to return an error response
      const userModelListStub = sinon
        .stub(UserModel(request.query.tenant), "list")
        .returns({
          success: false,
          message: "Error fetching users",
          errors: {
            message: "Error fetching users",
          },
        });

      // Call the list function with the mocked request object
      const result = await createUser.list(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error fetching users");
      expect(result.errors).to.deep.equal({
        message: "Error fetching users",
      });

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelListStub.restore();
    });
  });
  describe("update", function () {
    it("should update a user and send an email in development environment", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample user data
      const sampleUser = {
        // Add sample user data here
      };

      // Sample response from UserModel.find
      const sampleUserResponse = [sampleUser];

      // Sample response from UserModel.modify
      const sampleModifyResponse = {
        success: true,
        message: "User updated successfully",
        data: {
          // Add updated user data here
        },
      };

      // Sample response from mailer.update
      const sampleEmailResponse = {
        success: true,
        message: "Email sent successfully",
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return sample user data
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns(sampleUserResponse);

      // Stub the UserModel.modify function to return sample modify response
      const userModelModifyStub = sinon
        .stub(UserModel(request.query.tenant.toLowerCase()), "modify")
        .returns(sampleModifyResponse);

      // Stub the mailer.update function to return sample email response
      const mailerUpdateStub = sinon
        .stub(mailer, "update")
        .returns(sampleEmailResponse);

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User updated successfully");
      expect(result.data).to.deep.equal(sampleModifyResponse.data);

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
      userModelModifyStub.restore();
      mailerUpdateStub.restore();
    });

    it("should update a user and return response in production environment", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample user data
      const sampleUser = {
        // Add sample user data here
      };

      // Sample response from UserModel.find
      const sampleUserResponse = [sampleUser];

      // Sample response from UserModel.modify
      const sampleModifyResponse = {
        success: true,
        message: "User updated successfully",
        data: {
          // Add updated user data here
        },
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return sample user data
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns(sampleUserResponse);

      // Stub the UserModel.modify function to return sample modify response
      const userModelModifyStub = sinon
        .stub(UserModel(request.query.tenant.toLowerCase()), "modify")
        .returns(sampleModifyResponse);

      // Stub process.env.NODE_ENV to return production environment
      const processEnvStub = sinon
        .stub(process.env, "NODE_ENV")
        .value("production");

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User updated successfully");
      expect(result.data).to.deep.equal(sampleModifyResponse.data);

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
      userModelModifyStub.restore();
      processEnvStub.restore();
    });

    it("should handle errors from generateFilter.users function", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Stub the generateFilter.users function to return an error response
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: false,
          message: "Invalid filter parameters",
          errors: {
            message: "Invalid filter parameters",
          },
        });

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
      expect(result.errors).to.deep.equal({
        message: "Invalid filter parameters",
      });

      // Restore the stubbed function
      generateFilterUsersStub.restore();
    });

    it("should handle user not found error", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return an empty user list
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns([]);

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors).to.deep.equal({
        message: "the provided User does not exist in the System",
      });

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
    });

    it("should handle errors from UserModel.modify function", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample user data
      const sampleUser = {
        // Add sample user data here
      };

      // Sample response from UserModel.find
      const sampleUserResponse = [sampleUser];

      // Sample response from UserModel.modify with an error
      const sampleModifyResponseWithError = {
        success: false,
        message: "Error updating user",
        errors: {
          message: "Error updating user",
        },
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return sample user data
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns(sampleUserResponse);

      // Stub the UserModel.modify function to return an error response
      const userModelModifyStub = sinon
        .stub(UserModel(request.query.tenant.toLowerCase()), "modify")
        .returns(sampleModifyResponseWithError);

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error updating user");
      expect(result.errors).to.deep.equal({
        message: "Error updating user",
      });

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
      userModelModifyStub.restore();
    });

    it("should handle errors from mailer.update function in production environment", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample user data
      const sampleUser = {
        // Add sample user data here
      };

      // Sample response from UserModel.find
      const sampleUserResponse = [sampleUser];

      // Sample response from UserModel.modify
      const sampleModifyResponse = {
        success: true,
        message: "User updated successfully",
        data: {
          // Add updated user data here
        },
      };

      // Sample response from mailer.update with an error
      const sampleEmailResponseWithError = {
        success: false,
        message: "Error sending email",
        errors: {
          message: "Error sending email",
        },
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return sample user data
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns(sampleUserResponse);

      // Stub the UserModel.modify function to return sample modify response
      const userModelModifyStub = sinon
        .stub(UserModel(request.query.tenant.toLowerCase()), "modify")
        .returns(sampleModifyResponse);

      // Stub process.env.NODE_ENV to return production environment
      const processEnvStub = sinon
        .stub(process.env, "NODE_ENV")
        .value("production");

      // Stub the mailer.update function to return an error response
      const mailerUpdateStub = sinon
        .stub(mailer, "update")
        .returns(sampleEmailResponseWithError);

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected error response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error sending email");
      expect(result.errors).to.deep.equal({
        message: "Error sending email",
      });

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
      userModelModifyStub.restore();
      processEnvStub.restore();
      mailerUpdateStub.restore();
    });

    it("should handle errors from mailer.update function in development environment", async function () {
      // Mock the request object with query and body parameters
      const request = {
        query: {
          tenant: "example_tenant",
        },
        body: {
          // Add sample update data here
        },
      };

      // Sample filter data from the generateFilter.users function
      const sampleFilterData = {
        // Add sample filter data here
      };

      // Sample user data
      const sampleUser = {
        // Add sample user data here
      };

      // Sample response from UserModel.find
      const sampleUserResponse = [sampleUser];

      // Sample response from UserModel.modify
      const sampleModifyResponse = {
        success: true,
        message: "User updated successfully",
        data: {
          // Add updated user data here
        },
      };

      // Sample response from mailer.update with an error
      const sampleEmailResponseWithError = {
        success: false,
        message: "Error sending email",
        errors: {
          message: "Error sending email",
        },
      };

      // Stub the generateFilter.users function to return sample filter data
      const generateFilterUsersStub = sinon
        .stub(generateFilter, "users")
        .returns({
          success: true,
          data: sampleFilterData,
        });

      // Stub the UserModel.find function to return sample user data
      const userModelFindStub = sinon
        .stub(UserModel(request.query.tenant), "find")
        .returns(sampleUserResponse);

      // Stub the UserModel.modify function to return sample modify response
      const userModelModifyStub = sinon
        .stub(UserModel(request.query.tenant.toLowerCase()), "modify")
        .returns(sampleModifyResponse);

      // Stub process.env.NODE_ENV to return development environment
      const processEnvStub = sinon
        .stub(process.env, "NODE_ENV")
        .value("development");

      // Stub the mailer.update function to return an error response
      const mailerUpdateStub = sinon
        .stub(mailer, "update")
        .returns(sampleEmailResponseWithError);

      // Call the update function with the mocked request object
      const result = await createUser.update(request);

      // Assert the expected output
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User updated successfully");
      expect(result.data).to.deep.equal(sampleModifyResponse.data);

      // Restore the stubbed functions
      generateFilterUsersStub.restore();
      userModelFindStub.restore();
      userModelModifyStub.restore();
      processEnvStub.restore();
      mailerUpdateStub.restore();
    });
  });
  describe("lookUpFirebaseUser", () => {
    afterEach(() => {
      // Restore any stubbed functions after each test
      sinon.restore();
    });

    it("should fetch user data with email", async () => {
      // Mock the request object with the email parameter
      const request = {
        body: {
          email: "user@example.com",
        },
      };

      // Sample response from getAuth().getUsers with user data
      const sampleGetUsersResult = {
        users: [
          {
            uid: "user_uid_1",
            email: "user@example.com",
            displayName: "John Doe",
          },
        ],
        notFound: [],
      };

      // Stub the getAuth().getUsers function to return the sample response
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .resolves(sampleGetUsersResult);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "Successfully fetched user data"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data).to.deep.equal(
        sampleGetUsersResult.users
      );

      // Restore the stubbed function
      getUsersStub.restore();
    });

    it("should fetch user data with phone number", async () => {
      // Mock the request object with the phoneNumber parameter
      const request = {
        body: {
          phoneNumber: "+1234567890",
        },
      };

      // Sample response from getAuth().getUsers with user data
      const sampleGetUsersResult = {
        users: [
          {
            uid: "user_uid_2",
            phoneNumber: "+1234567890",
            displayName: "Jane Smith",
          },
        ],
        notFound: [],
      };

      // Stub the getAuth().getUsers function to return the sample response
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .resolves(sampleGetUsersResult);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "Successfully fetched user data"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data).to.deep.equal(
        sampleGetUsersResult.users
      );

      // Restore the stubbed function
      getUsersStub.restore();
    });

    it("should fetch user data with both email and phone number", async () => {
      // Mock the request object with both email and phoneNumber parameters
      const request = {
        body: {
          email: "user@example.com",
          phoneNumber: "+1234567890",
        },
      };

      // Sample response from getAuth().getUsers with user data
      const sampleGetUsersResult = {
        users: [
          {
            uid: "user_uid_3",
            email: "user@example.com",
            phoneNumber: "+1234567890",
            displayName: "Bob Johnson",
          },
        ],
        notFound: [],
      };

      // Stub the getAuth().getUsers function to return the sample response
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .resolves(sampleGetUsersResult);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "Successfully fetched user data"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data).to.deep.equal(
        sampleGetUsersResult.users
      );

      // Restore the stubbed function
      getUsersStub.restore();
    });

    it("should handle user not found", async () => {
      // Mock the request object with the email parameter
      const request = {
        body: {
          email: "non_existent_user@example.com",
        },
      };

      // Sample response from getAuth().getUsers with not found user
      const sampleGetUsersResult = {
        users: [],
        notFound: ["non_existent_user@example.com"],
      };

      // Stub the getAuth().getUsers function to return the sample response
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .resolves(sampleGetUsersResult);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.false;
      expect(callback.args[0][0].message).to.equal(
        "Unable to find users corresponding to these identifiers"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.NOT_FOUND);
      expect(callback.args[0][0].data).to.deep.equal(
        sampleGetUsersResult.notFound
      );

      // Restore the stubbed function
      getUsersStub.restore();
    });

    it("should handle invalid email error", async () => {
      // Mock the request object with an invalid email
      const request = {
        body: {
          email: "invalid_email",
        },
      };

      // Sample error response from getAuth().getUsers with an invalid email
      const sampleGetUsersError = {
        code: "auth/invalid-email",
      };

      // Stub the getAuth().getUsers function to throw an error
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .throws(sampleGetUsersError);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.false;
      expect(callback.args[0][0].message).to.equal("internal server error");
      expect(callback.args[0][0].status).to.equal(httpStatus.BAD_REQUEST);
      expect(callback.args[0][0].errors.message).to.equal(sampleGetUsersError);

      // Restore the stubbed function
      getUsersStub.restore();
    });

    it("should handle internal server error", async () => {
      // Mock the request object with the email parameter
      const request = {
        body: {
          email: "user@example.com",
        },
      };

      // Sample error response from getAuth().getUsers with an internal server error
      const sampleGetUsersError = new Error("Internal server error");

      // Stub the getAuth().getUsers function to throw an error
      const getUsersStub = sinon
        .stub(getAuth(), "getUsers")
        .throws(sampleGetUsersError);

      // Call the lookUpFirebaseUser function with the mocked request object
      const callback = sinon.spy();
      await lookUpFirebaseUser(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.false;
      expect(callback.args[0][0].message).to.equal("internal server error");
      expect(callback.args[0][0].status).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(callback.args[0][0].errors.message).to.equal(
        sampleGetUsersError.message
      );

      // Restore the stubbed function
      getUsersStub.restore();
    });
  });
  describe("generateSignInWithEmailLink", () => {
    afterEach(() => {
      // Restore any stubbed functions after each test
      sinon.restore();
    });

    it("should generate sign-in email link for valid email and purpose 'mobileAccountDelete'", async () => {
      // Mock the request object with the email and purpose parameters
      const request = {
        body: {
          email: "user@example.com",
        },
        query: {
          purpose: "mobileAccountDelete",
        },
      };

      // Sample link generated by getAuth().generateSignInWithEmailLink
      const sampleGeneratedLink = "https://example.com/sign-in-link";

      // Stub the getAuth().generateSignInWithEmailLink function to return the sample link
      const generateSignInWithEmailLinkStub = sinon
        .stub(getAuth(), "generateSignInWithEmailLink")
        .resolves(sampleGeneratedLink);

      // Stub the mailer.deleteMobileAccountEmail function to return a success response
      const sendEmailStub = sinon
        .stub(mailer, "deleteMobileAccountEmail")
        .resolves({
          success: true,
          message: "Email sent successfully",
        });

      // Call the generateSignInWithEmailLink function with the mocked request object
      const callback = sinon.spy();
      await generateSignInWithEmailLink(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "process successful, check your email for token"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data.link).to.equal(sampleGeneratedLink);
      expect(callback.args[0][0].data.token).to.be.a("number");
      expect(callback.args[0][0].data.email).to.equal("user@example.com");
      expect(callback.args[0][0].data.emailLinkCode).to.be.a("string");

      // Restore the stubbed functions
      generateSignInWithEmailLinkStub.restore();
      sendEmailStub.restore();
    });

    it("should generate sign-in email link for valid email and purpose 'auth'", async () => {
      // Mock the request object with the email and purpose parameters
      const request = {
        body: {
          email: "user@example.com",
        },
        query: {
          purpose: "auth",
        },
      };

      // Sample link generated by getAuth().generateSignInWithEmailLink
      const sampleGeneratedLink = "https://example.com/sign-in-link";

      // Stub the getAuth().generateSignInWithEmailLink function to return the sample link
      const generateSignInWithEmailLinkStub = sinon
        .stub(getAuth(), "generateSignInWithEmailLink")
        .resolves(sampleGeneratedLink);

      // Stub the mailer.authenticateEmail function to return a success response
      const sendEmailStub = sinon.stub(mailer, "authenticateEmail").resolves({
        success: true,
        message: "Email sent successfully",
      });

      // Call the generateSignInWithEmailLink function with the mocked request object
      const callback = sinon.spy();
      await generateSignInWithEmailLink(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "process successful, check your email for token"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data.link).to.equal(sampleGeneratedLink);
      expect(callback.args[0][0].data.token).to.be.a("number");
      expect(callback.args[0][0].data.email).to.equal("user@example.com");
      expect(callback.args[0][0].data.emailLinkCode).to.be.a("string");

      // Restore the stubbed functions
      generateSignInWithEmailLinkStub.restore();
      sendEmailStub.restore();
    });

    it("should generate sign-in email link for valid email and purpose 'login'", async () => {
      // Mock the request object with the email and purpose parameters
      const request = {
        body: {
          email: "user@example.com",
        },
        query: {
          purpose: "login",
        },
      };

      // Sample link generated by getAuth().generateSignInWithEmailLink
      const sampleGeneratedLink = "https://example.com/sign-in-link";

      // Stub the getAuth().generateSignInWithEmailLink function to return the sample link
      const generateSignInWithEmailLinkStub = sinon
        .stub(getAuth(), "generateSignInWithEmailLink")
        .resolves(sampleGeneratedLink);

      // Stub the mailer.signInWithEmailLink function to return a success response
      const sendEmailStub = sinon.stub(mailer, "signInWithEmailLink").resolves({
        success: true,
        message: "Email sent successfully",
      });

      // Call the generateSignInWithEmailLink function with the mocked request object
      const callback = sinon.spy();
      await generateSignInWithEmailLink(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.true;
      expect(callback.args[0][0].message).to.equal(
        "process successful, check your email for token"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.OK);
      expect(callback.args[0][0].data.link).to.equal(sampleGeneratedLink);
      expect(callback.args[0][0].data.token).to.be.a("number");
      expect(callback.args[0][0].data.email).to.equal("user@example.com");
      expect(callback.args[0][0].data.emailLinkCode).to.be.a("string");

      // Restore the stubbed functions
      generateSignInWithEmailLinkStub.restore();
      sendEmailStub.restore();
    });

    it("should handle invalid email error", async () => {
      // Mock the request object with an invalid email
      const request = {
        body: {
          email: "invalid_email",
        },
        query: {
          purpose: "login",
        },
      };

      // Sample error response from getAuth().generateSignInWithEmailLink with an invalid email
      const sampleGenerateSignInError = {
        code: "auth/invalid-email",
      };

      // Stub the getAuth().generateSignInWithEmailLink function to throw an error
      const generateSignInWithEmailLinkStub = sinon
        .stub(getAuth(), "generateSignInWithEmailLink")
        .throws(sampleGenerateSignInError);

      // Call the generateSignInWithEmailLink function with the mocked request object
      const callback = sinon.spy();
      await generateSignInWithEmailLink(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.false;
      expect(callback.args[0][0].message).to.equal(
        "unable to sign in using email link"
      );
      expect(callback.args[0][0].status).to.equal(httpStatus.BAD_REQUEST);
      expect(callback.args[0][0].errors.message).to.equal(
        sampleGenerateSignInError
      );

      // Restore the stubbed function
      generateSignInWithEmailLinkStub.restore();
    });

    it("should handle internal server error", async () => {
      // Mock the request object with the email and purpose parameters
      const request = {
        body: {
          email: "user@example.com",
        },
        query: {
          purpose: "login",
        },
      };

      // Sample error response from getAuth().generateSignInWithEmailLink with an internal server error
      const sampleGenerateSignInError = new Error("Internal server error");

      // Stub the getAuth().generateSignInWithEmailLink function to throw an error
      const generateSignInWithEmailLinkStub = sinon
        .stub(getAuth(), "generateSignInWithEmailLink")
        .throws(sampleGenerateSignInError);

      // Call the generateSignInWithEmailLink function with the mocked request object
      const callback = sinon.spy();
      await generateSignInWithEmailLink(request, callback);

      // Assert the expected callback calls
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0].success).to.be.false;
      expect(callback.args[0][0].message).to.equal("Internal Server Error");
      expect(callback.args[0][0].status).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(callback.args[0][0].errors.message).to.equal(
        sampleGenerateSignInError.message
      );

      // Restore the stubbed function
      generateSignInWithEmailLinkStub.restore();
    });
  });
  describe("delete", () => {
    afterEach(() => {
      // Restore any stubbed functions after each test
      sinon.restore();
    });

    it("should delete a user and update corresponding roles and networks", async () => {
      // Mock the request object with the query parameter for tenant
      const request = {
        query: {
          tenant: "sample-tenant",
        },
      };

      // Mock the response from the generateFilter.users function
      const sampleFilterResponse = {
        success: true,
        data: {
          _id: "sample-user-id",
          // other filter properties
        },
      };

      // Stub the generateFilter.users function to return the sample filter response
      const generateFilterStub = sinon
        .stub(generateFilter, "users")
        .returns(sampleFilterResponse);

      // Sample response from RoleModel.updateMany function
      const sampleUpdatedRoleResponse = { nModified: 1, err: null };

      // Stub the RoleModel.updateMany function to return the sample response
      const updatedRoleStub = sinon
        .stub(RoleModel("sample-tenant"), "updateMany")
        .resolves(sampleUpdatedRoleResponse);

      // Sample response from NetworkModel.updateMany function
      const sampleUpdatedNetworkResponse = { nModified: 1, err: null };

      // Stub the NetworkModel.updateMany function to return the sample response
      const updatedNetworkStub = sinon
        .stub(NetworkModel("sample-tenant"), "updateMany")
        .resolves(sampleUpdatedNetworkResponse);

      // Sample response from UserModel.remove function
      const sampleRemoveUserResponse = {
        success: true,
        message: "User deleted successfully",
      };

      // Stub the UserModel.remove function to return the sample response
      const removeUserStub = sinon
        .stub(UserModel("sample-tenant"), "remove")
        .resolves(sampleRemoveUserResponse);

      // Call the delete function with the mocked request object
      const result = await deleteUser(request);

      // Assert the expected results
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(updatedRoleStub.calledOnce).to.be.true;
      expect(updatedNetworkStub.calledOnce).to.be.true;
      expect(removeUserStub.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User deleted successfully");
      expect(result.status).to.equal(httpStatus.OK);

      // Restore the stubbed functions
      generateFilterStub.restore();
      updatedRoleStub.restore();
      updatedNetworkStub.restore();
      removeUserStub.restore();
    });

    it("should handle error while updating roles and networks", async () => {
      // Mock the request object with the query parameter for tenant
      const request = {
        query: {
          tenant: "sample-tenant",
        },
      };

      // Mock the response from the generateFilter.users function
      const sampleFilterResponse = {
        success: true,
        data: {
          _id: "sample-user-id",
          // other filter properties
        },
      };

      // Stub the generateFilter.users function to return the sample filter response
      const generateFilterStub = sinon
        .stub(generateFilter, "users")
        .returns(sampleFilterResponse);

      // Sample error response from RoleModel.updateMany function
      const sampleUpdatedRoleError = { nModified: 0, err: "Role update error" };

      // Stub the RoleModel.updateMany function to return the sample error response
      const updatedRoleStub = sinon
        .stub(RoleModel("sample-tenant"), "updateMany")
        .resolves(sampleUpdatedRoleError);

      // Sample error response from NetworkModel.updateMany function
      const sampleUpdatedNetworkError = {
        nModified: 0,
        err: "Network update error",
      };

      // Stub the NetworkModel.updateMany function to return the sample error response
      const updatedNetworkStub = sinon
        .stub(NetworkModel("sample-tenant"), "updateMany")
        .resolves(sampleUpdatedNetworkError);

      // Call the delete function with the mocked request object
      const result = await deleteUser(request);

      // Assert the expected results
      expect(generateFilterStub.calledOnce).to.be.true;
      expect(updatedRoleStub.calledOnce).to.be.true;
      expect(updatedNetworkStub.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Role update error");

      // Restore the stubbed functions
      generateFilterStub.restore();
      updatedRoleStub.restore();
      updatedNetworkStub.restore();
    });
  });
  describe("sendFeedback", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should send feedback email successfully", async () => {
      // Mock the request object with the required body data
      const request = {
        body: {
          email: "test@example.com",
          message: "Test message",
          subject: "Test subject",
        },
      };

      // Stub the mailer.feedback function to return a successful response
      sinon.stub(mailer, "feedback").resolves({
        success: true,
        message: "Email sent successfully",
        // Any other data you want to include in the response
      });

      // Call the sendFeedback function with the mocked request
      const response = await sendFeedback(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        status: httpStatus.OK,
        // Any other data you expect in the response
      });
    });

    it("should handle email sending error", async () => {
      // Mock the request object with the required body data
      const request = {
        body: {
          email: "test@example.com",
          message: "Test message",
          subject: "Test subject",
        },
      };

      // Stub the mailer.feedback function to return an error response
      sinon.stub(mailer, "feedback").resolves({
        success: false,
        message: "Error sending email",
        // Any other data you want to include in the response
      });

      // Call the sendFeedback function with the mocked request
      const response = await sendFeedback(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: false,
        message: "Error sending email",
        // Any other data you expect in the response
      });
    });

    it("should handle internal server error", async () => {
      // Mock the request object with the required body data
      const request = {
        body: {
          email: "test@example.com",
          message: "Test message",
          subject: "Test subject",
        },
      };

      // Stub the mailer.feedback function to throw an error
      sinon.stub(mailer, "feedback").throws(new Error("Internal server error"));

      // Call the sendFeedback function with the mocked request
      const response = await sendFeedback(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("create", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should create a new user and send verification email", async () => {
      // Mock the request object with the required data
      const request = {
        tenant: "your-tenant", // Replace with the actual tenant value
        firstName: "John",
        email: "test@example.com",
        network_id: "your-network-id", // Replace with the actual network ID value
        // Include other required properties in the request object
      };

      // Stub the UserModel's findOne method to return an empty user (user does not exist)
      sinon.stub(UserModel("your-tenant"), "findOne").resolves(null);

      // Stub the accessCodeGenerator.generate method to return a password
      sinon.stub(accessCodeGenerator, "generate").returns("test_password");

      // Stub the UserModel's register method to return a successful response
      sinon.stub(UserModel("your-tenant"), "register").resolves({
        success: true,
        data: {
          _id: "user-id", // Replace with the actual user ID value
          email: "test@example.com",
          // Include other user data you want to return in the response
        },
      });

      // Stub the ClientModel's register method to return a successful response
      sinon.stub(ClientModel("your-tenant"), "register").resolves({
        success: true,
        data: {
          _id: "client-id", // Replace with the actual client ID value
          // Include other client data you want to return in the response
        },
      });

      // Stub the AccessTokenModel's register method to return a successful response
      sinon.stub(AccessTokenModel("your-tenant"), "register").resolves({
        success: true,
        // Include other access token data you want to return in the response
      });

      // Stub the mailer.verifyEmail method to return a successful response
      sinon.stub(mailer, "verifyEmail").resolves({
        success: true,
        status: httpStatus.OK,
        // Include other data you want to include in the email response
      });

      // Call the create function with the mocked request
      const response = await create(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "An Email sent to your account please verify",
        data: {
          _id: "user-id", // Replace with the actual user ID value
          email: "test@example.com",
          // Include other user data you expect in the response
        },
        // Include other data you expect in the response
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the user already exists, email sending fails, etc.
  });
  describe("register", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should register a new user and send user creation email", async () => {
      // Mock the request object with the required data
      const request = {
        body: {
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          organization: "Test Org",
          long_organization: "Long Test Org",
          privilege: "user",
          network_id: "your-network-id", // Replace with the actual network ID value
          // Include other required properties in the request object
        },
        query: {
          tenant: "your-tenant", // Replace with the actual tenant value
        },
      };

      // Stub the accessCodeGenerator.generate method to return a password
      sinon.stub(accessCodeGenerator, "generate").returns("test_password");

      // Stub the UserModel's register method to return a successful response
      sinon.stub(UserModel("your-tenant"), "register").resolves({
        success: true,
        data: {
          _doc: {
            _id: "user-id", // Replace with the actual user ID value
            firstName: "John",
            lastName: "Doe",
            email: "test@example.com",
            // Include other user data you want to return in the response
          },
        },
      });

      // Stub the mailer.user method to return a successful response
      sinon.stub(mailer, "user").resolves({
        success: true,
        status: httpStatus.OK,
        // Include other data you want to include in the email response
      });

      // Call the register function with the mocked request
      const response = await register(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "user successfully created",
        data: {
          _id: "user-id", // Replace with the actual user ID value
          firstName: "John",
          lastName: "Doe",
          email: "test@example.com",
          // Include other user data you expect in the response
        },
        // Include other data you expect in the response
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the user registration fails, email sending fails, etc.
  });
  describe("forgotPassword", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should send a reset password email to the user", async () => {
      // Mock the request object with the required data
      const request = {
        query: {
          tenant: "your-tenant", // Replace with the actual tenant value
        },
        // Include other required properties in the request object
      };

      // Stub the generateFilter.users method to return a successful response
      sinon.stub(generateFilter, "users").returns({
        success: true,
        data: {
          // Replace with the filter data for an existing user
        },
      });

      // Stub the UserModel's exists method to return true (user exists)
      sinon.stub(UserModel("your-tenant"), "exists").resolves(true);

      // Stub the createUser.generateResetToken method to return a token
      sinon.stub(createUser, "generateResetToken").returns({
        success: true,
        data: "test_token",
      });

      // Stub the UserModel's modify method to return a successful response
      sinon.stub(UserModel("your-tenant"), "modify").resolves({
        success: true,
        // Include other data you want to include in the modify response
      });

      // Stub the mailer.forgot method to return a successful response
      sinon.stub(mailer, "forgot").resolves({
        success: true,
        status: httpStatus.OK,
        // Include other data you want to include in the email response
      });

      // Call the forgotPassword function with the mocked request
      const response = await forgotPassword(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "forgot email successfully sent",
        status: httpStatus.OK,
        // Include other data you expect in the response
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the user does not exist, when generating the reset token fails, when modifying the user fails, etc.
  });
  describe("updateForgottenPassword", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should update the user's password and send an email", async () => {
      // Mock the request object with the required data
      const request = {
        body: {
          resetPasswordToken: "test_token", // Replace with the actual resetPasswordToken value
          password: "new_password", // Replace with the new password value
        },
        query: {
          tenant: "your-tenant", // Replace with the actual tenant value
        },
      };

      // Stub moment.tz.guess() to return a timezone
      sinon.stub(moment.tz, "guess").returns("UTC");

      // Stub createUser.isPasswordTokenValid method to return a successful response
      sinon.stub(createUser, "isPasswordTokenValid").resolves({
        success: true,
        data: {
          _id: "user_id", // Replace with the actual user ID
          email: "user@example.com", // Replace with the actual user email
          firstName: "John", // Replace with the actual user's first name
          lastName: "Doe", // Replace with the actual user's last name
        },
      });

      // Stub UserModel.modify method to return a successful response
      sinon.stub(UserModel("your-tenant"), "modify").resolves({
        success: true,
        // Include other data you want to include in the modify response
      });

      // Stub mailer.updateForgottenPassword method to return a successful response
      sinon.stub(mailer, "updateForgottenPassword").resolves({
        success: true,
        // Include other data you want to include in the email response
      });

      // Call the updateForgottenPassword function with the mocked request
      const response = await updateForgottenPassword(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        // Include other data you expect in the response
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the reset password token is invalid, when modifying the user fails, when sending the email fails, etc.
  });
  describe("updateKnownPassword", () => {
    afterEach(() => {
      sinon.restore(); // Restore any stubs after each test
    });

    it("should update the user's password and send an email", async () => {
      // Mock the request object with the required data
      const request = {
        query: {
          tenant: "your-tenant", // Replace with the actual tenant value
        },
        body: {
          password: "new_password", // Replace with the new password value
          old_password: "old_password", // Replace with the old password value
        },
      };

      // Stub generateFilter.users method to return a successful response
      sinon.stub(generateFilter, "users").resolves({
        success: true,
        data: {
          // Include the filter data here
        },
      });

      // Mock the user data returned by UserModel.find method
      const mockUser = {
        _id: "user_id", // Replace with the actual user ID
        email: "user@example.com", // Replace with the actual user email
        firstName: "John", // Replace with the actual user's first name
        lastName: "Doe", // Replace with the actual user's last name
        password: "hashed_password", // Replace with the actual hashed password
      };

      // Stub UserModel.find method to return the mock user data
      sinon.stub(UserModel("your-tenant"), "find").resolves([mockUser]);

      // Stub bcrypt.compare method to return true, indicating that old_password matches the hashed password
      sinon.stub(bcrypt, "compare").resolves(true);

      // Stub UserModel.modify method to return a successful response
      sinon.stub(UserModel("your-tenant"), "modify").resolves({
        success: true,
        // Include other data you want to include in the modify response
      });

      // Stub mailer.updateKnownPassword method to return a successful response
      sinon.stub(mailer, "updateKnownPassword").resolves({
        success: true,
        // Include other data you want to include in the email response
      });

      // Call the updateKnownPassword function with the mocked request
      const response = await updateKnownPassword(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        // Include other data you expect in the response
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the old password doesn't match, when the user doesn't exist, when modifying the user fails, when sending the email fails, etc.
  });
  describe("generateResetToken", () => {
    it("should generate a reset token successfully", () => {
      // Call the generateResetToken function
      const response = generateResetToken();

      // Assert the response from the function
      expect(response).to.have.property("success", true);
      expect(response).to.have.property(
        "message",
        "token generated successfully"
      );
      expect(response).to.have.property("data").that.is.a("string");
    });

    it("should return a failure response if an error occurs", () => {
      // Stub crypto.randomBytes method to throw an error
      const error = new Error("Random bytes generation failed");
      sinon.stub(crypto, "randomBytes").throws(error);

      // Call the generateResetToken function
      const response = generateResetToken();

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property("message", "util server error");
      expect(response).to.have.property("error", error.message);
    });
  });
  describe("isPasswordTokenValid", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return valid response if password reset link is valid", async () => {
      const tenant = "airqo";
      const filter = {
        resetPasswordToken: "valid_token",
        resetPasswordExpires: Date.now() + 3600000,
      };
      const responseFromListUser = {
        success: true,
        data: [{ _id: "user_id", email: "user@example.com" }],
      };

      // Stub UserModel.list method to return a valid user response
      sinon
        .stub(UserModel(tenant.toLowerCase()), "list")
        .resolves(responseFromListUser);

      // Call the isPasswordTokenValid function
      const response = await isPasswordTokenValid({ tenant, filter });

      // Assert the response from the function
      expect(response).to.have.property("success", true);
      expect(response).to.have.property(
        "message",
        "password reset link is valid"
      );
      expect(response).to.have.property("status", httpStatus.OK);
      expect(response).to.have.property("data").that.is.an("object");
    });

    it("should return invalid response if password reset link is invalid or has expired", async () => {
      const tenant = "airqo";
      const filter = {
        resetPasswordToken: "invalid_token",
        resetPasswordExpires: Date.now() - 3600000,
      };
      const responseFromListUser = {
        success: true,
        data: [],
      };

      // Stub UserModel.list method to return an invalid user response
      sinon
        .stub(UserModel(tenant.toLowerCase()), "list")
        .resolves(responseFromListUser);

      // Call the isPasswordTokenValid function
      const response = await isPasswordTokenValid({ tenant, filter });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property(
        "message",
        "password reset link is invalid or has expired"
      );
      expect(response).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(response).to.have.property("errors").that.is.an("object");
    });

    it("should return failure response if an error occurs during database interaction", async () => {
      const tenant = "airqo";
      const filter = {
        resetPasswordToken: "valid_token",
        resetPasswordExpires: Date.now() + 3600000,
      };
      const error = new Error("Database error");

      // Stub UserModel.list method to throw an error
      sinon.stub(UserModel(tenant.toLowerCase()), "list").throws(error);

      // Call the isPasswordTokenValid function
      const response = await isPasswordTokenValid({ tenant, filter });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property("message", "Internal Server Error");
      expect(response).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response).to.have.property("errors").that.is.an("object");
    });
  });
  describe("subscribeToNewsLetter", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should successfully subscribe email to the AirQo newsletter", async () => {
      const email = "user@example.com";
      const tags = ["tag1", "tag2"];

      // Stub the Mailchimp API calls to simulate successful subscription and update of tags
      sinon.stub(mailchimp.lists, "setListMember").resolves({ tags: [] });
      sinon.stub(mailchimp.lists, "updateListMemberTags").resolves(null);

      // Call the subscribeToNewsLetter function
      const response = await subscribeToNewsLetter({ body: { email, tags } });

      // Assert the response from the function
      expect(response).to.have.property("success", true);
      expect(response).to.have.property(
        "message",
        "successfully subscribed the email address to the AirQo newsletter"
      );
      expect(response).to.have.property("status", httpStatus.OK);
    });

    it("should return failure response if there is an error during subscription", async () => {
      const email = "user@example.com";
      const tags = ["tag1", "tag2"];

      // Stub the Mailchimp API call to simulate a subscription error
      sinon
        .stub(mailchimp.lists, "setListMember")
        .throws(new Error("Mailchimp subscription error"));

      // Call the subscribeToNewsLetter function
      const response = await subscribeToNewsLetter({ body: { email, tags } });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property(
        "message",
        "unable to subscribe user to the AirQo newsletter"
      );
      expect(response).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response).to.have.nested.property(
        "errors.message",
        "Mailchimp subscription error"
      );
    });

    it("should return failure response if there is an error during updating tags", async () => {
      const email = "user@example.com";
      const tags = ["tag1", "tag2"];

      // Stub the Mailchimp API calls to simulate successful subscription but error during updating tags
      sinon.stub(mailchimp.lists, "setListMember").resolves({ tags: [] });
      sinon
        .stub(mailchimp.lists, "updateListMemberTags")
        .throws(new Error("Mailchimp update tags error"));

      // Call the subscribeToNewsLetter function
      const response = await subscribeToNewsLetter({ body: { email, tags } });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property(
        "message",
        "unable to subscribe user to the AirQo newsletter"
      );
      expect(response).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response).to.have.nested.property(
        "errors.message",
        "Mailchimp update tags error"
      );
    });
  });
  describe("deleteMobileUserData", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should successfully delete the user account and associated Firestore documents", async () => {
      const userId = "user123";
      const token = "valid-token";

      // Stub the Firebase Auth API call to simulate successful user deletion
      sinon
        .stub(admin.auth(), "getUser")
        .resolves({ metadata: { creationTime: "2023-07-01T12:34:56" } });
      sinon.stub(admin.auth(), "deleteUser").resolves();

      // Stub the Firestore API calls to simulate successful document deletions
      const deleteCollectionStub = sinon
        .stub(createUser, "deleteCollection")
        .resolves();

      // Call the deleteMobileUserData function
      const response = await createUser.deleteMobileUserData({
        params: { userId, token },
      });

      // Assert the response from the function
      expect(response).to.have.property("success", true);
      expect(response).to.have.property(
        "message",
        "User account has been deleted."
      );
      expect(response).to.have.property("status", httpStatus.OK);

      // Check if the Firestore collections were deleted correctly
      expect(deleteCollectionStub.callCount).to.equal(4);
    });

    it("should return failure response if the token is invalid", async () => {
      const userId = "user123";
      const token = "invalid-token";

      // Stub the Firebase Auth API call to simulate user retrieval
      sinon
        .stub(admin.auth(), "getUser")
        .resolves({ metadata: { creationTime: "2023-07-01T12:34:56" } });

      // Call the deleteMobileUserData function
      const response = await createUser.deleteMobileUserData({
        params: { userId, token },
      });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property("message", "Invalid token");
      expect(response).to.have.property("status", httpStatus.BAD_REQUEST);
      expect(response).to.have.nested.property(
        "errors.message",
        "Invalid token"
      );
    });

    it("should return failure response if there is an error during user deletion", async () => {
      const userId = "user123";
      const token = "valid-token";

      // Stub the Firebase Auth API call to simulate an error during user deletion
      sinon
        .stub(admin.auth(), "getUser")
        .resolves({ metadata: { creationTime: "2023-07-01T12:34:56" } });
      sinon
        .stub(admin.auth(), "deleteUser")
        .throws(new Error("Firebase Auth error"));

      // Call the deleteMobileUserData function
      const response = await createUser.deleteMobileUserData({
        params: { userId, token },
      });

      // Assert the response from the function
      expect(response).to.have.property("success", false);
      expect(response).to.have.property("message", "Error deleting user");
      expect(response).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(response).to.have.nested.property(
        "errors.message",
        "Firebase Auth error"
      );
    });
  });
  describe("createFirebaseUser", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should return error if neither email nor phoneNumber is provided", async () => {
      const request = { body: {} };
      const callback = sinon.spy();

      await createFirebaseUser(request, callback);

      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: false,
        message: "Please provide either email or phoneNumber",
        status: 400,
      });
    });

    it("should return error if password is not provided with email", async () => {
      const request = { body: { email: "test@example.com" } };
      const callback = sinon.spy();

      await createFirebaseUser(request, callback);

      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: false,
        message: "Bad Request",
        errors: { message: "password must be provided when using email" },
        status: 400,
      });
    });

    it("should create a user with email and password", async () => {
      const request = {
        body: { email: "test@example.com", password: "testpassword" },
      };
      const userRecord = { uid: "testuserid" };
      sinon.stub(getAuth(), "createUser").resolves(userRecord);

      const callback = sinon.spy();
      await createFirebaseUser(request, callback);

      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: true,
        message: "User created successfully",
        status: 201,
        data: { uid: "testuserid" },
      });
    });

    it("should create a user with phoneNumber", async () => {
      const request = { body: { phoneNumber: "+1234567890" } };
      const userRecord = { uid: "testuserid" };
      sinon.stub(getAuth(), "createUser").resolves(userRecord);

      const callback = sinon.spy();
      await createFirebaseUser(request, callback);

      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: true,
        message: "User created successfully",
        status: 201,
        data: { uid: "testuserid" },
      });
    });

    // Add more test cases as needed
  });
  describe("loginWithFirebase", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create user locally when user exists on Firebase and not locally", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
          firstName: "John",
          lastName: "Doe",
          userName: "john.doe",
          password: "testpassword",
        },
      };

      // Mock the response from lookUpFirebaseUser to indicate that user exists on Firebase
      mockLookUpFirebaseUser.callsArgWith(1, {
        success: true,
        data: [{ email: "test@example.com", phoneNumber: "+1234567890" }],
      });

      // Mock the response from UserModel to indicate that user does not exist locally
      mockUserModel.findOne.resolves(null);

      // Mock the response from UserModel.create to return the created user
      const createdUser = {
        _id: "user123",
        email: "test@example.com",
        phoneNumber: "+1234567890",
        firstName: "John",
        lastName: "Doe",
        userName: "john.doe",
        password: "testpassword",
      };
      mockUserModel.create.resolves(createdUser);

      // Mock the callback function
      const callback = sinon.spy();

      // Call the loginWithFirebase function
      await loginWithFirebase(request, callback);

      // Verify that the necessary functions were called with the correct arguments
      expect(mockLookUpFirebaseUser.calledOnce).to.be.true;
      expect(mockCreateFirebaseUser.notCalled).to.be.true;
      expect(mockUserModel.findOne.calledOnce).to.be.true;
      expect(mockUserModel.create.calledOnce).to.be.true;

      // Verify the response returned to the callback
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: true,
        message: "User created successfully.",
        status: 201,
        data: createdUser,
      });
    });

    it("should update user locally when user exists on Firebase and locally", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
          firstName: "John",
          lastName: "Doe",
          userName: "john.doe",
          password: "testpassword",
        },
      };

      // Mock the response from lookUpFirebaseUser to indicate that user exists on Firebase
      mockLookUpFirebaseUser.callsArgWith(1, {
        success: true,
        data: [{ email: "test@example.com", phoneNumber: "+1234567890" }],
      });

      // Mock the response from UserModel to indicate that user exists locally
      const existingUser = {
        _id: "user123",
        email: "test@example.com",
        phoneNumber: "+1234567890",
        firstName: "Jane", // User with the same email but different first name
        lastName: "Doe",
        userName: "jane.doe",
        password: "oldpassword",
      };
      mockUserModel.findOne.resolves(existingUser);

      // Mock the response from UserModel.updateOne to return the updated user
      const updatedUser = {
        _id: "user123",
        email: "test@example.com",
        phoneNumber: "+1234567890",
        firstName: "John",
        lastName: "Doe",
        userName: "john.doe",
        password: "testpassword",
      };
      mockUserModel.updateOne.resolves(updatedUser);

      // Mock the callback function
      const callback = sinon.spy();

      // Call the loginWithFirebase function
      await loginWithFirebase(request, callback);

      // Verify that the necessary functions were called with the correct arguments
      expect(mockLookUpFirebaseUser.calledOnce).to.be.true;
      expect(mockCreateFirebaseUser.notCalled).to.be.true;
      expect(mockUserModel.findOne.calledOnce).to.be.true;
      expect(mockUserModel.updateOne.calledOnce).to.be.true;

      // Verify the response returned to the callback
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: true,
        message: "User updated successfully.",
        status: 200,
        data: updatedUser,
      });
    });

    it("should create user on Firebase and locally when user does not exist on Firebase", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
          firstName: "John",
          lastName: "Doe",
          userName: "john.doe",
          password: "testpassword",
        },
      };

      // Mock the response from lookUpFirebaseUser to indicate that user does not exist on Firebase
      mockLookUpFirebaseUser.callsArgWith(1, {
        success: false,
      });

      // Mock the response from createFirebaseUser to return the created user on Firebase
      const firebaseCreateResponse = {
        success: true,
        data: { uid: "firebaseUser123" },
      };
      mockCreateFirebaseUser.callsArgWith(1, firebaseCreateResponse);

      // Mock the response from UserModel.create to return the created user locally
      const newUser = {
        _id: "user123",
        email: "test@example.com",
        phoneNumber: "+1234567890",
        firstName: "John",
        lastName: "Doe",
        userName: "john.doe",
        password: "testpassword",
      };
      mockUserModel.create.resolves(newUser);

      // Mock the callback function
      const callback = sinon.spy();

      // Call the loginWithFirebase function
      await loginWithFirebase(request, callback);

      // Verify that the necessary functions were called with the correct arguments
      expect(mockLookUpFirebaseUser.calledOnce).to.be.true;
      expect(mockCreateFirebaseUser.calledOnce).to.be.true;
      expect(mockUserModel.findOne.notCalled).to.be.true;
      expect(mockUserModel.create.calledOnce).to.be.true;

      // Verify the response returned to the callback
      expect(callback.calledOnce).to.be.true;
      expect(callback.args[0][0]).to.deep.equal({
        success: true,
        message: "User created successfully.",
        status: 201,
        data: newUser,
      });
    });

    // Add more test cases as needed
  });
});
