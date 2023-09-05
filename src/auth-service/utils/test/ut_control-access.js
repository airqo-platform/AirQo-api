require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const moment = require("moment-timezone");
const controlAccess = require("@utils/control-access");
const UserModel = require("@models/User");
const AccessTokenModel = require("@models/AccessToken");
const mailer = require("@utils/mailer");
const crypto = require("crypto");
const accessCodeGenerator = require("generate-password");
const constants = require("@config/constants");
const generateFilter = require("@utils/generate-filter");
const ClientModel = require("@models/Client");
const ScopeModel = require("@models/Scope");
const RoleModel = require("@models/Role");
const NetworkModel = require("@models/Network");
const PermissionModel = require("@models/Permission");
const DepartmentModel = require("@models/Department");
const GroupModel = require("@models/Group");
const ObjectId = require("mongoose").Types.ObjectId;

describe("controlAccess", () => {
  describe("verifyEmail()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should verify email and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          user_id: "user123",
          token: "verification_token",
        },
        query: {},
      };

      // Mock the response from AccessTokenModel list()
      const listAccessTokenResponse = {
        success: true,
        status: httpStatus.OK,
        data: [
          {
            token: "verification_token",
            user_id: "user123",
            expires: moment().tz("UTC").add(1, "day").toDate(),
          },
        ],
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(listAccessTokenResponse);

      // Mock the response from UserModel modify()
      const updateUserResponse = {
        success: true,
        status: httpStatus.OK,
        data: {
          _id: "user123",
          firstName: "John",
          userName: "john.doe",
          email: "john.doe@example.com",
        },
      };
      sinon
        .stub(UserModel("sample_tenant"), "modify")
        .resolves(updateUserResponse);

      // Mock the response from AccessTokenModel remove()
      const deleteTokenResponse = {
        success: true,
        status: httpStatus.OK,
        data: "Token deleted",
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(deleteTokenResponse);

      // Mock the response from mailer afterEmailVerification()
      const sendEmailResponse = {
        success: true,
        message: "Email sent successfully",
        status: httpStatus.OK,
      };
      sinon.stub(mailer, "afterEmailVerification").resolves(sendEmailResponse);

      // Call the verifyEmail()
      const result = await controlAccess.verifyEmail(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("email verified sucessfully");
    });

    it("should handle invalid link and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          user_id: "user123",
          token: "invalid_token",
        },
        query: {},
      };

      // Mock the response from AccessTokenModel list()
      const listAccessTokenResponse = {
        success: true,
        status: httpStatus.NOT_FOUND,
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(listAccessTokenResponse);

      // Call the verifyEmail()
      const result = await controlAccess.verifyEmail(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid link");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("hash()", () => {
    it("should hash the input string and return the hashed value", () => {
      const inputString = "sample_password";

      // Call the hash()
      const result = controlAccess.hash(inputString);

      // Generate the expected hash using the crypto module
      const expectedHash = crypto
        .createHash("sha256")
        .update(inputString)
        .digest("base64");

      // Verify the result
      expect(result).to.equal(expectedHash);
    });

    it("should not throw an error when hashing the input string", () => {
      const inputString = "sample_password";

      // Call the hash()
      const result = () => controlAccess.hash(inputString);

      // Verify that the() does not throw an error
      expect(result).to.not.throw();
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("hash_compare()", () => {
    it("should return true when comparing the same items", () => {
      const firstItem = "sample";
      const secondItem = "sample";

      // Call the hash_compare()
      const result = controlAccess.hash_compare(firstItem, secondItem);

      // Verify the result
      expect(result).to.be.true;
    });

    it("should return false when comparing different items", () => {
      const firstItem = "sample1";
      const secondItem = "sample2";

      // Call the hash_compare()
      const result = controlAccess.hash_compare(firstItem, secondItem);

      // Verify the result
      expect(result).to.be.false;
    });

    it("should not throw an error when comparing items", () => {
      const firstItem = "sample";
      const secondItem = "sample";

      // Call the hash_compare()
      const result = () => controlAccess.hash_compare(firstItem, secondItem);

      // Verify that the() does not throw an error
      expect(result).to.not.throw();
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateAccessToken()", () => {
    it("should successfully update the token's metadata", async () => {
      const request = {
        query: { tenant: "example" },
        params: { token: "example-token" },
        body: { newField: "new-value" },
      };

      const fakeTokenDetails = [
        {
          _id: "fake-token-id",
          expires: "fake-expires",
          user_id: "fake-user-id",
        },
      ];

      const fakeUpdatedToken = { newField: "new-value", _id: "fake-token-id" };

      const AccessTokenModel = {
        find: sinon.fake.resolves(fakeTokenDetails),
        findByIdAndUpdate: sinon.fake.resolves(fakeUpdatedToken),
      };

      const result = await controlAccess.updateAccessToken(request);

      expect(AccessTokenModel.find.calledOnce).to.be.true;
      expect(AccessTokenModel.findByIdAndUpdate.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "Successfully updated the token's metadata",
        data: fakeUpdatedToken,
        status: httpStatus.OK,
      });
    });

    it("should return an error response if token does not exist", async () => {
      const request = {
        query: { tenant: "example" },
        params: { token: "non-existing-token" },
      };

      const fakeTokenDetails = [];

      const AccessTokenModel = {
        find: sinon.fake.resolves(fakeTokenDetails),
      };

      const result = await controlAccess.updateAccessToken(request);

      expect(AccessTokenModel.find.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message: "Bad request -- Token non-existing-token does not exist",
        },
      });
    });

    // ... more test cases
  });
  describe("regenerateAccessToken()", () => {
    it("should return a successful response with regenerated token", async () => {
      const request = {
        query: { tenant: "example" },
        body: {
          // Provide necessary body fields here
        },
      };

      const fakeResponseFromFilter = {
        success: true,
        // Provide filter based on request for successful scenario
      };

      const fakeToken = "fakeGeneratedToken";
      const fakeResponseFromUpdateToken = {
        success: true,
        // Provide appropriate response from update operation
      };

      const generateFilter = {
        tokens: sinon.fake.returns(fakeResponseFromFilter),
      };

      const AccessTokenModel = {
        modify: sinon.fake.resolves(fakeResponseFromUpdateToken),
      };

      const accessCodeGenerator = {
        generate: sinon.fake.returns(fakeToken),
      };

      const result = await controlAccess.regenerateAccessToken(request);

      expect(generateFilter.tokens.calledOnce).to.be.true;
      expect(AccessTokenModel.modify.calledOnce).to.be.true;
      expect(accessCodeGenerator.generate.calledOnce).to.be.true;

      expect(result).to.deep.equal(fakeResponseFromUpdateToken);
    });

    it("should return an error response if filtering tokens fails", async () => {
      const request = {
        query: { tenant: "example" },
        body: {
          // Provide necessary body fields here
        },
      };

      const fakeError = new Error("Test error");

      const generateFilter = {
        tokens: sinon.fake.returns({
          success: false,
          message: "Filtering tokens failed",
          errors: { message: fakeError.message },
        }),
      };

      const result = await controlAccess.regenerateAccessToken(request);

      expect(generateFilter.tokens.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Filtering tokens failed",
        errors: { message: fakeError.message },
      });
    });

    // ... more test cases
  });
  describe("deleteAccessToken()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete access token and return success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.tokens()
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel remove()
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: "Token deleted",
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteAccessToken()
      const result = await controlAccess.deleteAccessToken(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from generateFilter.tokens and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.tokens() with failure
      const responseFromFilter = {
        success: false,
        message: "Invalid input",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Call the deleteAccessToken()
      const result = await controlAccess.deleteAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid input");
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from AccessTokenModel.remove and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.tokens()
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel.remove() with failure
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteAccessToken()
      const result = await controlAccess.deleteAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listAccessToken()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list access tokens and return success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.tokens()
      const responseFromGenerateFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Mock the response from AccessTokenModel list()
      const responseFromListToken = {
        success: true,
        status: httpStatus.OK,
        data: [
          {
            // Add sample token data here
          },
        ],
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listAccessToken()
      const result = await controlAccess.listAccessToken(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from generateFilter.tokens and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.tokens() with failure
      const responseFromGenerateFilter = {
        success: false,
        message: "Invalid input",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Call the listAccessToken()
      const result = await controlAccess.listAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid input");
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from AccessTokenModel.list and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.tokens()
      const responseFromGenerateFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Mock the response from AccessTokenModel.list() with failure
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listAccessToken()
      const result = await controlAccess.listAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createAccessToken()", () => {
    it("should return a successful response with a generated token", async () => {
      const request = {
        query: { tenant: "example" },
        body: { client_id: "someClientId" },
      };

      const fakeClient = { _id: "fakeClientId" };
      const fakeToken = "fakeGeneratedToken";
      const fakeResponse = {
        success: true,
        message: "Token created successfully",
        // ... other fields
      };

      const ClientModel = {
        findById: sinon.fake.resolves(fakeClient),
      };

      const AccessTokenModel = sinon.fake.returns({
        register: sinon.fake.resolves(fakeResponse),
      });

      const accessCodeGenerator = {
        generate: sinon.fake.returns(fakeToken),
      };

      const result = await controlAccess.createAccessToken(request);

      expect(ClientModel.findById.calledOnceWithExactly("someClientId")).to.be
        .true;
      expect(accessCodeGenerator.generate.calledOnce).to.be.true;
      expect(
        AccessTokenModel.calledOnceWithExactly({
          token: fakeToken,
          client_id: "fakeClientId",
          // ... other fields from request.body
        })
      ).to.be.true;

      expect(result).to.deep.equal(fakeResponse);
    });

    it("should return an error response if client is not found", async () => {
      const request = {
        query: { tenant: "example" },
        body: { client_id: "nonExistentClientId" },
      };

      const fakeClient = null;

      const ClientModel = {
        findById: sinon.fake.resolves(fakeClient),
      };

      const result = await controlAccess.createAccessToken(request);

      expect(ClientModel.findById.calledOnceWithExactly("nonExistentClientId"))
        .to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Client not found",
        status: httpStatus.BAD_REQUEST,
        errors: {
          message: "Invalid request, Client nonExistentClientId not found",
        },
      });
    });

    it("should return an error response on internal server error", async () => {
      const request = {
        query: { tenant: "example" },
        body: { client_id: "someClientId" },
      };

      const fakeError = new Error("Test error");

      const ClientModel = {
        findById: sinon.fake.rejects(fakeError),
      };

      const result = await controlAccess.createAccessToken(request);

      expect(ClientModel.findById.calledOnceWithExactly("someClientId")).to.be
        .true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: fakeError.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("generateVerificationToken()", () => {
    it("should return a successful response with verification token sent", async () => {
      const request = {
        query: { tenant: "example" },
        body: {
          email: "test@example.com",
          firstName: "Test",
        },
      };

      const fakeResponseFromCreateUser = {
        success: true,
        data: { _id: "fakeUserId" },
      };

      const fakeToken = "fakeGeneratedToken";
      const fakeResponseFromSaveToken = {
        success: true,
      };

      const fakeResponseFromSendEmail = {
        success: true,
        status: httpStatus.OK,
      };

      const UserModel = {
        register: sinon.fake.resolves(fakeResponseFromCreateUser),
      };

      const AccessTokenModel = {
        register: sinon.fake.resolves(fakeResponseFromSaveToken),
      };

      const mailer = {
        verifyEmail: sinon.fake.resolves(fakeResponseFromSendEmail),
      };

      const accessCodeGenerator = {
        generate: sinon.fake.returns(fakeToken),
      };

      const result = await controlAccess.generateVerificationToken(request);

      expect(UserModel.register.calledOnce).to.be.true;
      expect(AccessTokenModel.register.calledOnce).to.be.true;
      expect(mailer.verifyEmail.calledOnce).to.be.true;
      expect(accessCodeGenerator.generate.calledTwice).to.be.true;

      expect(result).to.deep.equal({
        success: true,
        message: "An Email sent to your account please verify",
        data: fakeResponseFromCreateUser.data,
        status: httpStatus.OK,
      });
    });

    it("should return an error response if creating user fails", async () => {
      const request = {
        query: { tenant: "example" },
        body: {
          email: "test@example.com",
          firstName: "Test",
        },
      };

      const fakeError = new Error("Test error");

      const UserModel = {
        register: sinon.fake.rejects(fakeError),
      };

      const result = await controlAccess.generateVerificationToken(request);

      expect(UserModel.register.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: { message: fakeError.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });
  describe("updateClient()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update the client with new client_id and client_secret and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add properties to update the client here
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel modify()
      const responseFromUpdateToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add properties for the updated client here
        },
      };
      sinon
        .stub(ClientModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateClient()
      const result = await controlAccess.updateClient(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Add more expectations as needed based on the response structure
    });

    it("should handle errors during client update and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add properties to update the client here
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel modify()
      const responseFromUpdateToken = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateClient()
      const result = await controlAccess.updateClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteClient()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete the client and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel remove()
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: "Client deleted",
      };
      sinon
        .stub(ClientModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteClient()
      const result = await controlAccess.deleteClient(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.equal("Client deleted");
    });

    it("should handle errors during client deletion and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel remove()
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteClient()
      const result = await controlAccess.deleteClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listClient()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list clients and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel list()
      const responseFromListToken = {
        success: true,
        status: httpStatus.OK,
        data: [
          {
            // Add mock client data here
          },
          // Add more mock client data if needed
        ],
      };
      sinon
        .stub(ClientModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listClient()
      const result = await controlAccess.listClient(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
    });

    it("should handle errors during client listing and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.clients()
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel list()
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listClient()
      const result = await controlAccess.listClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createClient()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a client and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add client data here as required by the()
        },
      };

      // Mock the response from the accessCodeGenerator.generate() for client_id
      const client_id = "mocked_client_id"; // Replace this with a random generated client_id
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .returns(client_id);

      // Mock the response from the accessCodeGenerator.generate() for client_secret
      const client_secret = "mocked_client_secret"; // Replace this with a random generated client_secret
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        )
        .returns(client_secret);

      // Mock the response from the ClientModel register()
      const responseFromCreateToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add mock data for the newly created client
        },
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createClient()
      const result = await controlAccess.createClient(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("object");
      expect(result.data.client_id).to.equal(client_id);
      expect(result.data.client_secret).to.equal(client_secret);
    });

    it("should handle errors during client creation and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add client data here as required by the()
        },
      };

      // Mock the response from the accessCodeGenerator.generate() for client_id
      const client_id = "mocked_client_id"; // Replace this with a random generated client_id
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .returns(client_id);

      // Mock the response from the accessCodeGenerator.generate() for client_secret
      const client_secret = "mocked_client_secret"; // Replace this with a random generated client_secret
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        )
        .returns(client_secret);

      // Mock the response from the ClientModel register()
      const responseFromCreateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createClient()
      const result = await controlAccess.createClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateClientSecret()", () => {
    it("should successfully update client secret and return the new secret", async () => {
      const request = {
        query: { tenant: "example" },
        params: { client_id: "example-client-id" },
      };

      const fakeClientExists = true;
      const fakeClientSecret = "fakeUpdatedClientSecret";
      const fakeUpdatedClient = { client_secret: fakeClientSecret };

      const ClientModel = {
        exists: sinon.fake.resolves(fakeClientExists),
        findByIdAndUpdate: sinon.fake.resolves(fakeUpdatedClient),
      };

      const result = await controlAccess.updateClientSecret(request);

      expect(ClientModel.exists.calledOnce).to.be.true;
      expect(ClientModel.findByIdAndUpdate.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "Successful Operation",
        status: httpStatus.OK,
        data: fakeClientSecret,
      });
    });

    it("should return an error response if client does not exist", async () => {
      const request = {
        query: { tenant: "example" },
        params: { client_id: "non-existing-client-id" },
      };

      const fakeClientExists = false;

      const ClientModel = {
        exists: sinon.fake.resolves(fakeClientExists),
      };

      const result = await controlAccess.updateClientSecret(request);

      expect(ClientModel.exists.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Bad Request Error",
        errors: { message: "Client with ID non-existing-client-id not found" },
        status: httpStatus.BAD_REQUEST,
      });
    });

    // ... more test cases
  });
  describe("updateScope()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update a scope and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add updated scope data here as required by the()
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel modify()
      const responseFromUpdateToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add updated scope data here as returned by the modify()
        },
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateScope()
      const result = await controlAccess.updateScope(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("object");
      // Perform additional assertions for the updated scope data
    });

    it("should handle errors during scope update and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add updated scope data here as required by the()
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel modify()
      const responseFromUpdateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateScope()
      const result = await controlAccess.updateScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteScope()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete a scope and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel remove()
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add deleted scope data here as returned by the remove()
        },
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteScope()
      const result = await controlAccess.deleteScope(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("object");
      // Perform additional assertions for the deleted scope data
    });

    it("should handle errors during scope deletion and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel remove()
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteScope()
      const result = await controlAccess.deleteScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listScope()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list scopes and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel list()
      const responseFromListToken = {
        success: true,
        status: httpStatus.OK,
        data: [
          // Add mock list of scopes here as returned by the list()
        ],
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listScope()
      const result = await controlAccess.listScope(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
      // Perform additional assertions for the list of scopes data
    });

    it("should handle errors during scope listing and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.scopes()
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel list()
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listScope()
      const result = await controlAccess.listScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createScope()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a new scope and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add the necessary scope data in the body
        },
      };

      // Mock the response from the ScopeModel register()
      const responseFromCreateToken = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          // Add the mock data for the newly created scope
        },
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createScope()
      const result = await controlAccess.createScope(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.data).to.be.an("object");
      // Perform additional assertions for the newly created scope data
    });

    it("should handle errors during scope creation and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add the necessary scope data in the body
        },
      };

      // Mock the response from the ScopeModel register()
      const responseFromCreateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createScope()
      const result = await controlAccess.createScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list roles and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the generateFilter.roles()
      const filter = {
        // Add the mock filter data here
      };
      sinon.stub(generateFilter, "roles").returns(filter);

      // Mock the response from the RoleModel list()
      const responseFromListRole = {
        success: true,
        status: httpStatus.OK,
        data: [
          // Add the mock role data here
        ],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListRole);

      // Call the listRole()
      const result = await controlAccess.listRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
      // Perform additional assertions for the list of roles
    });

    it("should handle errors in generating filter and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the generateFilter.roles()
      const filterError = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Invalid filter",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "roles").returns(filterError);

      // Call the listRole()
      const result = await controlAccess.listRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid filter");
    });

    it("should handle errors in listing roles and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the generateFilter.roles()
      const filter = {
        // Add the mock filter data here
      };
      sinon.stub(generateFilter, "roles").returns(filter);

      // Mock the response from the RoleModel list()
      const responseFromListRole = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListRole);

      // Call the listRole()
      const result = await controlAccess.listRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listRolesForNetwork()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list roles for the network and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          net_id: "network123",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the NetworkModel findById()
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate()
      const roleResponse = [
        {
          _id: "role123",
          name: "Role 1",
          role_permissions: [
            {
              _id: "permission123",
              permission: "Permission 1",
            },
          ],
        },
        // Add other role data
      ];
      sinon
        .stub(RoleModel("sample_tenant"), "aggregate")
        .resolves(roleResponse);

      // Call the listRolesForNetwork()
      const result = await controlAccess.listRolesForNetwork(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
      // Perform additional assertions for the list of roles
    });

    it("should handle network not found and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          net_id: "network123",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the NetworkModel findById()
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(null);

      // Call the listRolesForNetwork()
      const result = await controlAccess.listRolesForNetwork(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Network network123 Not Found");
    });

    it("should handle no roles for the network and return success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          net_id: "network123",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the NetworkModel findById()
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate() (empty result)
      const roleResponse = [];
      sinon
        .stub(RoleModel("sample_tenant"), "aggregate")
        .resolves(roleResponse);

      // Call the listRolesForNetwork()
      const result = await controlAccess.listRolesForNetwork(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array").that.is.empty;
    });

    it("should handle errors in listing roles for the network and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          net_id: "network123",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the NetworkModel findById()
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate() (error)
      sinon
        .stub(RoleModel("sample_tenant"), "aggregate")
        .throws(new Error("Database Error"));

      // Call the listRolesForNetwork()
      const result = await controlAccess.listRolesForNetwork(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete role and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the RoleModel remove()
      const responseFromDeleteRole = {
        success: true,
        message: "Role deleted successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteRole);

      // Call the deleteRole()
      const result = await controlAccess.deleteRole(request);

      // Verify the response
      expect(result).to.deep.equal(responseFromDeleteRole);
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the RoleModel remove()
      const responseFromDeleteRole = {
        success: false,
        message: "Role not found",
        status: httpStatus.BAD_REQUEST,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteRole);

      // Call the deleteRole()
      const result = await controlAccess.deleteRole(request);

      // Verify the response
      expect(result).to.deep.equal(responseFromDeleteRole);
    });

    it("should handle errors in deleting role and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other necessary data in the request object
      };

      // Mock the response from the RoleModel remove() (error)
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .throws(new Error("Database Error"));

      // Call the deleteRole()
      const result = await controlAccess.deleteRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update role and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add necessary data for updating the role
        },
      };

      // Mock the response from the RoleModel modify()
      const responseFromUpdateRole = {
        success: true,
        message: "Role updated successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateRole);

      // Call the updateRole()
      const result = await controlAccess.updateRole(request);

      // Verify the response
      expect(result).to.deep.equal(responseFromUpdateRole);
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add necessary data for updating the role
        },
      };

      // Mock the response from the RoleModel modify()
      const responseFromUpdateRole = {
        success: false,
        message: "Role not found",
        status: httpStatus.BAD_REQUEST,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateRole);

      // Call the updateRole()
      const result = await controlAccess.updateRole(request);

      // Verify the response
      expect(result).to.deep.equal(responseFromUpdateRole);
    });

    it("should handle errors in updating role and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add necessary data for updating the role
        },
      };

      // Mock the response from the RoleModel modify() (error)
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .throws(new Error("Database Error"));

      // Call the updateRole()
      const result = await controlAccess.updateRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a role and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add necessary data for creating the role
        },
      };

      // Mock the response from the NetworkModel findById()
      const network = {
        net_name: "sample_network",
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel register()
      const responseFromCreateRole = {
        success: true,
        message: "Role created successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "register")
        .resolves(responseFromCreateRole);

      // Call the createRole()
      const result = await controlAccess.createRole(request);

      // Verify the response
      expect(result).to.deep.equal(responseFromCreateRole);
    });

    it("should handle invalid network and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          network_id: "invalid_network_id",
          // Add necessary data for creating the role
        },
      };

      // Mock the response from the NetworkModel findById() (network not found)
      const network = {};
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Call the createRole()
      const result = await controlAccess.createRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Provided organisation invalid_network_id is invalid, please crosscheck"
      );
    });

    it("should handle errors in creating role and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add necessary data for creating the role
        },
      };

      // Mock the response from the NetworkModel findById()
      const network = {
        net_name: "sample_network",
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel register() (error)
      sinon
        .stub(RoleModel("sample_tenant"), "register")
        .throws(new Error("Database Error"));

      // Call the createRole()
      const result = await controlAccess.createRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listAvailableUsersForRole", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return a list of available users for a role", async () => {
      // Mock the UserModel.aggregate method
      const aggregateStub = sinon.stub(UserModel, "aggregate");
      aggregateStub.returns(
        Promise.resolve([
          /* Your mock data here */
        ])
      );

      // Mock the RoleModel.findById method
      const role = {
        /* Mocked role object */
      };
      const findByIdStub = sinon.stub(RoleModel, "findById");
      findByIdStub.withArgs(/* role_id */).returns(Promise.resolve(role));

      const request = {
        query: { tenant: "test-tenant" },
        params: { role_id: "test-role-id" },
      };

      const response = await controlAccess.listAvailableUsersForRole(request);

      expect(response.success).to.equal(true);
      expect(response.message).to.include(
        "retrieved all available users for the role"
      );
      expect(response.data).to.be.an("array");

      sinon.assert.calledOnce(aggregateStub);
      sinon.assert.calledWith(aggregateStub, sinon.match.array);
    });

    it("should handle invalid role ID", async () => {
      // Mock the RoleModel.findById method to return null (invalid role)
      const findByIdStub = sinon.stub(RoleModel, "findById");
      findByIdStub
        .withArgs(/* invalid_role_id */)
        .returns(Promise.resolve(null));

      const request = {
        query: { tenant: "test-tenant" },
        params: { role_id: "invalid-role-id" },
      };

      const response = await controlAccess.listAvailableUsersForRole(request);

      expect(response.success).to.equal(false);
      expect(response.message).to.include("Invalid role ID");
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
    });

    // Add more test cases as needed
  });
  describe("assignUserToRole", () => {
    let requestStub;
    let existsStub;
    let findByIdStub;
    let findByIdAndUpdateStub;

    beforeEach(() => {
      requestStub = {
        params: { role_id: "valid_role_id", user_id: "valid_user_id" },
        query: { tenant: "valid_tenant" },
        body: { user: "valid_user_id" },
      };
      existsStub = sinon.stub();
      findByIdStub = sinon.stub();
      findByIdAndUpdateStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return a success response when assigning a user to a role", async () => {
      // Arrange
      existsStub.withArgs({ _id: "valid_user_id" }).resolves(true);
      existsStub.withArgs({ _id: "valid_role_id" }).resolves(true);
      findByIdStub.withArgs("valid_user_id").resolves({
        network_roles: [],
        populate: () => ({
          lean: () => ({ network_roles: [] }),
        }),
      });
      findByIdAndUpdateStub.resolves({});

      sinon.replace(UserModel("valid_tenant"), "exists", existsStub);
      sinon.replace(RoleModel("valid_tenant"), "exists", existsStub);
      sinon.replace(UserModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(
        UserModel("valid_tenant"),
        "findByIdAndUpdate",
        findByIdAndUpdateStub
      );

      // Act
      const response = await controlAccess.assignUserToRole(requestStub);

      // Assert
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
    });

    // Add more test cases for different scenarios
  });
  describe("assignManyUsersToRole", () => {
    let requestStub;
    let findByIdStub;
    let updateManyStub;
    let existsStub;

    beforeEach(() => {
      requestStub = {
        query: { tenant: "valid_tenant" },
        params: { role_id: "valid_role_id" },
        body: { user_ids: ["user_id_1", "user_id_2"] },
      };

      findByIdStub = sinon.stub();
      updateManyStub = sinon.stub();
      existsStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return a success response when assigning users to a role", async () => {
      // Arrange
      findByIdStub.withArgs("valid_role_id").resolves({ _id: "valid_role_id" });
      findByIdStub.withArgs(sinon.match.any).resolves({ network_roles: [] });

      updateManyStub.resolves({ nModified: 2 });

      existsStub.resolves(true);

      sinon.replace(RoleModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(UserModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(UserModel("valid_tenant"), "updateMany", updateManyStub);
      sinon.replace(UserModel("valid_tenant"), "exists", existsStub);

      // Act
      const response = await controlAccess.assignManyUsersToRole(requestStub);

      // Assert
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
    });

    // Add more test cases for different scenarios
  });
  describe("listUsersWithRole", () => {
    let requestStub;
    let findByIdStub;
    let aggregateStub;

    beforeEach(() => {
      requestStub = {
        query: { tenant: "valid_tenant" },
        params: { role_id: "valid_role_id" },
      };

      findByIdStub = sinon.stub();
      aggregateStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return a list of users with the specified role", async () => {
      // Arrange
      const sampleUsers = [
        {
          _id: "user1",
          email: "user1@example.com",
          firstName: "User",
          lastName: "One",
          userName: "user_one",
        },
        {
          _id: "user2",
          email: "user2@example.com",
          firstName: "User",
          lastName: "Two",
          userName: "user_two",
        },
      ];

      findByIdStub.withArgs("valid_role_id").resolves({ _id: "valid_role_id" });

      aggregateStub.returnsThis().resolves(sampleUsers);

      sinon.replace(RoleModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(UserModel("valid_tenant"), "aggregate", aggregateStub);

      // Act
      const response = await controlAccess.listUsersWithRole(requestStub);

      // Assert
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data).to.deep.equal(sampleUsers);
    });

    // Add more test cases for different scenarios
  });
  describe("unAssignUserFromRole", () => {
    let requestStub;
    let findByIdStub;
    let findByIdAndUpdateStub;

    beforeEach(() => {
      requestStub = {
        query: { tenant: "valid_tenant" },
        params: { role_id: "valid_role_id", user_id: "valid_user_id" },
      };

      findByIdStub = sinon.stub();
      findByIdAndUpdateStub = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully unassign a user from a role", async () => {
      // Arrange
      const sampleUser = {
        _id: "valid_user_id",
        network_roles: [
          { role: "valid_role_id", network: "network_id_1" },
          { role: "other_role_id", network: "network_id_2" },
        ],
      };

      findByIdStub.withArgs("valid_user_id").resolves(sampleUser);

      findByIdAndUpdateStub
        .withArgs(
          "valid_user_id",
          {
            $pull: {
              network_roles: { role: "valid_role_id" },
            },
          },
          { new: true }
        )
        .resolves(sampleUser);

      sinon.replace(UserModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(
        UserModel("valid_tenant"),
        "findByIdAndUpdate",
        findByIdAndUpdateStub
      );

      // Act
      const response = await controlAccess.unAssignUserFromRole(requestStub);

      // Assert
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal("User unassigned from the role");
    });

    // Add more test cases for different scenarios
  });
  describe("unAssignManyUsersFromRole", () => {
    let requestStub;
    let existsStub;
    let findByIdStub;
    let findByIdAndUpdateStub;
    let updateManyStub;

    beforeEach(() => {
      requestStub = {
        query: { tenant: "valid_tenant" },
        params: { role_id: "valid_role_id" },
        body: { user_ids: ["valid_user_id_1", "valid_user_id_2"] },
      };

      existsStub = sinon.stub(RoleModel("valid_tenant"), "exists");
      findByIdStub = sinon.stub(UserModel("valid_tenant"), "findById");
      findByIdAndUpdateStub = sinon.stub(
        UserModel("valid_tenant"),
        "findByIdAndUpdate"
      );
      updateManyStub = sinon.stub(UserModel("valid_tenant"), "updateMany");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should successfully unassign many users from a role", async () => {
      // Arrange
      const sampleRole = {
        _id: "valid_role_id",
      };

      const sampleUsers = [
        {
          _id: "valid_user_id_1",
          network_roles: [
            { role: "valid_role_id", network: "network_id_1" },
            { role: "other_role_id", network: "network_id_2" },
          ],
        },
        {
          _id: "valid_user_id_2",
          network_roles: [
            { role: "valid_role_id", network: "network_id_1" },
            { role: "other_role_id", network: "network_id_3" },
          ],
        },
      ];

      existsStub.withArgs({ _id: "valid_role_id" }).resolves(true);

      findByIdStub.withArgs("valid_user_id_1").resolves(sampleUsers[0]);

      findByIdStub.withArgs("valid_user_id_2").resolves(sampleUsers[1]);

      findByIdAndUpdateStub
        .withArgs(
          "valid_user_id_1",
          {
            $pull: {
              network_roles: { role: "valid_role_id" },
            },
          },
          { new: true }
        )
        .resolves(sampleUsers[0]);

      findByIdAndUpdateStub
        .withArgs(
          "valid_user_id_2",
          {
            $pull: {
              network_roles: { role: "valid_role_id" },
            },
          },
          { new: true }
        )
        .resolves(sampleUsers[1]);

      updateManyStub
        .withArgs(
          { _id: { $in: ["valid_user_id_1", "valid_user_id_2"] } },
          { $pull: { network_roles: { role: "valid_role_id" } } }
        )
        .resolves({ nModified: 2 });

      sinon.replace(RoleModel("valid_tenant"), "exists", existsStub);
      sinon.replace(UserModel("valid_tenant"), "findById", findByIdStub);
      sinon.replace(
        UserModel("valid_tenant"),
        "findByIdAndUpdate",
        findByIdAndUpdateStub
      );
      sinon.replace(UserModel("valid_tenant"), "updateMany", updateManyStub);

      // Act
      const response = await controlAccess.unAssignManyUsersFromRole(
        requestStub
      );

      // Assert
      expect(response.success).to.equal(true);
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.message).to.equal(
        "All provided users were successfully unassigned."
      );
    });

    // Add more test cases for different scenarios
  });
  describe("listPermissionsForRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list permissions for the role and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel list() (permissions found)
      const permissionData = [
        { permission: "permission_1" },
        { permission: "permission_2" },
      ];
      const responseFromlistPermissionsForRole = {
        success: true,
        status: httpStatus.OK,
        data: permissionData,
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .resolves(responseFromlistPermissionsForRole);

      // Call the listPermissionsForRole()
      const result = await controlAccess.listPermissionsForRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal(["permission_1", "permission_2"]);
    });

    it("should handle PermissionModel list failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel list() (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .rejects(new Error("List Error"));

      // Call the listPermissionsForRole()
      const result = await controlAccess.listPermissionsForRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    it("should handle unsuccessful response from PermissionModel list and return the response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel list() (unsuccessful response)
      const responseFromlistPermissionsForRole = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        errors: { message: "Invalid role ID" },
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .resolves(responseFromlistPermissionsForRole);

      // Call the listPermissionsForRole()
      const result = await controlAccess.listPermissionsForRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Invalid role ID");
    });
  });
  describe("listAvailablePermissionsForRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list available permissions for the role and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.roles()
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list() (roles found)
      const roleData = [
        {
          _id: "sample_role_id",
          role_permissions: [
            { permission: "permission_1" },
            { permission: "permission_2" },
          ],
        },
      ];
      const responseFromListAvailablePermissionsForRole = {
        success: true,
        status: httpStatus.OK,
        data: roleData,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListAvailablePermissionsForRole);

      // Mock the response from the PermissionModel list() (permissions found)
      const permissionData = [
        { permission: "permission_3" },
        { permission: "permission_4" },
      ];
      const responseFromListPermissions = {
        success: true,
        status: httpStatus.OK,
        data: permissionData,
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .resolves(responseFromListPermissions);

      // Call the listAvailablePermissionsForRole()
      const result = await controlAccess.listAvailablePermissionsForRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal(permissionData);
    });

    it("should handle generateFilter.roles failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.roles() (failure)
      const filterResponse = {
        success: false,
        message: "Filter generation failed",
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Call the listAvailablePermissionsForRole()
      const result = await controlAccess.listAvailablePermissionsForRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    it("should handle RoleModel list failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.roles()
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .rejects(new Error("List Error"));

      // Call the listAvailablePermissionsForRole()
      const result = await controlAccess.listAvailablePermissionsForRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    it("should handle unsuccessful response from RoleModel list and return the response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.roles()
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list() (unsuccessful response)
      const responseFromListAvailablePermissionsForRole = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        errors: { message: "Role not found" },
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListAvailablePermissionsForRole);

      // Call the listAvailablePermissionsForRole()
      const result = await controlAccess.listAvailablePermissionsForRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Role not found");
    });

    it("should handle successful response from RoleModel list but no available permissions found", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          limit: "10",
          skip: "0",
          tenant: "sample_tenant",
        },
      };

      // Mock the response from generateFilter.roles()
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list() (roles found, but no permissions)
      const roleData = [{ _id: "sample_role_id", role_permissions: [] }];
      const responseFromListAvailablePermissionsForRole = {
        success: true,
        status: httpStatus.OK,
        data: roleData,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListAvailablePermissionsForRole);

      // Call the listAvailablePermissionsForRole()
      const result = await controlAccess.listAvailablePermissionsForRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("roles not found for this operation");
      expect(result.data).to.be.an("array").that.is.empty;
    });
  });
  describe("assignPermissionsToRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should assign permissions to the role and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permissions: ["permission_1", "permission_2"],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOneAndUpdate() (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3", "permission_1", "permission_2"],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "findOneAndUpdate")
        .resolves(updatedRoleData);

      // Call the assignPermissionsToRole()
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("Permissions added successfully");
      expect(result.data).to.deep.equal(updatedRoleData);
    });

    it("should handle RoleModel findById failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permissions: ["permission_1", "permission_2"],
        },
      };

      // Mock the response from the RoleModel findById() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the assignPermissionsToRole()
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Role sample_role_id Not Found");
    });

    it("should handle PermissionModel find failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permissions: ["permission_1", "permission_2"],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permissions not found"));

      // Call the assignPermissionsToRole()
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "not all provided permissions exist, please crosscheck"
      );
    });

    it("should handle already assigned permissions and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permissions: ["permission_1", "permission_2"],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_1", "permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Call the assignPermissionsToRole()
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Some permissions already assigned to the Role sample_role_id, they include: permission_1"
      );
    });

    it("should handle RoleModel findOneAndUpdate failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permissions: ["permission_1", "permission_2"],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOneAndUpdate() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findOneAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the assignPermissionsToRole()
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("unable to update Role");
    });
  });
  describe("unAssignPermissionFromRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should unassign permission from the role and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
          permission_id: "sample_permission_id",
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById() (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne() (role and permission association found)
      const roleResponse = {
        _id: "sample_role_id",
        role_permissions: ["sample_permission_id"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(roleResponse);

      // Mock the response from the RoleModel modify() (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_1", "permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "modify").resolves({
        success: true,
        message: "successfully modified the Permission",
      });

      // Call the unAssignPermissionFromRole()
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal(
        "permission has been unassigned from role"
      );
    });

    it("should handle RoleModel findById failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
          permission_id: "sample_permission_id",
        },
      };

      // Mock the response from the RoleModel findById() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the unAssignPermissionFromRole()
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Role sample_role_id Not Found");
    });

    it("should handle PermissionModel findById failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
          permission_id: "sample_permission_id",
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById() (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .rejects(new Error("Permission not found"));

      // Call the unAssignPermissionFromRole()
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Permission sample_permission_id Not Found"
      );
    });

    it("should handle RoleModel findOne failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
          permission_id: "sample_permission_id",
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById() (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne() (failure)
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(null);

      // Call the unAssignPermissionFromRole()
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Permission sample_permission_id is not assigned to the Role sample_role_id"
      );
    });

    it("should handle RoleModel modify failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
          permission_id: "sample_permission_id",
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById() (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne() (role and permission association found)
      const roleResponse = {
        _id: "sample_role_id",
        role_permissions: ["sample_permission_id"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(roleResponse);

      // Mock the response from the RoleModel modify() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .rejects(new Error("Failed to modify role"));

      // Call the unAssignPermissionFromRole()
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Internal Server Error");
    });
  });
  describe("unAssignManyPermissionsFromRole()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should unassign multiple permissions from the role and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_id_1",
          "permission_id_2",
          "permission_id_3",
          "permission_id_4",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate() (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_id_1", "permission_id_3"],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .resolves(updatedRoleData);

      // Call the unAssignManyPermissionsFromRole()
      const result = await controlAccess.unAssignManyPermissionsFromRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("Permissions removed successfully");
      expect(result.data).to.deep.equal(updatedRoleData);
    });

    it("should handle RoleModel findById failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the unAssignManyPermissionsFromRole()
      const result = await controlAccess.unAssignManyPermissionsFromRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Errors");
      expect(result.errors.message).to.equal("Role sample_role_id not found");
    });

    it("should handle PermissionModel find failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_id_1",
          "permission_id_2",
          "permission_id_3",
          "permission_id_4",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permission not found"));

      // Call the unAssignManyPermissionsFromRole()
      const result = await controlAccess.unAssignManyPermissionsFromRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Errors");
      expect(result.errors.message).to.equal(
        "Permissions not found: permission_id_1, permission_id_2, permission_id_3"
      );
    });

    it("should handle RoleModel findByIdAndUpdate failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_id_1",
          "permission_id_2",
          "permission_id_3",
          "permission_id_4",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the unAssignManyPermissionsFromRole()
      const result = await controlAccess.unAssignManyPermissionsFromRole(
        request
      );

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "unable to remove the permissions"
      );
    });
  });
  describe("updateRolePermissions()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update role permissions and send success response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate() (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_id_1",
          "permission_id_2",
          "permission_id_3",
        ],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .resolves(updatedRoleData);

      // Call the updateRolePermissions()
      const result = await controlAccess.updateRolePermissions(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("Permissions updated successfully");
      expect(result.data).to.deep.equal(updatedRoleData);
    });

    it("should handle RoleModel findById failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the updateRolePermissions()
      const result = await controlAccess.updateRolePermissions(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Errors");
      expect(result.errors.message).to.equal("Role sample_role_id not found");
    });

    it("should handle PermissionModel find failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permission not found"));

      // Call the updateRolePermissions()
      const result = await controlAccess.updateRolePermissions(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Errors");
      expect(result.errors.message).to.equal(
        "Permissions not found: permission_id_1, permission_id_2, permission_id_3"
      );
    });

    it("should handle RoleModel findByIdAndUpdate failure and return failure response", async () => {
      const request = {
        query: {
          role_id: "sample_role_id",
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
        body: {
          permission_ids: [
            "permission_id_1",
            "permission_id_2",
            "permission_id_3",
          ],
        },
      };

      // Mock the response from the RoleModel findById() (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find() (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate() (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the updateRolePermissions()
      const result = await controlAccess.updateRolePermissions(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "unable to update the permissions"
      );
    });
  });
  describe("listPermission()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list permissions and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel list() (permissions found)
      const permissionData = [
        { _id: "permission_id_1", permission: "permission_1" },
        { _id: "permission_id_2", permission: "permission_2" },
      ];
      sinon.stub(PermissionModel("sample_tenant"), "list").resolves({
        success: true,
        data: permissionData,
      });

      // Call the listPermission()
      const result = await controlAccess.listPermission(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(permissionData);
    });

    it("should handle PermissionModel list failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel list() (failure)
      sinon.stub(PermissionModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to fetch permissions",
      });

      // Call the listPermission()
      const result = await controlAccess.listPermission(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to fetch permissions");
    });

    it("should handle generateFilter permissions failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.permissions() (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the listPermission()
      const result = await controlAccess.listPermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("deletePermission()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete the permission and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel remove() (success)
      sinon.stub(PermissionModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Permission deleted successfully",
      });

      // Mock the response from the generateFilter.permissions()
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission()
      const result = await controlAccess.deletePermission(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Permission deleted successfully");
    });

    it("should handle PermissionModel remove failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the PermissionModel remove() (failure)
      sinon.stub(PermissionModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete permission",
      });

      // Mock the response from the generateFilter.permissions()
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission()
      const result = await controlAccess.deletePermission(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete permission");
    });

    it("should handle generateFilter permissions failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the generateFilter.permissions() (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission()
      const result = await controlAccess.deletePermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("updatePermission()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update the permission and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Permission update data
          name: "Updated Permission",
          description: "Updated description",
        },
      };

      // Mock the response from the PermissionModel modify() (success)
      sinon.stub(PermissionModel("sample_tenant"), "modify").resolves({
        success: true,
        message: "Permission updated successfully",
      });

      // Mock the response from the generateFilter.permissions()
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission()
      const result = await controlAccess.updatePermission(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Permission updated successfully");
    });

    it("should handle PermissionModel modify failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Permission update data
          name: "Updated Permission",
          description: "Updated description",
        },
      };

      // Mock the response from the PermissionModel modify() (failure)
      sinon.stub(PermissionModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update permission",
      });

      // Mock the response from the generateFilter.permissions()
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission()
      const result = await controlAccess.updatePermission(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update permission");
    });

    it("should handle generateFilter permissions failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Permission update data
          name: "Updated Permission",
          description: "Updated description",
        },
      };

      // Mock the response from the generateFilter.permissions() (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission()
      const result = await controlAccess.updatePermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("createPermission()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create the permission and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Permission data for creation
          name: "New Permission",
          description: "Description of the new permission",
        },
      };

      // Mock the response from the PermissionModel register() (success)
      sinon.stub(PermissionModel("sample_tenant"), "register").resolves({
        success: true,
        message: "Permission created successfully",
        data: {
          _id: "permission_id",
          name: "New Permission",
          description: "Description of the new permission",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Call the createPermission()
      const result = await controlAccess.createPermission(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Permission created successfully");
      expect(result.data).to.have.property("_id");
      expect(result.data.name).to.equal("New Permission");
      expect(result.data.description).to.equal(
        "Description of the new permission"
      );
    });

    it("should handle PermissionModel register failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Permission data for creation
          name: "New Permission",
          description: "Description of the new permission",
        },
      };

      // Mock the response from the PermissionModel register() (failure)
      sinon.stub(PermissionModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create permission",
      });

      // Call the createPermission()
      const result = await controlAccess.createPermission(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create permission");
    });
  });
  describe("createDepartment()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create the department and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Department data for creation
          name: "New Department",
          description: "Description of the new department",
        },
      };

      // Mock the response from the DepartmentModel register() (success)
      sinon.stub(DepartmentModel("sample_tenant"), "register").resolves({
        success: true,
        message: "Department created successfully",
        data: {
          _id: "department_id",
          name: "New Department",
          description: "Description of the new department",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Call the createDepartment()
      const result = await controlAccess.createDepartment(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Department created successfully");
      expect(result.data).to.have.property("_id");
      expect(result.data.name).to.equal("New Department");
      expect(result.data.description).to.equal(
        "Description of the new department"
      );
    });

    it("should handle DepartmentModel register failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Department data for creation
          name: "New Department",
          description: "Description of the new department",
        },
      };

      // Mock the response from the DepartmentModel register() (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create department",
      });

      // Call the createDepartment()
      const result = await controlAccess.createDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create department");
    });
  });
  describe("updateDepartment()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update the department and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Updated department data
          name: "Updated Department",
          description: "Updated description of the department",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel modify() (success)
      sinon.stub(DepartmentModel("sample_tenant"), "modify").resolves({
        success: true,
        message: "Department updated successfully",
        data: {
          _id: "department_id",
          name: "Updated Department",
          description: "Updated description of the department",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Call the updateDepartment()
      const result = await controlAccess.updateDepartment(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Department updated successfully");
      expect(result.data).to.have.property("_id");
      expect(result.data.name).to.equal("Updated Department");
      expect(result.data.description).to.equal(
        "Updated description of the department"
      );
    });

    it("should handle generateFilter failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Updated department data
          name: "Updated Department",
          description: "Updated description of the department",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the updateDepartment()
      const result = await controlAccess.updateDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
    });

    it("should handle DepartmentModel modify failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Updated department data
          name: "Updated Department",
          description: "Updated description of the department",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel modify() (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update department",
      });

      // Call the updateDepartment()
      const result = await controlAccess.updateDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update department");
    });
  });
  describe("deleteDepartment()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete the department and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel remove() (success)
      sinon.stub(DepartmentModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Department deleted successfully",
      });

      // Call the deleteDepartment()
      const result = await controlAccess.deleteDepartment(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Department deleted successfully");
    });

    it("should handle generateFilter failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the deleteDepartment()
      const result = await controlAccess.deleteDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
    });

    it("should handle DepartmentModel remove failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          department_id: "department_id",
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel remove() (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete department",
      });

      // Call the deleteDepartment()
      const result = await controlAccess.deleteDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete department");
    });
  });
  describe("listDepartment()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list departments and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          // Filter data
        },
      });

      // Mock the response from the DepartmentModel list() (success)
      sinon.stub(DepartmentModel("sample_tenant"), "list").resolves({
        success: true,
        data: [
          // Department data
        ],
      });

      // Call the listDepartment()
      const result = await controlAccess.listDepartment(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array");
      // Add more assertions as per the response structure
    });

    it("should handle generateFilter failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.departments() (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the listDepartment()
      const result = await controlAccess.listDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Invalid filter parameters");
    });

    it("should handle DepartmentModel list failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
          limit: 10,
          skip: 0,
        },
      };

      // Mock the response from generateFilter.departments() (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          // Filter data
        },
      });

      // Mock the response from the DepartmentModel list() (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to fetch departments",
      });

      // Call the listDepartment()
      const result = await controlAccess.listDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to fetch departments");
    });
  });
  describe("createGroup()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create a group and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Group data
        },
      };

      // Mock the response from the GroupModel register() (success)
      sinon.stub(GroupModel("sample_tenant"), "register").resolves({
        success: true,
        data: {
          // Newly created group data
        },
      });

      // Call the createGroup()
      const result = await controlAccess.createGroup(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object");
      // Add more assertions as per the response structure
    });

    it("should handle GroupModel register failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Group data
        },
      };

      // Mock the response from the GroupModel register() (failure)
      sinon.stub(GroupModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create group",
      });

      // Call the createGroup()
      const result = await controlAccess.createGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create group");
    });
  });
  describe("updateGroup()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update a group and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          group_id: "sample_group_id",
        },
        body: {
          // Updated group data
        },
      };

      // Mock the response from the GroupModel modify() (success)
      sinon.stub(GroupModel("sample_tenant"), "modify").resolves({
        success: true,
        data: {
          // Updated group data
        },
      });

      // Call the updateGroup()
      const result = await controlAccess.updateGroup(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object");
      // Add more assertions as per the response structure
    });

    it("should handle GroupModel modify failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          group_id: "sample_group_id",
        },
        body: {
          // Updated group data
        },
      };

      // Mock the response from the GroupModel modify() (failure)
      sinon.stub(GroupModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update group",
      });

      // Call the updateGroup()
      const result = await controlAccess.updateGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update group");
    });
  });
  describe("deleteGroup()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete a group and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for deleteGroup()
      };

      // Mock the response from the GroupModel remove() (success)
      sinon.stub(GroupModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Group deleted successfully",
      });

      // Call the deleteGroup()
      const result = await controlAccess.deleteGroup(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Group deleted successfully");
    });

    it("should handle GroupModel remove failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for deleteGroup()
      };

      // Mock the response from the GroupModel remove() (failure)
      sinon.stub(GroupModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete group",
      });

      // Call the deleteGroup()
      const result = await controlAccess.deleteGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete group");
    });
  });
  describe("listGroup()", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list groups and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for listGroup()
      };

      // Mock the response from the GroupModel list() (success)
      const mockListResponse = {
        success: true,
        data: [
          // Sample group objects returned by the GroupModel.list()
        ],
      };
      sinon
        .stub(GroupModel("sample_tenant"), "list")
        .resolves(mockListResponse);

      // Call the listGroup()
      const result = await controlAccess.listGroup(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(mockListResponse.data);
    });

    it("should handle GroupModel list failure and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for listGroup()
      };

      // Mock the response from the GroupModel list() (failure)
      sinon.stub(GroupModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to list groups",
      });

      // Call the listGroup()
      const result = await controlAccess.listGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to list groups");
    });
  });
  describe("verifyToken()", () => {
    let AccessTokenModelStub;

    beforeEach(() => {
      AccessTokenModelStub = sinon.stub();
      AccessTokenModelStub.list = sinon.stub();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return unauthorized response if deprecated version", async () => {
      const headers = { "x-original-uri": "deprecated-version-number" };
      const request = { headers, query: { tenant: "example_tenant" } };

      const result = await controlAccess.verifyToken(request);

      expect(result).to.deep.equal(createUnauthorizedResponse());
    });

    it("should return unauthorized response if AccessTokenModel.list returns NOT_FOUND status", async () => {
      AccessTokenModelStub.list.resolves({
        success: true,
        status: httpStatus.NOT_FOUND,
      });
      const request = { headers: {}, query: { tenant: "example_tenant" } };

      const result = await controlAccess.verifyToken(request);

      expect(result).to.deep.equal(createUnauthorizedResponse());
    });

    it("should create valid token response if AccessTokenModel.list returns OK status and required headers are provided", async () => {
      AccessTokenModelStub.list.resolves({
        success: true,
        status: httpStatus.OK,
        data: [
          {
            client: "example_client",
            user: { email: "user@example.com", userName: "username" },
          },
        ],
      });

      const headers = {
        "x-original-uri": "example-uri",
        "x-original-method": "GET",
      };
      const request = { headers, query: { tenant: "example_tenant" } };

      const result = await controlAccess.verifyToken(request);

      expect(result).to.deep.equal(createValidTokenResponse());
    });

    // Add more test cases as needed
  });
  describe("verifyVerificationToken()", () => {
    let requestMock;
    let AccessTokenModelMock;
    let UserModelMock;
    let mailerMock;

    beforeEach(() => {
      requestMock = {
        query: { tenant: "exampleTenant" },
        params: { user_id: "user123", token: "token123" },
      };

      AccessTokenModelMock = (tenant) => ({
        list: sinon.stub().resolves({ success: true, status: 200 }),
        remove: sinon.stub().resolves({ success: true }),
      });

      UserModelMock = (tenant) => ({
        modify: sinon.stub().resolves({ success: true, data: {} }),
      });

      mailerMock = {
        afterEmailVerification: sinon.stub().resolves({ success: true }),
      };

      sinon.stub(moment.tz, "guess").returns("UTC");
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return error for invalid link", async () => {
      AccessTokenModelMock = (tenant) => ({
        list: sinon.stub().resolves({ success: true, status: 404 }),
      });

      const result =
        await verifyVerificationTokenFunction.verifyVerificationToken(
          requestMock,
          AccessTokenModelMock,
          UserModelMock,
          mailerMock
        );
      expect(result.success).to.be.false;
      expect(result.status).to.equal(400);
      expect(result.message).to.equal("Invalid link");
    });

    it("should verify user, send email, and remove token", async () => {
      const generateStub = sinon.stub().returns("generatedPassword");
      const filterResponse = { success: true };
      const modifyResponse = {
        success: true,
        data: {
          email: "user@example.com",
          firstName: "John",
          userName: "johnDoe",
        },
      };

      AccessTokenModelMock = (tenant) => ({
        list: sinon.stub().resolves({ success: true, status: 200 }),
        remove: sinon.stub().resolves({ success: true }),
      });

      UserModelMock = (tenant) => ({
        modify: sinon.stub().resolves(modifyResponse),
      });

      const mailerAfterEmailVerificationStub = sinon
        .stub()
        .resolves({ success: true });

      const result =
        await verifyVerificationTokenFunction.verifyVerificationToken(
          requestMock,
          AccessTokenModelMock,
          UserModelMock,
          mailerAfterEmailVerificationStub,
          generateStub
        );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(200);
      expect(mailerAfterEmailVerificationStub.calledOnce).to.be.true;
    });

    // Additional tests for other scenarios
  });
  describe("getUserAction()", () => {
    it('should return "update operation" for PUT()', () => {
      const headers = { "x-original-method": "PUT" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("update operation");
    });

    it('should return "delete operation" for DELETE()', () => {
      const headers = { "x-original-method": "DELETE" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("delete operation");
    });

    it('should return "creation operation" for POST()', () => {
      const headers = { "x-original-method": "POST" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("creation operation");
    });

    it('should return "Unknown Action" for unknown()', () => {
      const headers = { "x-original-method": "UNKNOWN" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("Unknown Action");
    });

    it('should return "Unknown Action" for missing()', () => {
      const headers = {};
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("Unknown Action");
    });
  });
  describe("getService()", () => {
    const routeDefinitions = [
      // Define your route definitions here
      // Example: { uri: '/api/v1/users', service: 'auth' }
    ];

    it("should return the correct service based on URI", () => {
      const headers = { "x-original-uri": "/api/v1/users" };
      const result = getServiceFunction.getService(headers, routeDefinitions);
      expect(result).to.equal("auth");
    });

    it("should return the correct service based on uriEndsWith", () => {
      const headers = { "x-original-uri": "/api/v1/devices/sites" };
      const result = getServiceFunction.getService(headers, routeDefinitions);
      expect(result).to.equal("site-registry");
    });

    it("should return the correct service based on uriIncludes", () => {
      const headers = { "x-original-uri": "/api/v2/incentives/details" };
      const result = getServiceFunction.getService(headers, routeDefinitions);
      expect(result).to.equal("incentives");
    });

    it("should return the correct service from serviceHeader", () => {
      const headers = { service: "custom-service" };
      const result = getServiceFunction.getService(headers, routeDefinitions);
      expect(result).to.equal("custom-service");
    });

    it('should return "unknown" for unknown URI and missing serviceHeader', () => {
      const headers = {};
      const result = getServiceFunction.getService(headers, routeDefinitions);
      expect(result).to.equal("unknown");
    });
  });
  describe("routeDefinitions()", () => {
    it("should correctly match uri for events-registry", () => {
      const route = routeDefinitions.find(
        (route) => route.uri && route.uri.includes("/api/v2/devices/events")
      );
      expect(route.service).to.equal("events-registry");
    });

    it("should correctly match uriIncludes for site-registry", () => {
      const route = routeDefinitions.find(
        (route) =>
          route.uriIncludes &&
          route.uriIncludes.some((suffix) => suffix === "/api/v2/devices/sites")
      );
      expect(route.service).to.equal("site-registry");
    });

    // Add similar tests for other route definitions
  });
  // Add more test cases for other()s in the controlAccess object
});
