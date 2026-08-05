require("module-alias/register");
// Provide dummy values for env vars that throw on missing config at require-time.
process.env.CLOUD_NAME = process.env.CLOUD_NAME || "test";
process.env.CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY || "test";
process.env.CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET || "test";
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const bcrypt = require("bcrypt");
const { mailer, generateFilter } = require("@utils/common");
const { stringify } = require("@utils/shared");
const redis = require("redis");
const moment = require("moment-timezone");
const { ObjectId } = require("mongoose").Types;
const createUser = require("@utils/user.util");
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
const firebaseAuthModule = require("firebase-admin/auth");
const { getAuth } = firebaseAuthModule;
const constants = require("@config/constants");
const httpStatus = require("http-status");
const rewire = require("rewire");
const rewireCreateUser = rewire("@utils/user.util");
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

describe("create-user-util", function () {
  describe("listLogs", function () {
    let origLogModel;
    let logListStub;

    beforeEach(function () {
      logListStub = sinon.stub();
      origLogModel = rewireCreateUser.__get__("LogModel");
      rewireCreateUser.__set__("LogModel", () => ({ list: logListStub }));
    });

    afterEach(function () {
      rewireCreateUser.__set__("LogModel", origLogModel);
      sinon.restore();
    });

    it("should return a list of logs", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      sinon.stub(generateFilter, "logs").returns({});
      logListStub.resolves({
        success: true,
        message: "Logs retrieved successfully",
        data: [],
      });

      const result = await rewireCreateUser.listLogs(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Logs retrieved successfully");
      expect(result.data).to.be.an("array");
    });

    it("should handle errors from generateFilter.logs", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };
      const next = sinon.stub();

      sinon.stub(generateFilter, "logs").returns({});
      logListStub.resolves({
        success: false,
        message: "Invalid filter",
        errors: { message: "Invalid filter" },
      });

      await rewireCreateUser.listLogs(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Internal Server Error");
    });

    it("should handle errors from LogModel.list", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };
      const next = sinon.stub();

      sinon.stub(generateFilter, "logs").returns({});
      logListStub.resolves({
        success: false,
        message: "Error fetching logs",
        errors: { message: "Error fetching logs" },
      });

      await rewireCreateUser.listLogs(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Internal Server Error");
    });
  });
  describe("listStatistics", function () {
    let origUserModel;
    let listStatisticsStub;

    beforeEach(function () {
      listStatisticsStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        listStatistics: listStatisticsStub,
      }));
    });

    afterEach(function () {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should return statistics data", async function () {
      const tenant = "example_tenant";
      const sampleStatisticsData = { totalUsers: 10 };

      listStatisticsStub.resolves({
        success: true,
        message: "Statistics retrieved successfully",
        data: sampleStatisticsData,
      });

      const result = await rewireCreateUser.listStatistics(tenant);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Statistics retrieved successfully");
      expect(result.data).to.deep.equal(sampleStatisticsData);
    });

    it("should handle errors from UserModel.listStatistics", async function () {
      const tenant = "example_tenant";
      const next = sinon.stub();

      listStatisticsStub.rejects(new Error("Error fetching statistics"));

      await rewireCreateUser.listStatistics(tenant, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Internal Server Error");
    });
  });
  describe("list", function () {
    let origUserModel;
    let listStub;

    beforeEach(function () {
      listStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({ list: listStub }));
    });

    afterEach(function () {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should return a list of users", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };
      const sampleUserListData = [{ email: "a@example.com" }];

      sinon.stub(generateFilter, "users").returns({});
      listStub.resolves({
        success: true,
        message: "Users retrieved successfully",
        data: sampleUserListData,
      });

      const result = await rewireCreateUser.list(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Users retrieved successfully");
      expect(result.data).to.have.lengthOf(1);
      expect(result.data[0]).to.include({ email: "a@example.com" });
    });

    it("should handle errors from generateFilter.users function", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      sinon.stub(generateFilter, "users").returns({});
      listStub.resolves({
        success: false,
        message: "Invalid filter parameters",
        errors: { message: "Invalid filter parameters" },
      });

      const result = await rewireCreateUser.list(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
      expect(result.errors).to.deep.equal({
        message: "Invalid filter parameters",
      });
    });

    it("should handle errors from UserModel.list function", async function () {
      const request = {
        query: {
          tenant: "example_tenant",
          limit: 10,
          skip: 0,
        },
      };

      sinon.stub(generateFilter, "users").returns({});
      listStub.resolves({
        success: false,
        message: "Error fetching users",
        errors: { message: "Error fetching users" },
      });

      const result = await rewireCreateUser.list(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error fetching users");
      expect(result.errors).to.deep.equal({
        message: "Error fetching users",
      });
    });
  });
  describe("update", function () {
    let origUserModel;
    let mockModel;
    let mockFactory;

    beforeEach(function () {
      mockModel = {
        findOne: sinon.stub(),
        modify: sinon.stub(),
      };
      mockFactory = sinon.stub().returns(mockModel);
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", mockFactory);
    });

    afterEach(function () {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should return error when body has no updatable fields", async function () {
      const request = {
        query: { tenant: "example_tenant" },
        body: {},
      };
      const result = await rewireCreateUser.update(request);
      expect(result.success).to.be.false;
      expect(result.message).to.equal("No updatable fields provided");
    });

    it("should update a user and return success when body has updatable fields", async function () {
      const request = {
        query: { tenant: "example_tenant" },
        body: { jobTitle: "Engineer" },
      };
      const fakeUser = { _id: "uid1", email: "u@example.com", consent: {} };
      const modifyResponse = {
        success: true,
        message: "User updated successfully",
        data: { jobTitle: "Engineer" },
      };
      mockModel.findOne.returns({
        select: () => ({ lean: () => Promise.resolve(fakeUser) }),
      });
      mockModel.modify.resolves(modifyResponse);
      sinon.stub(generateFilter, "users").returns({ _id: "uid1" });

      const result = await rewireCreateUser.update(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("User updated successfully");
    });

    it("should return user not found when user does not exist", async function () {
      const request = {
        query: { tenant: "example_tenant" },
        body: { jobTitle: "Engineer" },
      };
      mockModel.findOne.returns({
        select: () => ({ lean: () => Promise.resolve(null) }),
      });
      sinon.stub(generateFilter, "users").returns({ _id: "uid1" });

      const result = await rewireCreateUser.update(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("User not found");
    });

    it("should return modify error when modify fails", async function () {
      const request = {
        query: { tenant: "example_tenant" },
        body: { jobTitle: "Engineer" },
      };
      const fakeUser = { _id: "uid1", email: "u@example.com", consent: {} };
      const modifyError = {
        success: false,
        message: "Error updating user",
        errors: { message: "Error updating user" },
      };
      mockModel.findOne.returns({
        select: () => ({ lean: () => Promise.resolve(fakeUser) }),
      });
      mockModel.modify.resolves(modifyError);
      sinon.stub(generateFilter, "users").returns({ _id: "uid1" });

      const result = await rewireCreateUser.update(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Error updating user");
    });

  });
  describe("lookUpFirebaseUser()", () => {
    let getAuthStub;

    beforeEach(() => {
      getAuthStub = sinon.stub(firebaseAuthModule, "getAuth");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should fetch user data by phone number", async () => {
      getAuthStub.returns({
        getUsers: sinon.stub().resolves({
          users: [{ uid: "user1", email: "test1@example.com", phoneNumber: "+1234567890" }],
          notFound: [],
        }),
      });

      const request = { body: { phoneNumber: "+1234567890" } };
      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: { uid: "user1", email: "test1@example.com", phoneNumber: "+1234567890" },
      });
    });

    it("should fetch user data by email", async () => {
      getAuthStub.returns({
        getUsers: sinon.stub().resolves({
          users: [{ uid: "user2", email: "test2@example.com", phoneNumber: "+9876543210" }],
          notFound: [],
        }),
      });

      const request = { body: { email: "test2@example.com" } };
      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(1);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: { uid: "user2", email: "test2@example.com", phoneNumber: "+9876543210" },
      });
    });

    it("should fetch user data by both phone number and email", async () => {
      getAuthStub.returns({
        getUsers: sinon.stub().resolves({
          users: [
            { uid: "user1", email: "test1@example.com", phoneNumber: "+1234567890" },
            { uid: "user2", email: "test2@example.com", phoneNumber: "+9876543210" },
          ],
          notFound: [],
        }),
      });

      const request = { body: { phoneNumber: "+1234567890", email: "test2@example.com" } };
      const result = await createUser.lookUpFirebaseUser(request);

      expect(getAuthStub.calledOnce).to.be.true;
      expect(result).to.be.an("array");
      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: { uid: "user1", email: "test1@example.com", phoneNumber: "+1234567890" },
      });
      expect(result[1]).to.deep.equal({
        success: true,
        message: "Successfully fetched user data",
        status: httpStatus.OK,
        data: [],
        userRecord: { uid: "user2", email: "test2@example.com", phoneNumber: "+9876543210" },
      });
    });

    it("should handle internal server errors", async () => {
      getAuthStub.throws(new Error("Internal Server Error"));

      const request = { body: { phoneNumber: "+1234567890" } };
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
      getAuthStub.returns({
        getUsers: sinon.stub().resolves({
          users: [],
          notFound: [{ phoneNumber: "+9876543210" }],
        }),
      });

      const request = { body: { phoneNumber: "+9876543210" } };
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
    const sampleRequest = {
      body: {
        email: "test@example.com",
      },
      query: {
        purpose: "auth",
      },
    };
    let origGenerateNumericToken;

    beforeEach(() => {
      origGenerateNumericToken = rewireCreateUser.__get__(
        "generateNumericToken"
      );
      rewireCreateUser.__set__(
        "generateNumericToken",
        sinon.stub().returns("54321")
      );
    });

    afterEach(() => {
      rewireCreateUser.__set__(
        "generateNumericToken",
        origGenerateNumericToken
      );
      sinon.restore();
    });

    it("should generate the sign-in link with email correctly and send email for authentication", async () => {
      const generateSignInWithEmailLinkStub = sinon
        .stub()
        .resolves("https://example.com/?a=1%26oobCode%3DSAMPLECODE");
      sinon.stub(firebaseAuthModule, "getAuth").returns({
        generateSignInWithEmailLink: generateSignInWithEmailLinkStub,
      });

      const authenticateEmailStub = sinon
        .stub(mailer, "authenticateEmail")
        .resolves({ success: true });

      const result = await rewireCreateUser.generateSignInWithEmailLink(
        sampleRequest
      );

      expect(result).to.deep.equal({
        success: true,
        message: "process successful, check your email for token",
        status: httpStatus.OK,
        data: {
          link: "https://example.com/?a=1%26oobCode%3DSAMPLECODE",
          token: "54321",
          email: "test@example.com",
          emailLinkCode: "SAMPLECODE",
        },
      });

      sinon.assert.calledOnce(generateSignInWithEmailLinkStub);
      sinon.assert.calledOnceWithMatch(authenticateEmailStub, {
        email: "test@example.com",
        token: "54321",
      });
    });

    it("should handle errors and return an error response", async () => {
      sinon.stub(firebaseAuthModule, "getAuth").returns({
        generateSignInWithEmailLink: sinon
          .stub()
          .rejects(new Error("Some error")),
      });
      const next = sinon.stub();

      await rewireCreateUser.generateSignInWithEmailLink(
        sampleRequest,
        next
      );

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(err.message).to.equal("Internal Server Error");
    });
  });
  describe("delete()", () => {
    let origCascadeUserDeletion;
    let origUserModel;
    let cascadeStub;
    let removeStub;

    beforeEach(() => {
      cascadeStub = sinon.stub();
      removeStub = sinon.stub();
      origCascadeUserDeletion = rewireCreateUser.__get__(
        "cascadeUserDeletion"
      );
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("cascadeUserDeletion", cascadeStub);
      rewireCreateUser.__set__("UserModel", () => ({ remove: removeStub }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("cascadeUserDeletion", origCascadeUserDeletion);
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should delete a user and update corresponding roles and networks", async () => {
      const request = {
        query: {
          tenant: "sample-tenant",
        },
      };

      const generateFilterStub = sinon
        .stub(generateFilter, "users")
        .returns({ _id: "sample-user-id" });

      cascadeStub.resolves({
        success: true,
        message: "Successfully Cascaded the User deletion",
        status: httpStatus.OK,
      });

      removeStub.resolves({
        success: true,
        message: "User deleted successfully",
        status: httpStatus.OK,
      });

      const result = await rewireCreateUser.delete(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(cascadeStub.calledOnceWith({
        userId: "sample-user-id",
        tenant: "sample-tenant",
      })).to.be.true;
      expect(removeStub.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User deleted successfully");
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle error while updating roles and networks", async () => {
      const request = {
        query: {
          tenant: "sample-tenant",
        },
      };

      const generateFilterStub = sinon
        .stub(generateFilter, "users")
        .returns({ _id: "sample-user-id" });

      cascadeStub.resolves({
        success: false,
        message: "Internal Server Error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
        errors: { message: "Role update error" },
      });

      const result = await rewireCreateUser.delete(request);

      expect(generateFilterStub.calledOnce).to.be.true;
      expect(cascadeStub.calledOnce).to.be.true;
      expect(removeStub.called).to.be.false;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Role update error");
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
      });
      sinon
        .stub(mailer, "feedbackConfirmation")
        .resolves({ success: true, message: "Confirmation sent" });

      // Call the sendFeedback function with the mocked request
      const response = await sendFeedback(request);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        status: httpStatus.OK,
      });
      expect(mailer.feedbackConfirmation.calledOnce).to.be.true;
    });

    it("should still return success when confirmation email fails", async () => {
      const request = {
        body: {
          email: "test@example.com",
          message: "Test message",
          subject: "Test subject",
        },
      };

      sinon.stub(mailer, "feedback").resolves({
        success: true,
        message: "Email sent successfully",
      });
      sinon
        .stub(mailer, "feedbackConfirmation")
        .rejects(new Error("SMTP error"));

      const response = await sendFeedback(request);

      expect(response).to.deep.equal({
        success: true,
        message: "email successfully sent",
        status: httpStatus.OK,
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
      const next = sinon.stub();

      // Call the sendFeedback function with the mocked request
      await sendFeedback(request, next);

      // Assert that next was called with the expected HttpError
      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.message).to.equal("Internal Server Error");
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("submitFeedback()", () => {
    let feedbackRegisterStub;
    let origFeedbackModel;

    beforeEach(() => {
      feedbackRegisterStub = sinon.stub().resolves({
        success: true,
        data: { _id: "fb123" },
      });
      // Inject a fake FeedbackModel into the rewired module so FeedbackModel(tenant).register
      // is properly intercepted — sinon cannot stub a bare exported function directly.
      origFeedbackModel = rewireCreateUser.__get__("FeedbackModel");
      rewireCreateUser.__set__("FeedbackModel", () => ({
        register: feedbackRegisterStub,
      }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("FeedbackModel", origFeedbackModel);
      sinon.restore();
    });

    it("should dispatch confirmation email to submitter on success", async () => {
      sinon.stub(mailer, "feedback").resolves({ success: true });
      const confirmStub = sinon
        .stub(mailer, "feedbackConfirmation")
        .resolves({ success: true });

      const request = {
        body: {
          email: "user@example.com",
          subject: "App bug",
          message: "The map crashes on load",
        },
        query: {},
        user: null,
      };

      await rewireCreateUser.submitFeedback(request, (err) => {
        throw err;
      });

      expect(confirmStub.calledOnce).to.be.true;
      expect(confirmStub.firstCall.args[0]).to.deep.include({
        email: "user@example.com",
        subject: "App bug",
      });
    });

    it("should return success even when confirmation email throws", async () => {
      sinon.stub(mailer, "feedback").resolves({ success: true });
      sinon
        .stub(mailer, "feedbackConfirmation")
        .rejects(new Error("SMTP timeout"));

      const request = {
        body: {
          email: "user@example.com",
          subject: "App bug",
          message: "The map crashes on load",
        },
        query: {},
        user: null,
      };

      const response = await rewireCreateUser.submitFeedback(request, (err) => {
        throw err;
      });

      expect(response.success).to.equal(true);
    });

    it("should return success even when confirmation email returns failure", async () => {
      sinon.stub(mailer, "feedback").resolves({ success: true });
      sinon
        .stub(mailer, "feedbackConfirmation")
        .resolves({ success: false, message: "Rate limited" });

      const request = {
        body: {
          email: "user@example.com",
          subject: "App bug",
          message: "The map crashes on load",
        },
        query: {},
        user: null,
      };

      const response = await rewireCreateUser.submitFeedback(request, (err) => {
        throw err;
      });

      expect(response.success).to.equal(true);
    });
  });

  describe("create()", function () {
    // create() calls the module-level dbRateLimiter() before touching
    // UserModel, and dbRateLimiter writes to EmailLogModel via mongoose.
    // With no live DB connection in this test suite that write would hang
    // (or take up to mongoose's buffering timeout) before failing open, so
    // dbRateLimiter is stubbed directly via rewire in every test here.
    let origUserModel;
    let origDbRateLimiter;
    let findOneStub;
    let dbRateLimiterStub;

    beforeEach(function () {
      findOneStub = sinon
        .stub()
        .returns({ lean: () => Promise.resolve(null) });
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({ findOne: findOneStub }));

      dbRateLimiterStub = sinon
        .stub()
        .resolves({ allowed: true, remainingMs: 0 });
      origDbRateLimiter = rewireCreateUser.__get__("dbRateLimiter");
      rewireCreateUser.__set__("dbRateLimiter", dbRateLimiterStub);
    });

    afterEach(function () {
      rewireCreateUser.__set__("UserModel", origUserModel);
      rewireCreateUser.__set__("dbRateLimiter", origDbRateLimiter);
      sinon.restore();
    });

    it("should return a 400 error when email is missing", async function () {
      const request = { body: {}, query: {} };
      const next = sinon.stub();

      const result = await rewireCreateUser.create(request, next);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Email is required");
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      sinon.assert.notCalled(dbRateLimiterStub);
    });

    it("should return a conflict response when a registration is already in progress", async function () {
      dbRateLimiterStub.resolves({ allowed: false, remainingMs: 5000 });
      const request = {
        body: { email: "jane@example.com", tenant: "sample-tenant" },
        query: {},
      };
      const next = sinon.stub();

      const result = await rewireCreateUser.create(request, next);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.CONFLICT);
      expect(result.message).to.equal(
        "Registration already in progress for this email"
      );
      sinon.assert.notCalled(findOneStub);
    });

    it("should return a conflict response when a verified account already exists", async function () {
      findOneStub.returns({
        lean: () =>
          Promise.resolve({ email: "jane@example.com", verified: true }),
      });
      const request = {
        body: { email: "jane@example.com", tenant: "sample-tenant" },
        query: {},
      };
      const next = sinon.stub();

      const result = await rewireCreateUser.create(request, next);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.CONFLICT);
      expect(result.data).to.include({
        accountExists: true,
        verified: true,
      });
    });
  });
  describe("register", () => {
    let origUserModel;
    let origDbRateLimiter;
    let findOneStub;
    let leanStub;
    let registerStub;
    let dbRateLimiterStub;

    beforeEach(() => {
      leanStub = sinon.stub().resolves(null);
      findOneStub = sinon.stub().returns({ lean: leanStub });
      registerStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        findOne: findOneStub,
        register: registerStub,
      }));

      // register() awaits the module-level dbRateLimiter() before ever
      // touching UserModel. Without a live DB, the real implementation's
      // EmailLogModel write would hang/time out before failing open, so
      // it's stubbed directly here (same rationale as in the create() block).
      dbRateLimiterStub = sinon
        .stub()
        .resolves({ allowed: true, remainingMs: 0 });
      origDbRateLimiter = rewireCreateUser.__get__("dbRateLimiter");
      rewireCreateUser.__set__("dbRateLimiter", dbRateLimiterStub);
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
      rewireCreateUser.__set__("dbRateLimiter", origDbRateLimiter);
      sinon.restore();
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
        headers: { dnt: "1" },
      };

      // Stub the accessCodeGenerator.generate method to return a password
      sinon.stub(accessCodeGenerator, "generate").returns("test_password");

      // Stub the UserModel's register method to return a successful response
      registerStub.resolves({
        success: true,
        data: {
          _id: "user-id",
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
      const response = await rewireCreateUser.register(request);

      // Assert the response from the function
      expect(response).to.have.property("success", true);
      expect(response.data).to.have.property("user");
      expect(response.data.user).to.include({
        _id: "user-id",
        firstName: "John",
        lastName: "Doe",
        email: "test@example.com",
      });
    });

    // Add more test cases to cover other scenarios
    // For example, when the user registration fails, email sending fails, etc.
  });
  describe("forgotPassword", () => {
    let origUserModel;
    let existsStub;
    let modifyStub;
    let internalModule;

    beforeEach(() => {
      existsStub = sinon.stub();
      modifyStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        exists: existsStub,
        modify: modifyStub,
      }));
      // forgotPassword() calls createUserModule.generateResetToken()
      // internally (a reference to the module-scope createUserModule
      // object), not the copy of generateResetToken re-exported on
      // module.exports — so it must be stubbed on that internal object,
      // not on rewireCreateUser/createUser directly.
      internalModule = rewireCreateUser.__get__("createUserModule");
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should send a reset password email to the user", async () => {
      // Mock the request object with the required data
      const request = {
        body: {},
        query: {
          tenant: "your-tenant",
        },
      };
      const next = sinon.stub();

      // Stub the generateFilter.users method to return a successful response
      sinon.stub(generateFilter, "users").returns({
        email: "user@example.com",
      });

      // Stub the UserModel's exists method to return true (user exists)
      existsStub.resolves(true);

      // Stub the internal createUserModule.generateResetToken method to
      // return a token (see the note above on why rewireCreateUser itself
      // cannot be stubbed for this call).
      sinon.stub(internalModule, "generateResetToken").returns({
        success: true,
        data: "test_token",
      });

      // Stub the UserModel's modify method to return a successful response
      modifyStub.resolves({
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
      const response = await rewireCreateUser.forgotPassword(request, next);

      // Assert the response from the function
      expect(response).to.deep.equal({
        success: true,
        message: "forgot email successfully sent",
        status: httpStatus.OK,
        // Include other data you expect in the response
      });
      sinon.assert.notCalled(next);
    });

    it("should call next with a 400 error and not invoke modify or mailer when user does not exist", async () => {
      const request = {
        body: {},
        query: { tenant: "your-tenant" },
      };
      const next = sinon.spy();

      sinon.stub(generateFilter, "users").returns({ email: "unknown@example.com" });
      existsStub.resolves(false);
      sinon.stub(mailer, "forgot").resolves({});

      await rewireCreateUser.forgotPassword(request, next);

      sinon.assert.calledOnce(next);
      const errorArg = next.firstCall.args[0];
      expect(errorArg).to.be.instanceOf(Error);
      expect(errorArg.statusCode).to.equal(httpStatus.BAD_REQUEST);
      sinon.assert.notCalled(modifyStub);
    });

    // Add more test cases to cover other scenarios
    // For example, when generating the reset token fails, when modifying the user fails, etc.
  });
  describe("updateForgottenPassword", () => {
    let origUserModel;
    let findOneAndUpdateStub;

    beforeEach(() => {
      findOneAndUpdateStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        findOneAndUpdate: findOneAndUpdateStub,
      }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should update the user's password and send an email", async () => {
      const request = {
        body: {
          resetPasswordToken: "test_token",
          password: "newPass1",
        },
        query: { tenant: "your-tenant" },
      };
      const next = sinon.stub();

      sinon.stub(moment.tz, "guess").returns("UTC");

      const mockUser = {
        _id: "user_id",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        toJSON: () => ({ _id: "user_id", email: "user@example.com" }),
      };

      findOneAndUpdateStub.resolves(mockUser);

      sinon.stub(mailer, "updateForgottenPassword").resolves({ success: true });

      const response = await rewireCreateUser.updateForgottenPassword(
        request,
        next
      );

      expect(response).to.have.property("success", true);
      expect(response).to.have.property("status", httpStatus.OK);
      sinon.assert.notCalled(next);
    });

    // Add more test cases to cover other scenarios
    // For example, when the reset password token is invalid, when modifying the user fails, when sending the email fails, etc.
  });
  describe("updateKnownPassword", () => {
    let origUserModel;
    let findByIdStub;
    let findByIdAndUpdateStub;

    beforeEach(() => {
      findByIdStub = sinon.stub();
      findByIdAndUpdateStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        findById: findByIdStub,
        findByIdAndUpdate: findByIdAndUpdateStub,
      }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should update the user's password and send an email", async () => {
      const request = {
        query: { tenant: "your-tenant" },
        body: {
          password: "newPass1",
          old_password: "oldPass1",
        },
        user: { _id: "user_id" },
      };
      const next = sinon.stub();

      const mockUser = {
        _id: "user_id",
        email: "user@example.com",
        firstName: "John",
        lastName: "Doe",
        password: "hashed_password",
        authenticateUser: sinon.stub().resolves(true),
      };

      findByIdStub.resolves(mockUser);
      findByIdAndUpdateStub.resolves(mockUser);
      sinon.stub(mailer, "updateKnownPassword").resolves({ success: true });

      const response = await rewireCreateUser.updateKnownPassword(
        request,
        next
      );

      expect(response).to.have.property("success", true);
      sinon.assert.notCalled(next);
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
      expect(response).to.have.property("message", "Internal Server Error");
      expect(response).to.have.property("status", httpStatus.INTERNAL_SERVER_ERROR);
      expect(response.errors).to.deep.equal({ message: error.message });
    });
  });
  describe("isPasswordTokenValid", () => {
    let origUserModel;
    let listStub;

    beforeEach(() => {
      listStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({ list: listStub }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
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
      listStub.resolves(responseFromListUser);

      // Call the isPasswordTokenValid function
      const response = await rewireCreateUser.isPasswordTokenValid({
        tenant,
        filter,
      });

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
      const next = sinon.stub();

      listStub.resolves({ success: true, data: [] });

      await rewireCreateUser.isPasswordTokenValid({ tenant, filter }, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return failure response if an error occurs during database interaction", async () => {
      const tenant = "airqo";
      const filter = {
        resetPasswordToken: "valid_token",
        resetPasswordExpires: Date.now() + 3600000,
      };
      const next = sinon.stub();
      const error = new Error("Database error");

      listStub.throws(error);

      await rewireCreateUser.isPasswordTokenValid({ tenant, filter }, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
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
      const next = sinon.stub();

      sinon
        .stub(mailchimp.lists, "setListMember")
        .throws(new Error("Mailchimp subscription error"));

      await subscribeToNewsLetter({ body: { email, tags } }, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return failure response if there is an error during updating tags", async () => {
      const email = "user@example.com";
      const tags = ["tag1", "tag2"];
      const next = sinon.stub();

      sinon.stub(mailchimp.lists, "setListMember").resolves({ tags: [] });
      sinon
        .stub(mailchimp.lists, "updateListMemberTags")
        .throws(new Error("Mailchimp update tags error"));

      await subscribeToNewsLetter({ body: { email, tags } }, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should send ADDRESS as a structured object when all components are provided", async () => {
      const setListMemberStub = sinon
        .stub(mailchimp.lists, "setListMember")
        .resolves({ tags: [] });
      sinon.stub(mailchimp.lists, "updateListMemberTags").resolves(null);

      await subscribeToNewsLetter({
        body: {
          email: "user@example.com",
          tags: ["tag1"],
          firstName: "Jane",
          lastName: "Doe",
          address: "123 Main St",
          city: "Kampala",
          state: "Central",
          zipCode: "00256",
        },
      });

      const callArgs = setListMemberStub.firstCall.args[2];
      expect(callArgs.merge_fields).to.have.property("ADDRESS").that.deep.equals({
        addr1: "123 Main St",
        city: "Kampala",
        state: "Central",
        zip: "00256",
      });
    });

    it("should omit ADDRESS from merge_fields when any address component is missing", async () => {
      const setListMemberStub = sinon
        .stub(mailchimp.lists, "setListMember")
        .resolves({ tags: [] });
      sinon.stub(mailchimp.lists, "updateListMemberTags").resolves(null);

      // city is absent — ADDRESS must be omitted
      await subscribeToNewsLetter({
        body: {
          email: "user@example.com",
          tags: ["tag1"],
          address: "123 Main St",
          state: "Central",
          zipCode: "00256",
        },
      });

      const callArgs = setListMemberStub.firstCall.args[2];
      expect(callArgs.merge_fields).to.not.have.property("ADDRESS");
    });
  });
  describe("deleteMobileUserData", () => {
    let origAdmin;

    beforeEach(() => {
      origAdmin = rewireCreateUser.__get__("admin");
    });

    afterEach(() => {
      rewireCreateUser.__set__("admin", origAdmin);
      sinon.restore();
    });

    // Skipped: requires a live Firestore instance — Firestore collection deletion
    // hangs in unit tests without proper Firebase emulator setup.
    it.skip("should successfully delete the user account and associated Firestore documents", async () => {});

    it("should return failure response if the token is invalid", async () => {
      const userId = "user123";
      const token = "invalid-token";
      const next = sinon.stub();

      rewireCreateUser.__set__("admin", {
        auth: () => ({
          getUser: sinon
            .stub()
            .resolves({ metadata: { creationTime: "2023-07-01T12:34:56" } }),
        }),
      });

      await rewireCreateUser.deleteMobileUserData(
        { params: { userId, token } },
        next
      );

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should return failure response if there is an error during user deletion", async () => {
      const userId = "user123";
      const creationTime = "2023-07-01T12:34:56";
      const creationTimeDigits = creationTime.replace(/\D/g, "");
      const token = require("crypto")
        .createHash("sha256")
        .update(`${userId}+${creationTimeDigits}`)
        .digest("hex");
      const next = sinon.stub();

      rewireCreateUser.__set__("admin", {
        auth: () => ({
          getUser: sinon.stub().resolves({ metadata: { creationTime } }),
        }),
      });

      // The source calls firebaseAuth.getAuth().deleteUser — stub that path
      const firebaseAuthMod = require("firebase-admin/auth");
      sinon.stub(firebaseAuthMod, "getAuth").returns({
        deleteUser: sinon.stub().throws(new Error("Firebase Auth error")),
      });

      await rewireCreateUser.deleteMobileUserData(
        { params: { userId, token } },
        next
      );

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
    });
  });
  describe("createFirebaseUser()", () => {
    const firebaseAuth = require("firebase-admin/auth");
    let getAuthStub;
    let createUserStub;

    beforeEach(() => {
      createUserStub = sinon.stub().resolves({ uid: "user1" });
      getAuthStub = sinon.stub(firebaseAuth, "getAuth").returns({
        createUser: createUserStub,
      });
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should create user with email and password", async () => {
      const next = sinon.stub();
      const request = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      const result = await createUser.createFirebaseUser(request, next);

      expect(getAuthStub.calledOnce).to.be.true;
      sinon.assert.notCalled(next);
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
      const next = sinon.stub();
      const request = {
        body: {
          phoneNumber: "+1234567890",
        },
      };

      const result = await createUser.createFirebaseUser(request, next);

      expect(getAuthStub.calledOnce).to.be.true;
      sinon.assert.notCalled(next);
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
      const next = sinon.stub();
      const request = { body: {} };

      await createUser.createFirebaseUser(request, next);

      sinon.assert.calledOnce(next);
      expect(getAuthStub.called).to.be.false;
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle missing password when using email", async () => {
      const next = sinon.stub();
      const request = {
        body: { email: "test@example.com" },
      };

      await createUser.createFirebaseUser(request, next);

      sinon.assert.calledOnce(next);
      expect(getAuthStub.called).to.be.false;
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });

    it("should handle internal server errors", async () => {
      const next = sinon.stub();
      const request = {
        body: {
          email: "test@example.com",
          password: "password123",
        },
      };

      getAuthStub.throws(new Error("Internal Server Error"));

      await createUser.createFirebaseUser(request, next);

      expect(getAuthStub.calledOnce).to.be.true;
      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
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
      const next = sinon.stub();

      await createUser.createFirebaseUser(request, next);

      expect(getAuthStub.calledOnce).to.be.true;
      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });
  });
  describe("loginWithFirebase()", () => {
    let internalModule;

    beforeEach(() => {
      internalModule = rewireCreateUser.__get__("createUserModule");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully login with Firebase", async () => {
      const request = {
        query: { tenant: "tenant1" },
        body: {
          email: "test@test.com",
          phoneNumber: "01-3456789",
          password: "password",
        },
      };
      const firebaseUser = { uid: "uid1", email: "test@test.com" };

      sinon.stub(internalModule, "lookUpFirebaseUser").resolves([
        { success: true, userRecord: firebaseUser },
      ]);
      sinon
        .stub(internalModule, "setMobileUserCache")
        .resolves({ success: true });
      sinon.stub(mailer, "verifyMobileEmail").resolves({ success: true });

      const result = await rewireCreateUser.loginWithFirebase(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "An Email sent to your account, please verify"
      );
      expect(result.data).to.deep.equal(firebaseUser);
      sinon.assert.calledOnce(internalModule.lookUpFirebaseUser);
      sinon.assert.calledOnce(internalModule.setMobileUserCache);
      sinon.assert.calledOnce(mailer.verifyMobileEmail);
    });
  });
  describe("signUpWithFirebase()", () => {
    let origUserModel;
    let findOneStub;
    let createStub;
    let internalModule;

    beforeEach(() => {
      internalModule = rewireCreateUser.__get__("createUserModule");
      findOneStub = sinon.stub().resolves(null);
      createStub = sinon.stub().resolves({ _id: "user1" });
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        findOne: findOneStub,
        create: createStub,
      }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
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
      const next = sinon.stub();

      sinon.stub(internalModule, "lookUpFirebaseUser").resolves([
        { success: true, data: [{ foo: "bar" }] },
      ]);

      await rewireCreateUser.signUpWithFirebase(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
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
      const next = sinon.stub();

      sinon.stub(internalModule, "lookUpFirebaseUser").resolves([
        { success: true, data: [] },
      ]);
      sinon.stub(internalModule, "createFirebaseUser").resolves([
        { success: true },
      ]);

      const result = await rewireCreateUser.signUpWithFirebase(request, next);

      sinon.assert.notCalled(next);
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User created successfully.");
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.data).to.deep.equal({ _id: "user1" });
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
      const next = sinon.stub();

      sinon.stub(internalModule, "lookUpFirebaseUser").resolves([
        { success: true, data: [] },
      ]);
      sinon
        .stub(internalModule, "createFirebaseUser")
        .throws(new Error("Internal Server Error"));

      await rewireCreateUser.signUpWithFirebase(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
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

      const result = createUser.generateMobileUserCacheID(request);

      expect(result).to.equal("example-context_example-tenant");
    });
  });
  describe("generateCacheID (Error case)", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should handle the error case when either context or tenant is missing", () => {
      const request = {
        query: {
          tenant: "",
        },
        context: "",
      };

      // generateMobileUserCacheID calls undefined `next` when context/tenant missing → throws
      expect(() => createUser.generateMobileUserCacheID(request)).to.throw();
    });
  });
  describe("setMobileUserCache (Success case)", () => {
    let origRedisSetWithTTLAsync;

    beforeEach(() => {
      origRedisSetWithTTLAsync = rewireCreateUser.__get__(
        "redisSetWithTTLAsync"
      );
    });

    afterEach(() => {
      rewireCreateUser.__set__(
        "redisSetWithTTLAsync",
        origRedisSetWithTTLAsync
      );
      sinon.restore();
    });

    it("should set the cache in Redis with the correct data and cacheID", async () => {
      const testData = { key: "value" };
      const cacheID = "test-cache";
      const redisStub = sinon.stub().resolves("OK");
      rewireCreateUser.__set__("redisSetWithTTLAsync", redisStub);

      const result = await rewireCreateUser.setMobileUserCache({
        data: testData,
        cacheID,
      });

      expect(
        redisStub.calledOnceWith(cacheID, stringify(testData), 3600)
      ).to.be.true;
      expect(result).to.equal("OK");
    });
  });
  describe("setMobileUserCache (Error case)", () => {
    let origRedisSetWithTTLAsync;

    beforeEach(() => {
      origRedisSetWithTTLAsync = rewireCreateUser.__get__(
        "redisSetWithTTLAsync"
      );
    });

    afterEach(() => {
      rewireCreateUser.__set__(
        "redisSetWithTTLAsync",
        origRedisSetWithTTLAsync
      );
      sinon.restore();
    });

    it("should handle internal server errors and return the appropriate response", async () => {
      const testData = { key: "value" };
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";
      const next = sinon.stub();

      const redisStub = sinon.stub().rejects(new Error(errorMessage));
      rewireCreateUser.__set__("redisSetWithTTLAsync", redisStub);

      await rewireCreateUser.setMobileUserCache({ data: testData, cacheID }, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
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
  describe("verifyFirebaseCustomToken() - cache hit", () => {
    let origCreateUserModule;
    let origUserModel;
    let mockInternalModule;

    beforeEach(() => {
      origCreateUserModule = rewireCreateUser.__get__("createUserModule");
      origUserModel = rewireCreateUser.__get__("UserModel");
    });

    afterEach(() => {
      rewireCreateUser.__set__("createUserModule", origCreateUserModule);
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should handle a cache hit scenario", async () => {
      const cacheID = "unique-cache-id";
      const request = {
        query: { tenant: "tenant-1" },
        body: { phoneNumber: "08033000000", token: "random-token" },
      };
      const cachedUser = {
        phoneNumber: "08033000000",
        token: "random-token",
        uid: "random-uid",
        email: "test@test.com",
      };
      const createStub = sinon.stub().resolves({ toAuthJSON: () => ({}) });
      const findOneStub = sinon.stub().returns({ exec: sinon.stub().resolves(null) });
      const deleteCachedStub = sinon.stub().resolves({ success: true });

      mockInternalModule = {
        generateMobileUserCacheID: sinon.stub().returns(cacheID),
        getMobileUserCache: sinon.stub().resolves(cachedUser),
        deleteCachedItem: deleteCachedStub,
      };
      rewireCreateUser.__set__("createUserModule", mockInternalModule);
      rewireCreateUser.__set__("UserModel", () => ({
        findOne: findOneStub,
        create: createStub,
      }));

      const next = sinon.stub();
      const result = await rewireCreateUser.verifyFirebaseCustomToken(
        request,
        next
      );

      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Successful login!");
      sinon.assert.calledOnce(createStub);
      sinon.assert.calledOnce(mockInternalModule.getMobileUserCache);
      sinon.assert.calledOnce(deleteCachedStub);
    });
  });
  describe("getMobileUserCache (Success case)", () => {
    let origRedisGetAsync;

    beforeEach(() => {
      origRedisGetAsync = rewireCreateUser.__get__("redisGetAsync");
    });

    afterEach(() => {
      rewireCreateUser.__set__("redisGetAsync", origRedisGetAsync);
      sinon.restore();
    });

    it("should return the cached data if it exists", async () => {
      const cacheID = "test-cache";
      const testData = { key: "value" };
      const next = sinon.stub();

      const redisStub = sinon.stub().resolves(stringify(testData));
      rewireCreateUser.__set__("redisGetAsync", redisStub);

      const result = await rewireCreateUser.getMobileUserCache(cacheID, next);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(result).to.deep.equal(testData);
      sinon.assert.notCalled(next);
    });

    it("should call next with error if the cache is empty", async () => {
      const cacheID = "test-cache";
      const next = sinon.stub();

      const redisStub = sinon.stub().resolves(null);
      rewireCreateUser.__set__("redisGetAsync", redisStub);

      await rewireCreateUser.getMobileUserCache(cacheID, next);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.BAD_REQUEST);
    });
  });
  describe("getMobileUserCache (Error case)", () => {
    let origRedisGetAsync;

    beforeEach(() => {
      origRedisGetAsync = rewireCreateUser.__get__("redisGetAsync");
    });

    afterEach(() => {
      rewireCreateUser.__set__("redisGetAsync", origRedisGetAsync);
      sinon.restore();
    });

    it("should handle internal server errors and call next with error", async () => {
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";
      const next = sinon.stub();

      const redisStub = sinon.stub().rejects(new Error(errorMessage));
      rewireCreateUser.__set__("redisGetAsync", redisStub);

      await rewireCreateUser.getMobileUserCache(cacheID, next);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("verifyMobileEmail()", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return failure when email or token is missing", async function () {
      const result = await createUser.verifyMobileEmail({ body: {}, query: {}, params: {} });

      expect(result).to.have.property("success", false);
      expect(result.message).to.equal("Email and verification code are required");
    });

    it("should return failure when token format is invalid", async function () {
      const result = await createUser.verifyMobileEmail({
        body: { email: "fake_email@mail.com", token: "fake_token" },
        query: {},
        params: {},
      });

      expect(result).to.have.property("success", false);
      expect(result.message).to.equal("Invalid verification code format");
    });

    it("should return failure when both email and token are missing", async function () {
      const result = await createUser.verifyMobileEmail({
        body: { email: "a@b.com" },
        query: {},
        params: {},
      });

      expect(result).to.have.property("success", false);
      expect(result.errors).to.have.property("token");
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
    let origRedisDelAsync;

    beforeEach(() => {
      origRedisDelAsync = rewireCreateUser.__get__("redisDelAsync");
    });

    afterEach(() => {
      rewireCreateUser.__set__("redisDelAsync", origRedisDelAsync);
      sinon.restore();
    });

    it("should delete the cached item and return the success response", async () => {
      const cacheID = "test-cache";
      const numberOfDeletedKeys = 1;

      const redisStub = sinon.stub().resolves(numberOfDeletedKeys);
      rewireCreateUser.__set__("redisDelAsync", redisStub);

      const result = await rewireCreateUser.deleteCachedItem(cacheID);

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
    let origRedisDelAsync;

    beforeEach(() => {
      origRedisDelAsync = rewireCreateUser.__get__("redisDelAsync");
    });

    afterEach(() => {
      rewireCreateUser.__set__("redisDelAsync", origRedisDelAsync);
      sinon.restore();
    });

    it("should handle internal server errors and return the appropriate response", async () => {
      const cacheID = "test-cache";
      const errorMessage = "Something went wrong";

      const redisStub = sinon.stub().rejects(new Error(errorMessage));
      rewireCreateUser.__set__("redisDelAsync", redisStub);

      const result = await rewireCreateUser.deleteCachedItem(cacheID);

      expect(redisStub.calledOnceWith(cacheID)).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: errorMessage },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("verifyFirebaseCustomToken", () => {
    let origCreateUserModule;
    let origUserModel;
    let mockInternalModule;
    let mockUserModel;
    let mockUserModelFactory;
    let nextStub;

    const baseRequest = {
      query: { tenant: "airqo" },
      body: { email: "test@example.com", token: "valid_token" },
    };

    beforeEach(() => {
      nextStub = sinon.stub();
      mockUserModel = {
        findOne: sinon.stub().returns({ exec: sinon.stub().resolves(null) }),
        updateOne: sinon.stub().resolves({ nModified: 1 }),
        create: sinon.stub().resolves({ toAuthJSON: () => ({ email: "test@example.com" }) }),
      };
      mockUserModelFactory = sinon.stub().returns(mockUserModel);
      mockInternalModule = {
        generateMobileUserCacheID: sinon.stub().returns("test@example.com_airqo"),
        getMobileUserCache: sinon.stub().resolves({
          email: "test@example.com",
          token: "valid_token",
          firstName: "John",
          lastName: "Doe",
        }),
        deleteCachedItem: sinon.stub().resolves({ success: true }),
      };
      origCreateUserModule = rewireCreateUser.__get__("createUserModule");
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("createUserModule", mockInternalModule);
      rewireCreateUser.__set__("UserModel", mockUserModelFactory);
    });

    afterEach(() => {
      rewireCreateUser.__set__("createUserModule", origCreateUserModule);
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should call next with error when cache returns no data", async () => {
      mockInternalModule.getMobileUserCache.resolves(null);

      await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(nextStub.calledOnce).to.be.true;
    });

    it("should return cached failure response when cache returns success=false", async () => {
      const failureData = { success: false, message: "cache expired" };
      mockInternalModule.getMobileUserCache.resolves(failureData);

      const result = await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(result).to.deep.equal(failureData);
    });

    it("should call next with error when token does not match", async () => {
      mockInternalModule.getMobileUserCache.resolves({
        email: "test@example.com",
        token: "different_token",
      });
      const request = {
        query: { tenant: "airqo" },
        body: { email: "test@example.com", token: "valid_token" },
      };

      await rewireCreateUser.verifyFirebaseCustomToken(request, nextStub);

      expect(nextStub.calledOnce).to.be.true;
    });

    it("should update existing user and delete cache on successful login", async () => {
      const existingUser = {
        _id: "existing_user_id",
        email: "test@example.com",
        toAuthJSON: () => ({ email: "test@example.com" }),
      };
      mockUserModel.findOne.returns({ exec: sinon.stub().resolves(existingUser) });

      const result = await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(mockInternalModule.deleteCachedItem.calledOnce).to.be.true;
      expect(result).to.have.property("success", true);
      expect(result).to.have.property("message", "Successful login!");
    });

    it("should create new user and delete cache when user does not exist locally", async () => {
      mockUserModel.findOne.returns({ exec: sinon.stub().resolves(null) });

      const result = await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(mockUserModel.create.calledOnce).to.be.true;
      expect(mockInternalModule.deleteCachedItem.calledOnce).to.be.true;
      expect(result).to.have.property("success", true);
    });

    it("should call next with error when internal cache operation fails", async () => {
      mockInternalModule.getMobileUserCache.rejects(new Error("Redis error"));

      await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(nextStub.calledOnce).to.be.true;
    });

    it("should call next with error when delete cache fails after updating user", async () => {
      const existingUser = {
        _id: "existing_user_id",
        email: "test@example.com",
        toAuthJSON: () => ({ email: "test@example.com" }),
      };
      mockUserModel.findOne.returns({ exec: sinon.stub().resolves(existingUser) });
      mockInternalModule.deleteCachedItem.resolves({ success: false });

      await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(nextStub.calledOnce).to.be.true;
    });

    it("should call next with error when email and phoneNumber are missing from firebase user", async () => {
      mockInternalModule.getMobileUserCache.resolves({
        token: "valid_token",
        firstName: "John",
      });

      await rewireCreateUser.verifyFirebaseCustomToken(baseRequest, nextStub);

      expect(nextStub.calledOnce).to.be.true;
    });
  });

  describe("syncAnalyticsAndMobile", () => {
    let origUserModel;
    let findOneStub;
    let registerStub;
    let modifyStub;
    let listStub;

    beforeEach(() => {
      findOneStub = sinon.stub();
      registerStub = sinon.stub();
      modifyStub = sinon.stub();
      listStub = sinon.stub();
      origUserModel = rewireCreateUser.__get__("UserModel");
      rewireCreateUser.__set__("UserModel", () => ({
        findOne: findOneStub,
        register: registerStub,
        modify: modifyStub,
        list: listStub,
      }));
    });

    afterEach(() => {
      rewireCreateUser.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should create a new user when the user does not exist locally", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "1234567890",
          firebase_uid: "firebase_uid",
          firstName: "John",
          lastName: "Doe",
        },
        query: { tenant: "test_tenant" },
      };
      const userData = {
        email: "test@example.com",
        phoneNumber: "1234567890",
        firebase_uid: "firebase_uid",
        firstName: "John",
        lastName: "Doe",
      };

      findOneStub.resolves(null);
      registerStub.resolves({ success: true, data: userData });
      sinon.stub(mailer, "user").resolves({ success: true });

      const result = await rewireCreateUser.syncAnalyticsAndMobile(request);

      expect(result).to.deep.equal({
        success: true,
        message: "User created successfully.",
        status: httpStatus.CREATED,
        user: userData,
        syncOperation: "Created",
      });
    });

    it("should update the user when the user exists locally", async () => {
      const request = {
        body: {
          email: "test@example.com",
          phoneNumber: "1234567890",
          firebase_uid: "firebase_uid",
          firstName: "John",
          lastName: "Doe",
        },
        query: { tenant: "test_tenant" },
      };
      const existingUser = {
        _id: "user_id",
        phoneNumber: "9876543210",
        firstName: "Alice",
        lastName: "Smith",
      };
      const updatedUserData = {
        email: "test@example.com",
        phoneNumber: "1234567890",
        firstName: "John",
        lastName: "Doe",
      };

      findOneStub.resolves(existingUser);
      modifyStub.resolves({ success: true });
      listStub.resolves({ success: true, data: updatedUserData });

      const result = await rewireCreateUser.syncAnalyticsAndMobile(request);

      expect(result.success).to.be.true;
      expect(result.syncOperation).to.equal("Updated");
      expect(result.user).to.deep.equal(updatedUserData);
    });
  });

  describe("_constructLoginUpdate", function () {
    const user = { verified: true, preferredTokenStrategy: null };

    it("sets lastActiveAt to a recent Date so the active-status-job does not immediately deactivate the user", function () {
      const before = Date.now();
      const result = createUser._constructLoginUpdate(user);
      const after = Date.now();

      expect(result.$set.lastActiveAt).to.be.an.instanceOf(Date);
      expect(result.$set.lastActiveAt.getTime()).to.be.within(before, after);
    });

    it("sets lastLogin and isActive on every login", function () {
      const before = Date.now();
      const result = createUser._constructLoginUpdate(user);
      const after = Date.now();

      expect(result.$set.lastLogin).to.be.an.instanceOf(Date);
      expect(result.$set.lastLogin.getTime()).to.be.within(before, after);
      expect(result.$set.isActive).to.equal(true);
      expect(result.$inc.loginCount).to.equal(1);
    });

    it("sets verified when autoVerify is true and user is not yet verified", function () {
      const unverifiedUser = { verified: false, preferredTokenStrategy: null };
      const result = createUser._constructLoginUpdate(unverifiedUser, null, {
        autoVerify: true,
      });
      expect(result.$set.verified).to.equal(true);
    });

    it("does not set verified when autoVerify is false", function () {
      const result = createUser._constructLoginUpdate(user, null, {
        autoVerify: false,
      });
      expect(result.$set.verified).to.be.undefined;
    });

    it("stamps hasSetPassword when stampHasSetPassword is true and flag not already set", function () {
      const legacy = { verified: true, preferredTokenStrategy: null, hasSetPassword: false };
      const result = createUser._constructLoginUpdate(legacy, null, {
        stampHasSetPassword: true,
      });
      expect(result.$set.hasSetPassword).to.equal(true);
    });

    it("does not stamp hasSetPassword when stampHasSetPassword is false (OAuth/JWT callers)", function () {
      const oauthUser = { verified: true, preferredTokenStrategy: null, hasSetPassword: false };
      const result = createUser._constructLoginUpdate(oauthUser, null, {
        stampHasSetPassword: false,
      });
      expect(result.$set.hasSetPassword).to.be.undefined;
    });

    it("does not stamp hasSetPassword when already true", function () {
      const alreadyStamped = { verified: true, preferredTokenStrategy: null, hasSetPassword: true };
      const result = createUser._constructLoginUpdate(alreadyStamped, null, {
        stampHasSetPassword: true,
      });
      expect(result.$set.hasSetPassword).to.be.undefined;
    });
  });
});

// ── buildAuthMethods ─────────────────────────────────────────────────────────

describe("buildAuthMethods()", () => {
  const { buildAuthMethods } = require("@utils/user.util");

  it("returns password:true for an email/password-only account with hasSetPassword:true", () => {
    const user = { password: "hashed", hasSetPassword: true };
    const result = buildAuthMethods(user);
    expect(result.password).to.equal(true);
    expect(result.google).to.equal(false);
  });

  it("returns password:false for an OAuth-only account with system-generated password", () => {
    const user = {
      password: "generated-random-hash",
      hasSetPassword: false,
      google_id: "google-123",
    };
    const result = buildAuthMethods(user);
    expect(result.password).to.equal(false);
    expect(result.google).to.equal(true);
  });

  it("returns password:true for an OAuth account that later used setPassword", () => {
    const user = {
      password: "user-chosen-hash",
      hasSetPassword: true,
      google_id: "google-123",
      github_id: "gh-456",
    };
    const result = buildAuthMethods(user);
    expect(result.password).to.equal(true);
    expect(result.google).to.equal(true);
    expect(result.github).to.equal(true);
  });

  it("backward-compat: returns password:true for legacy email/password account with no OAuth and no hasSetPassword flag", () => {
    const user = { password: "legacy-hash", hasSetPassword: false };
    const result = buildAuthMethods(user);
    expect(result.password).to.equal(true);
  });

  it("returns all provider flags correctly", () => {
    const user = {
      hasSetPassword: true,
      password: "h",
      google_id: "g",
      github_id: "gh",
      linkedin_id: "li",
      microsoft_id: "ms",
      twitter_id: "tw",
      facebook_id: "fb",
      apple_id: "ap",
    };
    const result = buildAuthMethods(user);
    expect(result).to.deep.equal({
      password: true,
      google: true,
      github: true,
      linkedin: true,
      microsoft: true,
      twitter: true,
      facebook: true,
      apple: true,
    });
  });
});

// ---------------------------------------------------------------------------
// computeUserOnboardingChecklist logic
// ---------------------------------------------------------------------------
describe("computeUserOnboardingChecklist (personal onboarding checklist logic)", () => {
  const computeUserOnboardingChecklist = rewireCreateUser.__get__(
    "computeUserOnboardingChecklist",
  );

  const { expect } = require("chai");

  it("adds add-device when user has at least one device", () => {
    const user = {
      devices: ["d1"],
      cohorts: [],
      onboarding_checklist: { is_dismissed: false, completed_steps: [] },
    };
    const result = computeUserOnboardingChecklist(user);
    expect(result.completed_steps).to.include("add-device");
    expect(result.completed_steps).to.not.include("assign-cohort");
  });

  it("adds assign-cohort when user has at least one cohort", () => {
    const user = {
      devices: [],
      cohorts: ["c1"],
      onboarding_checklist: { is_dismissed: false, completed_steps: [] },
    };
    const result = computeUserOnboardingChecklist(user);
    expect(result.completed_steps).to.include("assign-cohort");
    expect(result.completed_steps).to.not.include("add-device");
  });

  it("adds both dynamic steps when user has devices and cohorts", () => {
    const user = {
      devices: ["d1"],
      cohorts: ["c1"],
      onboarding_checklist: { is_dismissed: false, completed_steps: ["set-visibility"] },
    };
    const result = computeUserOnboardingChecklist(user);
    expect(result.completed_steps).to.include("add-device");
    expect(result.completed_steps).to.include("assign-cohort");
    expect(result.completed_steps).to.include("set-visibility");
  });

  it("deduplicates dynamic steps already present in stored completed_steps", () => {
    const user = {
      devices: ["d1"],
      cohorts: ["c1"],
      onboarding_checklist: {
        is_dismissed: false,
        completed_steps: ["add-device", "assign-cohort"],
      },
    };
    const result = computeUserOnboardingChecklist(user);
    expect(result.completed_steps.filter((s) => s === "add-device")).to.have.length(1);
    expect(result.completed_steps.filter((s) => s === "assign-cohort")).to.have.length(1);
  });

  it("defaults gracefully for legacy users without onboarding_checklist field", () => {
    const user = { devices: ["d1"], cohorts: [], onboarding_checklist: undefined };
    const result = computeUserOnboardingChecklist(user);
    expect(result.is_dismissed).to.equal(false);
    expect(result.completed_steps).to.include("add-device");
  });

  it("preserves is_dismissed: true from stored state", () => {
    const user = {
      devices: [],
      cohorts: [],
      onboarding_checklist: { is_dismissed: true, completed_steps: [] },
    };
    expect(computeUserOnboardingChecklist(user).is_dismissed).to.equal(true);
  });

  it("accepts arbitrary step_id strings without restriction", () => {
    const user = {
      devices: [],
      cohorts: [],
      onboarding_checklist: {
        is_dismissed: false,
        completed_steps: ["download-desktop-app", "invite-team"],
      },
    };
    const result = computeUserOnboardingChecklist(user);
    expect(result.completed_steps).to.include("download-desktop-app");
    expect(result.completed_steps).to.include("invite-team");
  });
});
