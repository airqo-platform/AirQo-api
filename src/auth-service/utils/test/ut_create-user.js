require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const bcrypt = require("bcrypt");
// const generateFilter = require("@utils/generate-filter");
const mailer = require("@utils/mailer");
const redis = require("redis");
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
const UserModel = require("@models/User");
const LogModel = require("@models/log");
const NetworkModel = require("@models/Network");
const RoleModel = require("@models/Role");
const ClientModel = require("@models/Client");
const AccessTokenModel = require("@models/AccessToken");
const accessCodeGenerator = require("generate-password");

// Mock the createUser.lookUpFirebaseUser and createUser.createFirebaseUser functions
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
  describe("lookUpFirebaseUser()", () => {
    let getAuthStub;

    beforeEach(() => {
      getAuthStub = sinon.stub().returns({
        getUsers: sinon.stub().resolves({
          users: [
            {
              uid: "user1",
              email: "test1@example.com",
              phoneNumber: "+1234567890",
            },
            {
              uid: "user2",
              email: "test2@example.com",
              phoneNumber: "+9876543210",
            },
          ],
          notFound: [],
        }),
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should fetch user data by phone number", async () => {
      const request = {
        body: {
          phoneNumber: "+1234567890",
        },
      };

      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: {
          uid: "user1",
          email: "test1@example.com",
          phoneNumber: "+1234567890",
        },
      });
    });

    it("should fetch user data by email", async () => {
      const request = {
        body: {
          email: "test2@example.com",
        },
      };

      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: {
          uid: "user2",
          email: "test2@example.com",
          phoneNumber: "+9876543210",
        },
      });
    });

    it("should fetch user data by both phone number and email", async () => {
      const request = {
        body: {
          phoneNumber: "+1234567890",
          email: "test2@example.com",
        },
      };

      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: {
          uid: "user1",
          email: "test1@example.com",
          phoneNumber: "+1234567890",
        },
      });
      expect(result[1]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: {
          uid: "user2",
          email: "test2@example.com",
          phoneNumber: "+9876543210",
        },
      });
    });

    it("should handle internal server errors", async () => {
      const request = {
        body: {
          phoneNumber: "+1234567890",
        },
      };

      getAuthStub.throws(new Error("Internal Server Error"));

      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Internal Server Error" },
      });
    });

    it("should handle not found users", async () => {
      const request = {
        body: {
          phoneNumber: "+9876543210",
        },
      };

      getAuthStub.returns({
        getUsers: sinon.stub().resolves({
          users: [],
          notFound: [{ phoneNumber: "+9876543210" }],
        }),
      });

      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Unable to find users corresponding to these identifiers",
        status: httpStatus.NOT_FOUND,
        data: { phoneNumber: "+9876543210" },
      });
    });
  });
  describe("generateSignInWithEmailLink()", () => {
    const constants = {
      ACTION_CODE_SETTINGS: "your-action-code-settings",
      EMAIL: "your-email-constant",
    };

    const sampleRequest = {
      body: {
        email: "test@example.com",
      },
      query: {
        purpose: "auth",
      },
    };

    afterEach(() => {
      // Restore the original behavior of the mocked functions and objects
      sinon.restore();
    });

    it("should generate the sign-in link with email correctly and send email for authentication", async () => {
      // Stub the getAuth function to return a mock object
      const getAuthStub = sinon.stub().returns({
        generateSignInWithEmailLink: sinon
          .stub()
          .resolves("your-generated-link"),
      });
      sinon.replace("./auth", { getAuth: getAuthStub });

      // Mock the authenticateEmail function of the mailer object
      const authenticateEmailStub = sinon.stub(mailer, "authenticateEmail");
      authenticateEmailStub.resolves({
        success: true,
      });

      const expectedResult = {
        success: true,
        message: "process successful, check your email for token",
        status: httpStatus.OK,
        data: {
          link: "your-generated-link",
          token: 100000,
          email: "test@example.com",
          emailLinkCode: "your-email-link-code",
        },
      };

      // Call the createUser.generateSignInWithEmailLink function with the sample request
      const result = await createUser.generateSignInWithEmailLink(
        sampleRequest
      );

      // Check the expected result against the actual result
      expect(result).to.deep.equal(expectedResult);

      // Ensure that the createUser.generateSignInWithEmailLink function is called with the correct arguments
      expect(
        getAuthStub().generateSignInWithEmailLink
      ).to.have.been.calledOnceWith(
        "test@example.com",
        "your-action-code-settings"
      );

      // Ensure that the authenticateEmail function is called with the correct arguments
      expect(authenticateEmailStub).to.have.been.calledOnceWith(
        "test@example.com",
        100000
      );
    });

    it("should handle errors and return an error response", async () => {
      // Stub the getAuth function to return a mock object
      const getAuthStub = sinon.stub().returns({
        generateSignInWithEmailLink: sinon
          .stub()
          .rejects(new Error("Some error")),
      });
      sinon.replace("./auth", { getAuth: getAuthStub });

      const expectedResponse = {
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: {
          message: "Some error",
        },
      };

      // Call the createUser.generateSignInWithEmailLink function with the sample request
      const result = await createUser.generateSignInWithEmailLink(
        sampleRequest
      );

      // Check the expected response against the actual result
      expect(result).to.deep.equal(expectedResponse);

      // Ensure that the createUser.generateSignInWithEmailLink function is called with the correct arguments
      expect(
        getAuthStub().generateSignInWithEmailLink
      ).to.have.been.calledOnceWith(
        "test@example.com",
        "your-action-code-settings"
      );
    });
  });
  describe("delete()", () => {
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
  describe("sendFeedback()", () => {
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
  describe("create()", function () {
    it("should return the expected response for a valid input", async function () {
      // Arrange
      const request = {
        tenant: "sample-tenant",
        firstName: "John",
        lastName: "Doe",
        email: "johndoe@example.com",
        password: "secret123",
        // Add other properties as needed for your specific test
      };

      // Stub necessary functions
      const UserModelStub = sinon.stub(UserModel, "findOne").resolves(null);
      const UserModelRegisterStub = sinon
        .stub(UserModel, "register")
        .resolves(/* Your expected response here */);
      // More stubs for other functions...

      // Act
      const result = await yourModule.create(request);

      // Assert
      expect(result).to.deep.equal(/* Your expected result here */);

      // Restore the stubs
      sinon.restore();
    });

    it("should handle the case where UserModel.findOne returns a user", async function () {
      // Arrange
      const request = {
        tenant: "sample-tenant",
        firstName: "Jane",
        lastName: "Smith",
        email: "janesmith@example.com",
        password: "password123",
        // Add other properties as needed for your specific test
      };

      // Stub UserModel.findOne to return a user
      const UserModelStub = sinon
        .stub(UserModel, "findOne")
        .resolves(/* A user object */);

      // Act
      const result = await yourModule.create(request);

      // Assert
      expect(result).to.deep.equal(/* Your expected result for this case */);

      // Restore the stubs
      sinon.restore();
    });

    it("should handle error cases gracefully", async function () {
      // Arrange
      const request = {
        tenant: "sample-tenant",
        firstName: "Alice",
        lastName: "Johnson",
        email: "alicejohnson@example.com",
        password: "password456",
        // Add other properties as needed for your specific test
      };

      // Stub necessary functions to simulate errors
      const UserModelStub = sinon
        .stub(UserModel, "findOne")
        .rejects(new Error("Some error"));

      // Act
      const result = await yourModule.create(request);

      // Assert
      expect(
        result
      ).to.deep.equal(/* Your expected result for this error case */);

      // Restore the stubs
      sinon.restore();
    });
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
  describe("createFirebaseUser()", () => {
    let getAuthStub;

    beforeEach(() => {
      getAuthStub = sinon.stub().returns({
        createUser: sinon.stub().resolves({ uid: "user1" }),
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should create user with email and password", async () => {
      const request = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "User created successfully",
        status: httpStatus.CREATED,
        data: { uid: "user1" },
      });
    });

    it("should create user with phone number", async () => {
      const request = {
        body: {
          phoneNumber: "+1234567890",
        },
      };

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "User created successfully",
        status: httpStatus.CREATED,
        data: { uid: "user1" },
      });
    });

    it("should handle missing email and phoneNumber", async () => {
      const request = {
        body: {},
      };

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.called).to.be.false;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Please provide either email or phoneNumber",
        status: httpStatus.BAD_REQUEST,
      });
    });

    it("should handle missing password when using email", async () => {
      const request = {
        body: {
          email: "test@example.com",
        },
      };

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.called).to.be.false;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Bad Request",
        errors: { message: "password must be provided when using email" },
        status: httpStatus.BAD_REQUEST,
      });
    });

    it("should handle internal server errors", async () => {
      const request = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      getAuthStub.throws(new Error("Internal Server Error"));

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Internal Server Error" },
      });
    });

    it("should handle email already exists error", async () => {
      const request = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      const error = new Error("Email already exists");
      error.code = "auth/email-already-exists";
      getAuthStub.throws(error);

      const result = await createUser.createFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: { message: "Email already exists" },
        status: httpStatus.BAD_REQUEST,
      });
    });
  });
  describe("loginWithFirebase()", () => {
    afterEach(() => {
      // Restore all Sinon fakes
      sinon.restore();
    });

    it("should successfully login with Firebase", (done) => {
      const request = {
        query: { tenant: "tenant1" },
        body: {
          email: "test@test.com",
          phoneNumber: "01-3456789",
          password: "password",
        },
      };
      const expectedResponse = { success: true, userRecord: {} };
      const lookUpFirebaseUserStub = sinon.stub().resolves(expectedResponse);
      const generateCacheIDStub = sinon.stub().returns({ success: true });
      const setCacheStub = sinon.stub().resolves({ success: true });
      const verifyMobileEmailStub = sinon.stub().resolves({ success: true });
      const logObjectStub = sinon.stub();

      // Inject your stubs
      myModuleFile.__set__(
        "createUserModule.lookUpFirebaseUser",
        lookUpFirebaseUserStub
      );
      myModuleFile.__set__(
        "createUserModule.generateCacheID",
        generateCacheIDStub
      );
      myModuleFile.__set__("createUserModule.setCache", setCacheStub);
      myModuleFile.__set__("mailer.verifyMobileEmail", verifyMobileEmailStub);
      myModuleFile.__set__("logObject", logObjectStub);

      createUser.loginWithFirebase(request, (callbackArg) => {
        expect(callbackArg).to.deep.equal({
          success: true,
          message: "An Email sent to your account, please verify",
          data: expectedResponse.userRecord,
          status: "",
        });
        // Verify if the stub methods are called
        sinon.assert.calledOnce(lookUpFirebaseUserStub);
        sinon.assert.calledOnce(setCacheStub);
        sinon.assert.calledOnce(verifyMobileEmailStub);
        done(); // required for async testing, or use async/await style
      });
    });
  });
  describe("signUpWithFirebase()", () => {
    let lookUpFirebaseUserStub;
    let createFirebaseUserStub;
    let UserModelStub;

    beforeEach(() => {
      lookUpFirebaseUserStub = sinon
        .stub()
        .resolves([{ success: true, data: [] }]);
      createFirebaseUserStub = sinon.stub().resolves([{ success: true }]);
      UserModelStub = sinon.stub().returns({
        findOne: sinon.stub().resolves(null),
        create: sinon.stub().resolves({ _id: "user1" }),
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should handle user already exists on Firebase", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
        },
        query: {
          tenant: "tenant1",
        },
      };

      lookUpFirebaseUserStub.resolves([
        { success: true, data: [{ foo: "bar" }] },
      ]);

      const result = await createUser.signUpWithFirebase(request);

      expect(lookUpFirebaseUserStub.calledOnceWith(request)).to.be.true;
      expect(createFirebaseUserStub.called).to.be.false;
      expect(UserModelStub.called).to.be.false;
      expect(result).to.deep.equal({
        success: false,
        message:
          "User already exists on Firebase. Please login using Firebase.",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message:
            "User already exists on Firebase. Please login using Firebase.",
        },
      });
    });

    it("should create user on Firebase and locally", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          password: "password123",
        },
        query: {
          tenant: "tenant1",
        },
      };

      const result = await createUser.signUpWithFirebase(request);

      expect(lookUpFirebaseUserStub.calledOnceWith(request)).to.be.true;
      expect(
        createFirebaseUserStub.calledOnceWith({
          body: {
            email: "test@example.com",
            phoneNumber: "+1234567890",
            password: "password123",
          },
        })
      ).to.be.true;

      expect(UserModelStub.calledWith("tenant1")).to.be.true;

      expect(
        UserModelStub().findOne.calledOnceWith({
          $or: [{ email: "test@example.com" }, { phoneNumber: "+1234567890" }],
        })
      ).to.be.true;

      expect(
        UserModelStub().create.calledOnceWith({
          phoneNumber: "+1234567890",
          userName: "johndoe",
          firstName: "John",
          lastName: "Doe",
          password: "generated_password",
        })
      ).to.be.true;

      expect(result).to.deep.equal({
        success: true,
        message: "User created successfully.",
        status: httpStatus.CREATED,
        data: { _id: "user1" },
      });
    });

    it("should handle internal server errors", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "+1234567890",
          firstName: "John",
          lastName: "Doe",
          userName: "johndoe",
          password: "password123",
        },
        query: {
          tenant: "tenant1",
        },
      };

      createFirebaseUserStub.throws(new Error("Internal Server Error"));

      const result = await createUser.signUpWithFirebase(request);

      expect(lookUpFirebaseUserStub.calledOnceWith(request)).to.be.true;
      expect(
        createFirebaseUserStub.calledOnceWith({
          body: {
            email: "test@example.com",
            phoneNumber: "+1234567890",
            password: "password123",
          },
        })
      ).to.be.true;

      expect(UserModelStub.calledWith("tenant1")).to.be.true;

      expect(
        UserModelStub().findOne.calledOnceWith({
          $or: [{ email: "test@example.com" }, { phoneNumber: "+1234567890" }],
        })
      ).to.be.false;

      expect(UserModelStub().create.called).to.be.false;

      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Internal Server Error" },
      });
    });
  });
  describe("generateCacheID (Success case)", () => {
    it("should return the generated cache ID when both context and tenant are provided", () => {
      const request = {
        query: {
          tenant: "example-tenant",
        },
        context: "example-context",
      };

      const result = createUser.generateCacheID(request);

      expect(result).to.equal("example-context_example-tenant");
    });
  });
  describe("generateCacheID (Error case)", () => {
    let loggerErrorStub; // The stub for the logger.error method

    beforeEach(() => {
      loggerErrorStub = sinon.stub(logger, "error"); // Assuming the logger module is already imported
    });

    afterEach(() => {
      loggerErrorStub.restore(); // Restore the original behavior of the logger
    });

    it("should handle the error case when either context or tenant is missing", () => {
      const request = {
        query: {
          tenant: "",
        },
        context: "",
      };

      const result = createUser.generateCacheID(request);

      expect(
        loggerErrorStub.calledOnceWith(
          "the request is either missing the context or the tenant"
        )
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: {
          message: "the request is either missing the context or tenant",
        },
        status: httpStatus.BAD_REQUEST,
      });
    });
  });
  describe("setCache (Success case)", () => {
    let redisStub; // The stub for the 'redis' module

    beforeEach(() => {
      redisStub = sinon.stub(redis, "set"); // Stub the 'redis.set' method
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
    });

    it("should set the cache in Redis with the correct data and cacheID", async () => {
      const testData = { key: "value" };
      const cacheID = "test-cache";

      // Stub Redis set method to return a successful result
      redisStub.resolves("OK");

      const result = await createUser.setCache(testData, cacheID);

      expect(
        redisStub.calledOnceWith(cacheID, JSON.stringify(testData), "EX", 3600)
      ).to.be.true;
      expect(result).to.equal("OK");
    });
  });
  describe("setCache (Error case)", () => {
    let redisStub; // The stub for the 'redis' module
    let loggerErrorStub; // The stub for the logger.error method

    beforeEach(() => {
      redisStub = sinon.stub(redis, "set"); // Stub the 'redis.set' method
      loggerErrorStub = sinon.stub(logger, "error"); // Assuming the logger module is already imported
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
      loggerErrorStub.restore(); // Restore the original behavior of the logger
    });

    it("should handle internal server errors and return the appropriate response", async () => {
      const testData = { key: "value" };
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";

      // Stub Redis set method to throw an error
      redisStub.rejects(new Error(errorMessage));

      const result = await createUser.setCache(testData, cacheID);

      expect(
        redisStub.calledOnceWith(cacheID, JSON.stringify(testData), "EX", 3600)
      ).to.be.true;
      expect(
        loggerErrorStub.calledOnceWith(
          `internal server error -- ${errorMessage}`
        )
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("generateNumericToken", () => {
    it("should generate a numeric token of the specified length", () => {
      const length = 6;
      const expectedToken = "123456";

      // Stub the crypto.randomBytes method to return a predetermined buffer
      const randomBytesStub = sinon
        .stub(crypto, "randomBytes")
        .returns(Buffer.from([1, 2, 3, 4, 5, 6]));

      const token = createUser.generateNumericToken(length);

      expect(token).to.equal(expectedToken);
      expect(randomBytesStub.calledOnceWithExactly(3)).to.be.true;

      randomBytesStub.restore();
    });
  });
  describe("verifyFirebaseCustomToken()", () => {
    // restore all sinon fake objects to the original methods after each test
    afterEach(() => {
      sinon.restore();
    });

    it("should handle a cache hit scenario", (done) => {
      // Setup
      const expected = { success: true };
      const cacheID = "unique-cache-id";
      const request = {
        query: { tenant: "tenant-1" },
        body: { phoneNumber: "08033000000", token: "random-token" },
      };
      // arrange
      const generateCacheIDStub = sinon.stub().returns(cacheID);
      const getCacheStub = sinon.stub().resolves({
        success: true,
        data: {
          phoneNumber: "08033000000",
          firstName: null,
          lastName: null,
          userName: null,
          displayName: null,
          email: null,
          photoURL: null,
          uid: "random-uid",
        },
      });
      const findOneStub = sinon.stub().resolves(false);
      const createStub = sinon.stub().resolves({ toAuthJSON: () => {} });
      const logObjectStub = sinon.stub();
      myModuleFile.__set__(
        "createUserModule.generateCacheID",
        generateCacheIDStub
      );
      myModuleFile.__set__("createUserModule.getCache", getCacheStub);
      myModuleFile.__set__("UserModel().findOne", findOneStub);
      myModuleFile.__set__("UserModel().create", createStub);
      myModuleFile.__set__("logObject", logObjectStub);

      // act
      createUser.verifyFirebaseCustomToken(request, (callbackArg) => {
        // assert
        expect(callbackArg).to.deep.equal({
          success: true,
          message: "Successful login!",
          status: httpStatus.CREATED,
          data: {},
        });
        sinon.assert.calledOnce(createStub);
        sinon.assert.calledOnce(generateCacheIDStub);
        sinon.assert.calledOnce(getCacheStub);
        sinon.assert.calledOnce(findOneStub);
        done();
      });
    });
  });
  describe("getCache (Success case)", () => {
    let redisStub; // The stub for the 'redis' module

    beforeEach(() => {
      redisStub = sinon.stub(redis, "get"); // Stub the 'redis.get' method
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
    });

    it("should return the cached data if it exists", async () => {
      const cacheID = "test-cache";
      const testData = { key: "value" };

      // Stub Redis get method to return the test data
      redisStub.resolves(JSON.stringify(testData));

      const result = await createUser.getCache(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(result).to.deep.equal(testData);
    });

    it("should return an error response if the cache is empty", async () => {
      const cacheID = "test-cache";

      // Stub Redis get method to return an empty result
      redisStub.resolves(null);

      const result = await createUser.getCache(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Invalid Request",
        errors: {
          message:
            "Invalid Request -- Either Token or Email provided is invalid",
        },
        status: httpStatus.BAD_REQUEST,
      });
    });
  });
  describe("getCache (Error case)", () => {
    let redisStub; // The stub for the 'redis' module
    let loggerErrorStub; // The stub for the logger.error method

    beforeEach(() => {
      redisStub = sinon.stub(redis, "get"); // Stub the 'redis.get' method
      loggerErrorStub = sinon.stub(logger, "error"); // Assuming the logger module is already imported
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
      loggerErrorStub.restore(); // Restore the original behavior of the logger
    });

    it("should handle internal server errors and return the appropriate response", async () => {
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";

      // Stub Redis get method to throw an error
      redisStub.rejects(new Error(errorMessage));

      const result = await createUser.getCache(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(
        loggerErrorStub.calledOnceWith(
          `internal server error -- ${errorMessage}`
        )
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        errors: { message: errorMessage },
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("verifyMobileEmail()", () => {
    let transporter;
    const fakeData = {
      firebase_uid: "fake_firebase_uid",
      token: "fake_token",
      email: "fake_email@mail.com",
    };

    beforeEach(() => {
      transporter = {
        sendMail: sinon.stub(),
      };

      myModuleFile.__set__("transporter", transporter);
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return success when transporter.sendMail works correctly", async function () {
      transporter.sendMail.returns(
        Promise.resolve({
          accepted: ["fake_email@mail.com"],
          rejected: [],
        })
      );

      const result = await createUser.verifyMobileEmail(fakeData);

      expect(result).to.be.deep.equal({
        success: true,
        message: "email successfully sent",
        data: {
          accepted: ["fake_email@mail.com"],
          rejected: [],
        },
        status: httpStatus.OK,
      });
      sinon.assert.calledOnce(transporter.sendMail);
    });

    it("should return failure when transporter.sendMail rejects emails", async function () {
      transporter.sendMail.returns(
        Promise.resolve({
          accepted: [],
          rejected: ["fake_email@mail.com"],
        })
      );

      const result = awaitcreateUser.verifyMobileEmail(fakeData);

      expect(result).to.be.deep.equal({
        success: false,
        message: "email not sent",
        errors: {
          message: {
            accepted: [],
            rejected: ["fake_email@mail.com"],
          },
        },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      sinon.assert.calledOnce(transporter.sendMail);
    });

    it("should return failure when transporter.sendMail throws an error", async function () {
      const errorMsg = "sendMail error";
      transporter.sendMail.throws(new Error(errorMsg));

      const result = awaitcreateUser.verifyMobileEmail(fakeData);

      expect(result).to.be.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMsg },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      sinon.assert.calledOnce(transporter.sendMail);
    });
  });
  describe("generateNumericToken()", () => {
    it("should generate a numeric token of the specified length", () => {
      const length = 6;
      const result = createUser.generateNumericToken(length);

      expect(result).to.be.a("string");
      expect(result).to.have.lengthOf(length);
      expect(result).to.match(/^\d+$/);
    });

    it("should generate a different token each time", () => {
      const length = 6;
      const result1 = createUser.generateNumericToken(length);
      const result2 = createUser.generateNumericToken(length);

      expect(result1).to.not.equal(result2);
    });
  });
  describe("deleteCachedItem (Success case)", () => {
    let redisStub; // The stub for the 'redis' module

    beforeEach(() => {
      redisStub = sinon.stub(redis, "del"); // Stub the 'redis.del' method
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
    });

    it("should delete the cached item and return the success response", async () => {
      const cacheID = "test-cache";
      const numberOfDeletedKeys = 1;

      // Stub Redis del method to return the number of deleted keys
      redisStub.resolves(numberOfDeletedKeys);

      const result = await createUser.deleteCachedItem(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        data: { numberOfDeletedKeys },
        message: "successfully deleted the cached item",
        status: httpStatus.OK,
      });
    });
  });
  describe("deleteCachedItem (Error case)", () => {
    let redisStub; // The stub for the 'redis' module
    let loggerErrorStub; // The stub for the logger.error method

    beforeEach(() => {
      redisStub = sinon.stub(redis, "del"); // Stub the 'redis.del' method
      loggerErrorStub = sinon.stub(logger, "error"); // Assuming the logger module is already imported
    });

    afterEach(() => {
      redisStub.restore(); // Restore the original behavior of the stubbed method
      loggerErrorStub.restore(); // Restore the original behavior of the logger
    });

    it("should handle internal server errors and return the appropriate response", async () => {
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";

      // Stub Redis del method to throw an error
      redisStub.rejects(new Error(errorMessage));

      const result = await createUser.deleteCachedItem(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(
        loggerErrorStub.calledOnceWith(
          `Internal Server Error -- ${JSON.stringify(error)}`
        )
      ).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: JSON.stringify(error) },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("verifyFirebaseCustomToken", () => {
    let logTextStub;
    let logObjectStub;
    let generateCacheIDStub;
    let getCacheStub;
    let deleteCachedItemStub;
    let UserModelCreateStub;
    let UserModelUpdateOneStub;

    beforeEach(() => {
      logTextStub = sinon.stub(console, "log");
      logObjectStub = sinon.stub(console, "log");
      generateCacheIDStub = sinon.stub(createUserModule, "generateCacheID");
      getCacheStub = sinon.stub(createUserModule, "getCache");
      deleteCachedItemStub = sinon.stub(createUserModule, "deleteCachedItem");
      UserModelCreateStub = sinon.stub(UserModel, "create");
      UserModelUpdateOneStub = sinon.stub(UserModel, "updateOne");
    });

    afterEach(() => {
      logTextStub.restore();
      logObjectStub.restore();
      generateCacheIDStub.restore();
      getCacheStub.restore();
      deleteCachedItemStub.restore();
      UserModelCreateStub.restore();
      UserModelUpdateOneStub.restore();
    });

    // 1. Test case for when the cache ID generation fails
    it("should return an error response when cache ID generation fails", async () => {
      generateCacheIDStub.throws(new Error("Cache ID generation failed"));

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(result).toEqual({
        success: false,
        message: "Cache ID generation failed",
      });
    });

    // 2. Test case for when the cache retrieval fails
    it("should return an error response when cache retrieval fails", async () => {
      // Arrange
      getCacheStub.throws(new Error("Cache retrieval failed"));

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(result).toEqual({
        success: false,
        message: "Cache retrieval failed",
      });
    });

    // 3. Test case for when the cache retrieval returns a falsy value
    it("should return an error response when cache retrieval returns falsy value", async () => {
      getCacheStub.returns(null);

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(result).toEqual({
        success: false,
        message: "Cache retrieval returned falsy value",
      });
    });

    // 4. Test case for when the cached token is invalid
    it("should return an error response when the cached token is invalid", async () => {
      const invalidToken = "invalid_token";
      getCacheStub.returns(invalidToken);

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(result).toEqual({
        success: false,
        message: "Invalid token",
      });
    });

    // 5. Test case for when the user exists locally
    it("should update the user and return the expected success response", async () => {
      const validToken = "valid_token";
      getCacheStub.returns(validToken);
      UserModelUpdateOneStub.resolves({ nModified: 1 });

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(UserModelUpdateOneStub.calledOnceWith({ token: validToken })).toBe(
        true
      );
      expect(result).toEqual({
        success: true,
        message: "User updated successfully",
      });
    });

    // 6. Test case for when the user does not exist locally
    it("should create a new user and return the expected success response", async () => {
      const validToken = "valid_token";
      getCacheStub.returns(validToken);
      UserModelCreateStub.resolves({ _id: "new_user_id" });

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(UserModelCreateStub.calledOnceWith({ token: validToken })).toBe(
        true
      );
      expect(result).toEqual({
        success: true,
        message: "New user created successfully",
      });
    });

    // 7. Test case for when deleting the cached item fails after updating an existing user
    it("should return an error response when deleting the cached item fails after updating an existing user", async () => {
      const validToken = "valid_token";
      getCacheStub.returns(validToken);
      UserModelUpdateOneStub.resolves({ nModified: 1 });
      deleteCachedItemStub.throws(new Error("Failed to delete cached item"));

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(UserModelUpdateOneStub.calledOnceWith({ token: validToken })).toBe(
        true
      );
      expect(deleteCachedItemStub.calledOnceWith(validToken)).toBe(true);
      expect(result).toEqual({
        success: false,
        message: "Failed to delete cached item",
      });
    });

    // 8. Test case for when deleting the cached item fails after creating a new user
    it("should return an error response when deleting the cached item fails after creating a new user", async () => {
      const validToken = "valid_token";
      getCacheStub.returns(validToken);
      UserModelCreateStub.resolves({ _id: "new_user_id" });
      deleteCachedItemStub.throws(new Error("Failed to delete cached item"));

      // Act
      const result = await verifyFirebaseCustomToken();

      // Assert
      expect(UserModelCreateStub.calledOnceWith({ token: validToken })).toBe(
        true
      );
      expect(deleteCachedItemStub.calledOnceWith(validToken)).toBe(true);
      expect(result).toEqual({
        success: false,
        message: "Failed to delete cached item",
      });
    });
  });
});
