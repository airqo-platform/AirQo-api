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

describe("controlAccess", () => {
  describe("verifyEmail method", () => {
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

      // Mock the response from AccessTokenModel list method
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

      // Mock the response from UserModel modify method
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

      // Mock the response from AccessTokenModel remove method
      const deleteTokenResponse = {
        success: true,
        status: httpStatus.OK,
        data: "Token deleted",
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(deleteTokenResponse);

      // Mock the response from mailer afterEmailVerification method
      const sendEmailResponse = {
        success: true,
        message: "Email sent successfully",
        status: httpStatus.OK,
      };
      sinon.stub(mailer, "afterEmailVerification").resolves(sendEmailResponse);

      // Call the verifyEmail method
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

      // Mock the response from AccessTokenModel list method
      const listAccessTokenResponse = {
        success: true,
        status: httpStatus.NOT_FOUND,
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(listAccessTokenResponse);

      // Call the verifyEmail method
      const result = await controlAccess.verifyEmail(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid link");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("hash method", () => {
    it("should hash the input string and return the hashed value", () => {
      const inputString = "sample_password";

      // Call the hash method
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

      // Call the hash method
      const result = () => controlAccess.hash(inputString);

      // Verify that the function does not throw an error
      expect(result).to.not.throw();
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("hash_compare method", () => {
    it("should return true when comparing the same items", () => {
      const firstItem = "sample";
      const secondItem = "sample";

      // Call the hash_compare method
      const result = controlAccess.hash_compare(firstItem, secondItem);

      // Verify the result
      expect(result).to.be.true;
    });

    it("should return false when comparing different items", () => {
      const firstItem = "sample1";
      const secondItem = "sample2";

      // Call the hash_compare method
      const result = controlAccess.hash_compare(firstItem, secondItem);

      // Verify the result
      expect(result).to.be.false;
    });

    it("should not throw an error when comparing items", () => {
      const firstItem = "sample";
      const secondItem = "sample";

      // Call the hash_compare method
      const result = () => controlAccess.hash_compare(firstItem, secondItem);

      // Verify that the function does not throw an error
      expect(result).to.not.throw();
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateAccessToken method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should update access token and return success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add properties for the update here
        },
      };

      // Mock the response from generateFilter.tokens method
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel modify method
      const responseFromUpdateToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add updated token data here
        },
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateAccessToken method
      const result = await controlAccess.updateAccessToken(request);

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
        body: {
          // Add properties for the update here
        },
      };

      // Mock the response from generateFilter.tokens method with failure
      const responseFromFilter = {
        success: false,
        message: "Invalid input",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Call the updateAccessToken method
      const result = await controlAccess.updateAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Invalid input");
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from AccessTokenModel.modify and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          // Add properties for the update here
        },
      };

      // Mock the response from generateFilter.tokens method
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel.modify method with failure
      const responseFromUpdateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateAccessToken method
      const result = await controlAccess.updateAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteAccessToken method", () => {
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

      // Mock the response from generateFilter.tokens method
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel remove method
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: "Token deleted",
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteAccessToken method
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

      // Mock the response from generateFilter.tokens method with failure
      const responseFromFilter = {
        success: false,
        message: "Invalid input",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Call the deleteAccessToken method
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

      // Mock the response from generateFilter.tokens method
      const responseFromFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromFilter);

      // Mock the response from AccessTokenModel.remove method with failure
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteAccessToken method
      const result = await controlAccess.deleteAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listAccessToken method", () => {
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

      // Mock the response from generateFilter.tokens method
      const responseFromGenerateFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Mock the response from AccessTokenModel list method
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

      // Call the listAccessToken method
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

      // Mock the response from generateFilter.tokens method with failure
      const responseFromGenerateFilter = {
        success: false,
        message: "Invalid input",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Call the listAccessToken method
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

      // Mock the response from generateFilter.tokens method
      const responseFromGenerateFilter = {
        success: true,
        filter: {
          // Add filter properties here
        },
      };
      sinon.stub(generateFilter, "tokens").returns(responseFromGenerateFilter);

      // Mock the response from AccessTokenModel.list method with failure
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listAccessToken method
      const result = await controlAccess.listAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createAccessToken method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should create an access token and return success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_id: "user123",
          // Add other properties for the body here
        },
      };

      // Mock the response from UserModel exists method
      const userExists = true;
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(userExists);

      // Mock the response from ClientModel register method
      const responseFromCreateClient = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          client_id: "client123",
          client_secret: "secret123",
        },
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromCreateClient);

      // Mock the response from AccessTokenModel register method
      const responseFromCreateToken = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          token: "token123",
          // Add other properties for the access token here
        },
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createAccessToken method
      const result = await controlAccess.createAccessToken(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      // Add more expectations as needed based on the response structure
    });

    it("should handle invalid user ID and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_id: "invalid_user",
          // Add other properties for the body here
        },
      };

      // Mock the response from UserModel exists method
      const userExists = false;
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(userExists);

      // Call the createAccessToken method
      const result = await controlAccess.createAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("User not found");
      // Add more expectations as needed based on the response structure
    });

    it("should handle error from AccessTokenModel register and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_id: "user123",
          // Add other properties for the body here
        },
      };

      // Mock the response from UserModel exists method
      const userExists = true;
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(userExists);

      // Mock the response from ClientModel register method
      const responseFromCreateClient = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          client_id: "client123",
          client_secret: "secret123",
        },
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromCreateClient);

      // Mock the response from AccessTokenModel register method with failure
      const responseFromCreateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createAccessToken method
      const result = await controlAccess.createAccessToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("generateVerificationToken method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should generate a verification token and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          email: "john.doe@example.com",
          // Add other properties for the body here
        },
      };

      // Mock the response from UserModel register method
      const responseFromCreateUser = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          _id: "user123",
          // Add other properties for the user here
        },
      };
      sinon
        .stub(UserModel("sample_tenant"), "register")
        .resolves(responseFromCreateUser);

      // Mock the response from ClientModel register method
      const responseFromSaveClient = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          _id: "client123",
          // Add other properties for the client here
        },
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromSaveClient);

      // Mock the response from AccessTokenModel register method
      const responseFromSaveToken = {
        success: true,
        status: httpStatus.CREATED,
        data: {
          token: "token123",
          // Add other properties for the access token here
        },
      };
      sinon
        .stub(AccessTokenModel("sample_tenant"), "register")
        .resolves(responseFromSaveToken);

      // Mock the response from mailer verifyEmail method
      const responseFromSendEmail = {
        success: true,
        status: httpStatus.OK,
        // Add other properties for the email response here
      };
      sinon.stub(mailer, "verifyEmail").resolves(responseFromSendEmail);

      // Call the generateVerificationToken method
      const result = await controlAccess.generateVerificationToken(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      // Add more expectations as needed based on the response structure
    });

    it("should handle invalid user ID and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        body: {
          email: "invalid_user@example.com",
          // Add other properties for the body here
        },
      };

      // Mock the response from UserModel register method
      const responseFromCreateUser = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        // Add other error properties here
      };
      sinon
        .stub(UserModel("sample_tenant"), "register")
        .resolves(responseFromCreateUser);

      // Call the generateVerificationToken method
      const result = await controlAccess.generateVerificationToken(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateClient method", () => {
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel modify method
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

      // Call the updateClient method
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel modify method
      const responseFromUpdateToken = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateClient method
      const result = await controlAccess.updateClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      // Add more expectations as needed based on the response structure
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteClient method", () => {
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel remove method
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: "Client deleted",
      };
      sinon
        .stub(ClientModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteClient method
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel remove method
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteClient method
      const result = await controlAccess.deleteClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listClient method", () => {
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel list method
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

      // Call the listClient method
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

      // Mock the response from generateFilter.clients method
      const responseFromFilter = {
        success: true,
        // Add properties for the filter response here
      };
      sinon.stub(generateFilter, "clients").returns(responseFromFilter);

      // Mock the response from ClientModel list method
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listClient method
      const result = await controlAccess.listClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createClient method", () => {
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
          // Add client data here as required by the function
        },
      };

      // Mock the response from the accessCodeGenerator.generate method for client_id
      const client_id = "mocked_client_id"; // Replace this with a random generated client_id
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .returns(client_id);

      // Mock the response from the accessCodeGenerator.generate method for client_secret
      const client_secret = "mocked_client_secret"; // Replace this with a random generated client_secret
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        )
        .returns(client_secret);

      // Mock the response from the ClientModel register method
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

      // Call the createClient method
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
          // Add client data here as required by the function
        },
      };

      // Mock the response from the accessCodeGenerator.generate method for client_id
      const client_id = "mocked_client_id"; // Replace this with a random generated client_id
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(constants.CLIENT_ID_LENGTH)
        )
        .returns(client_id);

      // Mock the response from the accessCodeGenerator.generate method for client_secret
      const client_secret = "mocked_client_secret"; // Replace this with a random generated client_secret
      sinon
        .stub(accessCodeGenerator, "generate")
        .withArgs(
          constants.RANDOM_PASSWORD_CONFIGURATION(
            constants.CLIENT_SECRET_LENGTH
          )
        )
        .returns(client_secret);

      // Mock the response from the ClientModel register method
      const responseFromCreateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ClientModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createClient method
      const result = await controlAccess.createClient(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateScope method", () => {
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
          // Add updated scope data here as required by the function
        },
      };

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel modify method
      const responseFromUpdateToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add updated scope data here as returned by the modify method
        },
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateScope method
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
          // Add updated scope data here as required by the function
        },
      };

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel modify method
      const responseFromUpdateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateToken);

      // Call the updateScope method
      const result = await controlAccess.updateScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteScope method", () => {
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

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel remove method
      const responseFromDeleteToken = {
        success: true,
        status: httpStatus.OK,
        data: {
          // Add deleted scope data here as returned by the remove method
        },
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteScope method
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

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel remove method
      const responseFromDeleteToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteToken);

      // Call the deleteScope method
      const result = await controlAccess.deleteScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listScope method", () => {
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

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel list method
      const responseFromListToken = {
        success: true,
        status: httpStatus.OK,
        data: [
          // Add mock list of scopes here as returned by the list method
        ],
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listScope method
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

      // Mock the response from the generateFilter.scopes method
      const responseFromFilter = {
        success: true,
        // Add mock filter data here
      };
      sinon.stub(generateFilter, "scopes").resolves(responseFromFilter);

      // Mock the response from the ScopeModel list method
      const responseFromListToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "list")
        .resolves(responseFromListToken);

      // Call the listScope method
      const result = await controlAccess.listScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createScope method", () => {
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

      // Mock the response from the ScopeModel register method
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

      // Call the createScope method
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

      // Mock the response from the ScopeModel register method
      const responseFromCreateToken = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(ScopeModel("sample_tenant"), "register")
        .resolves(responseFromCreateToken);

      // Call the createScope method
      const result = await controlAccess.createScope(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listRole method", () => {
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

      // Mock the response from the generateFilter.roles method
      const filter = {
        // Add the mock filter data here
      };
      sinon.stub(generateFilter, "roles").returns(filter);

      // Mock the response from the RoleModel list method
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

      // Call the listRole method
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

      // Mock the response from the generateFilter.roles method
      const filterError = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Invalid filter",
        // Add other error properties here
      };
      sinon.stub(generateFilter, "roles").returns(filterError);

      // Call the listRole method
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

      // Mock the response from the generateFilter.roles method
      const filter = {
        // Add the mock filter data here
      };
      sinon.stub(generateFilter, "roles").returns(filter);

      // Mock the response from the RoleModel list method
      const responseFromListRole = {
        success: false,
        status: httpStatus.INTERNAL_SERVER_ERROR,
        message: "Internal Server Error",
        // Add other error properties here
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListRole);

      // Call the listRole method
      const result = await controlAccess.listRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listRolesForNetwork method", () => {
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

      // Mock the response from the NetworkModel findById method
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate method
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

      // Call the listRolesForNetwork method
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

      // Mock the response from the NetworkModel findById method
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(null);

      // Call the listRolesForNetwork method
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

      // Mock the response from the NetworkModel findById method
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate method (empty result)
      const roleResponse = [];
      sinon
        .stub(RoleModel("sample_tenant"), "aggregate")
        .resolves(roleResponse);

      // Call the listRolesForNetwork method
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

      // Mock the response from the NetworkModel findById method
      const network = {
        _id: "network123",
        // Add other properties of the network
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel aggregate method (error)
      sinon
        .stub(RoleModel("sample_tenant"), "aggregate")
        .throws(new Error("Database Error"));

      // Call the listRolesForNetwork method
      const result = await controlAccess.listRolesForNetwork(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("deleteRole method", () => {
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

      // Mock the response from the RoleModel remove method
      const responseFromDeleteRole = {
        success: true,
        message: "Role deleted successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteRole);

      // Call the deleteRole method
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

      // Mock the response from the RoleModel remove method
      const responseFromDeleteRole = {
        success: false,
        message: "Role not found",
        status: httpStatus.BAD_REQUEST,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .resolves(responseFromDeleteRole);

      // Call the deleteRole method
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

      // Mock the response from the RoleModel remove method (error)
      sinon
        .stub(RoleModel("sample_tenant"), "remove")
        .throws(new Error("Database Error"));

      // Call the deleteRole method
      const result = await controlAccess.deleteRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("updateRole method", () => {
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

      // Mock the response from the RoleModel modify method
      const responseFromUpdateRole = {
        success: true,
        message: "Role updated successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateRole);

      // Call the updateRole method
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

      // Mock the response from the RoleModel modify method
      const responseFromUpdateRole = {
        success: false,
        message: "Role not found",
        status: httpStatus.BAD_REQUEST,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .resolves(responseFromUpdateRole);

      // Call the updateRole method
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

      // Mock the response from the RoleModel modify method (error)
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .throws(new Error("Database Error"));

      // Call the updateRole method
      const result = await controlAccess.updateRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("createRole method", () => {
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

      // Mock the response from the NetworkModel findById method
      const network = {
        net_name: "sample_network",
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel register method
      const responseFromCreateRole = {
        success: true,
        message: "Role created successfully",
        // Add other properties of the response
      };
      sinon
        .stub(RoleModel("sample_tenant"), "register")
        .resolves(responseFromCreateRole);

      // Call the createRole method
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

      // Mock the response from the NetworkModel findById method (network not found)
      const network = {};
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Call the createRole method
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

      // Mock the response from the NetworkModel findById method
      const network = {
        net_name: "sample_network",
      };
      sinon.stub(NetworkModel("sample_tenant"), "findById").resolves(network);

      // Mock the response from the RoleModel register method (error)
      sinon
        .stub(RoleModel("sample_tenant"), "register")
        .throws(new Error("Database Error"));

      // Call the createRole method
      const result = await controlAccess.createRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("listAvailableUsersForRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list available users for the role and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
      };

      // Mock the response from the RoleModel findById method
      const role = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(role);

      // Mock the response from the UserModel aggregate method
      const responseFromListAvailableUsers = [
        {
          _id: "sample_user_id",
          email: "sample_user@example.com",
          firstName: "Sample",
          lastName: "User",
          createdAt: "2023-07-25 12:34:56", // Sample date format
          userName: "sample_user",
        },
        // Add more sample user data
      ];
      sinon
        .stub(UserModel("sample_tenant"), "aggregate")
        .resolves(responseFromListAvailableUsers);

      // Call the listAvailableUsersForRole method
      const result = await controlAccess.listAvailableUsersForRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        `retrieved all available users for the role sample_role_id`
      );
      expect(result.data).to.deep.equal(responseFromListAvailableUsers);
    });

    it("should handle invalid role ID and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          role_id: "invalid_role_id",
        },
      };

      // Mock the response from the RoleModel findById method (role not found)
      const role = null;
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(role);

      // Call the listAvailableUsersForRole method
      const result = await controlAccess.listAvailableUsersForRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Invalid role ID invalid_role_id, please crosscheck"
      );
    });

    it("should handle errors in listing available users and return failure response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        params: {
          role_id: "sample_role_id",
        },
      };

      // Mock the response from the RoleModel findById method
      const role = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(role);

      // Mock the response from the UserModel aggregate method (error)
      sinon
        .stub(UserModel("sample_tenant"), "aggregate")
        .throws(new Error("Database Error"));

      // Call the listAvailableUsersForRole method
      const result = await controlAccess.listAvailableUsersForRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("assignUserToRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should assign user to role and send success response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user: "sample_user_id",
        },
      };

      // Mock the response from the UserModel exists method (user exists)
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the RoleModel exists method (role exists)
      sinon.stub(RoleModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the UserModel findByIdAndUpdate method
      const updatedUser = {
        // Add necessary updated user data
      };
      sinon
        .stub(UserModel("sample_tenant"), "findByIdAndUpdate")
        .resolves(updatedUser);

      // Call the assignUserToRole method
      const result = await controlAccess.assignUserToRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.message).to.equal("User assigned to the Role");
      expect(result.data).to.deep.equal(updatedUser);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should handle invalid user ID and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "invalid_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user: "sample_user_id",
        },
      };

      // Mock the response from the UserModel exists method (user does not exist)
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(false);

      // Call the assignUserToRole method
      const result = await controlAccess.assignUserToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("User or Role not found");
      expect(result.errors.message).to.equal(
        "User invalid_user_id or Role sample_role_id not found"
      );
    });

    it("should handle invalid role ID and return failure response", async () => {
      const request = {
        params: {
          role_id: "invalid_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user: "sample_user_id",
        },
      };

      // Mock the response from the UserModel exists method (user exists)
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the RoleModel exists method (role does not exist)
      sinon.stub(RoleModel("sample_tenant"), "exists").resolves(false);

      // Call the assignUserToRole method
      const result = await controlAccess.assignUserToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("User or Role not found");
      expect(result.errors.message).to.equal(
        "User sample_user_id or Role invalid_role_id not found"
      );
    });

    it("should handle existing user already assigned to the role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user: "sample_user_id",
        },
      };

      // Mock the response from the UserModel exists method (user exists)
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the RoleModel exists method (role exists)
      sinon.stub(RoleModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the UserModel findById method (user with role already assigned)
      const userWithRole = {
        role: {
          _id: "sample_role_id",
          role_name: "sample_role_name",
        },
        // Add necessary user data
      };
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(userWithRole);

      // Call the assignUserToRole method
      const result = await controlAccess.assignUserToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Role sample_role_id already assigned to User sample_user_id"
      );
    });

    it("should handle assigning role to SUPER_ADMIN user and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user: "sample_user_id",
        },
      };

      // Mock the response from the UserModel exists method (user exists)
      sinon.stub(UserModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the RoleModel exists method (role exists)
      sinon.stub(RoleModel("sample_tenant"), "exists").resolves(true);

      // Mock the response from the UserModel findById method (SUPER_ADMIN user)
      const superAdminUser = {
        role: {
          _id: "sample_super_admin_role_id",
          role_name: "SUPER_ADMIN",
        },
        // Add necessary user data
      };
      sinon
        .stub(UserModel("sample_tenant"), "findById")
        .resolves(superAdminUser);

      // Call the assignUserToRole method
      const result = await controlAccess.assignUserToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "SUPER ADMIN user sample_user_id can not be reassigned to a different role"
      );
    });

    // Add more test cases for different scenarios and edge cases
  });
  describe("assignManyUsersToRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should assign many users to role and send success response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (users exist)
      const users = [
        {
          _id: "user_id_1",
          role: null, // User does not have a role
          // Add necessary user data
        },
        {
          _id: "user_id_2",
          role: {
            _id: "user_id_2_role_id",
            role_name: "sample_role_name",
          }, // User already has a role
          // Add necessary user data
        },
        {
          _id: "user_id_3",
          role: {
            _id: "user_id_3_super_admin_role_id",
            role_name: "SUPER_ADMIN",
          }, // SUPER_ADMIN user
          // Add necessary user data
        },
      ];
      sinon.stub(UserModel("sample_tenant"), "findById").callsFake((userId) => {
        return Promise.resolve(users.find((user) => user._id === userId));
      });

      // Mock the response from the UserModel updateMany method
      const nModified = 2; // Number of users modified
      sinon
        .stub(UserModel("sample_tenant"), "updateMany")
        .resolves({ nModified });

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal(
        "All provided users were successfully assigned."
      );
    });

    it("should handle assigning SUPER_ADMIN user to role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (users exist)
      const users = [
        {
          _id: "user_id_3",
          role: {
            _id: "user_id_3_super_admin_role_id",
            role_name: "SUPER_ADMIN",
          }, // SUPER_ADMIN user
          // Add necessary user data
        },
      ];
      sinon.stub(UserModel("sample_tenant"), "findById").callsFake((userId) => {
        return Promise.resolve(users.find((user) => user._id === userId));
      });

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "SUPER ADMIN user user_id_3 can not be reassigned to a different role"
      );
    });

    it("should handle assigning users who are already assigned to the role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_2"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (users exist)
      const users = [
        {
          _id: "user_id_2",
          role: {
            _id: "sample_role_id",
            role_name: "sample_role_name",
          }, // User already has the role
          // Add necessary user data
        },
      ];
      sinon.stub(UserModel("sample_tenant"), "findById").callsFake((userId) => {
        return Promise.resolve(users.find((user) => user._id === userId));
      });

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "User user_id_2 is already assigned to the role sample_role_id"
      );
    });

    it("should handle assigning users who do not exist and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_not_found"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (user does not exist)
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(null);

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("One of the Users does not exist");
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        params: {
          role_id: "role_id_not_found",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role not found)
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(null);

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Role role_id_not_found does not exist"
      );
    });

    it("should handle UserModel updateMany failure and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (users exist)
      const users = [
        {
          _id: "user_id_1",
          role: null, // User does not have a role
          // Add necessary user data
        },
        {
          _id: "user_id_2",
          role: null, // User does not have a role
          // Add necessary user data
        },
        {
          _id: "user_id_3",
          role: null, // User does not have a role
          // Add necessary user data
        },
      ];
      sinon.stub(UserModel("sample_tenant"), "findById").callsFake((userId) => {
        return Promise.resolve(users.find((user) => user._id === userId));
      });

      // Mock the response from the UserModel updateMany method (failure)
      sinon
        .stub(UserModel("sample_tenant"), "updateMany")
        .resolves({ nModified: 0 });

      // Call the assignManyUsersToRole method
      const result = await controlAccess.assignManyUsersToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal(
        "Could not assign all provided users to the Role."
      );
    });
  });
  describe("listUsersWithRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list assigned users for the role and send success response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel aggregate method (assigned users exist)
      const assignedUsers = [
        {
          _id: "user_id_1",
          email: "user1@example.com",
          firstName: "John",
          lastName: "Doe",
          userName: "john.doe",
        },
        {
          _id: "user_id_2",
          email: "user2@example.com",
          firstName: "Jane",
          lastName: "Smith",
          userName: "jane.smith",
        },
      ];
      sinon
        .stub(UserModel("sample_tenant"), "aggregate")
        .resolves(assignedUsers);

      // Call the listUsersWithRole method
      const result = await controlAccess.listUsersWithRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal(
        "retrieved all assigned users for role sample_role_id"
      );
      expect(result.data).to.deep.equal(assignedUsers);
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        params: {
          role_id: "role_id_not_found",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role not found)
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(null);

      // Call the listUsersWithRole method
      const result = await controlAccess.listUsersWithRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Invalid role ID role_id_not_found, please crosscheck"
      );
    });

    it("should handle UserModel aggregate failure and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel aggregate method (failure)
      sinon
        .stub(UserModel("sample_tenant"), "aggregate")
        .rejects(new Error("Aggregate Error"));

      // Call the listUsersWithRole method
      const result = await controlAccess.listUsersWithRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });
  });
  describe("unAssignUserFromRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should unassign user from the role and send success response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findByIdAndUpdate method (user updated)
      const updatedUser = {
        _id: "sample_user_id",
        email: "sample_user@example.com",
        firstName: "John",
        lastName: "Doe",
        role: null,
      };
      sinon
        .stub(UserModel("sample_tenant"), "findByIdAndUpdate")
        .resolves(updatedUser);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal("User unassigned from the role");
      expect(result.data).to.deep.equal(updatedUser);
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        params: {
          role_id: "role_id_not_found",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role not found)
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(null);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Role role_id_not_found does not exist"
      );
    });

    it("should handle user not found and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "user_id_not_found",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (user not found)
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(null);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "provided User user_id_not_found does not exist"
      );
    });

    it("should handle user being a SUPER_ADMIN and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (user is SUPER_ADMIN)
      const userObject = {
        _id: "sample_user_id",
        email: "sample_user@example.com",
        firstName: "John",
        lastName: "Doe",
        role: {
          _id: "role_id",
          role_name: "SUPER_ADMIN",
        },
      };
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(userObject);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "SUPER_ADMIN User sample_user_id may not be unassigned from their role"
      );
    });

    it("should handle user not being assigned to any role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (user is not assigned to any role)
      const userObject = {
        _id: "sample_user_id",
        email: "sample_user@example.com",
        firstName: "John",
        lastName: "Doe",
        role: null,
      };
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(userObject);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "User is not assigned to any role"
      );
    });

    it("should handle user not being assigned to the specified role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findById method (user assigned to a different role)
      const userObject = {
        _id: "sample_user_id",
        email: "sample_user@example.com",
        firstName: "John",
        lastName: "Doe",
        role: {
          _id: "different_role_id",
          role_name: "OTHER_ROLE",
        },
      };
      sinon.stub(UserModel("sample_tenant"), "findById").resolves(userObject);

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "User sample_user_id is not assigned to the role sample_role_id"
      );
    });

    it("should handle UserModel findByIdAndUpdate failure and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
          user_id: "sample_user_id",
        },
        query: {
          tenant: "sample_tenant",
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel findByIdAndUpdate method (failure)
      sinon
        .stub(UserModel("sample_tenant"), "findByIdAndUpdate")
        .rejects(new Error("Update Error"));

      // Call the unAssignUserFromRole method
      const result = await controlAccess.unAssignUserFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
    });
  });
  describe("unAssignManyUsersFromRole method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should unassign multiple users from the role and send success response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel find method (existing users)
      const existingUsers = [
        { _id: "user_id_1" },
        { _id: "user_id_2" },
        { _id: "user_id_3" },
      ];
      sinon.stub(UserModel("sample_tenant"), "find").resolves(existingUsers);

      // Mock the response from the UserModel updateMany method (users unassigned)
      const updateResult = { nModified: 3 };
      sinon
        .stub(UserModel("sample_tenant"), "updateMany")
        .resolves(updateResult);

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal(
        "All provided users were successfully unassigned."
      );
    });

    it("should handle role not found and return failure response", async () => {
      const request = {
        params: {
          role_id: "role_id_not_found",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2"],
        },
      };

      // Mock the response from the RoleModel findById method (role not found)
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(null);

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Role not found");
    });

    it("should handle some users not existing and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel find method (some users do not exist)
      const existingUsers = [{ _id: "user_id_1" }];
      sinon.stub(UserModel("sample_tenant"), "find").resolves(existingUsers);

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "The following users do not exist: user_id_2,user_id_3"
      );
    });

    it("should handle some users not assigned to the role and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel find method (existing users)
      const existingUsers = [
        { _id: "user_id_1", role: ["different_role_id"] },
        { _id: "user_id_2", role: ["different_role_id"] },
        { _id: "user_id_3", role: ["different_role_id"] },
      ];
      sinon.stub(UserModel("sample_tenant"), "find").resolves(existingUsers);

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Some of the provided User IDs are not assigned to this role sample_role_id"
      );
    });

    it("should handle SUPER_ADMIN user and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["super_admin_user_id"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel find method (SUPER_ADMIN user)
      const existingUsers = [
        { _id: "super_admin_user_id", role: { role_name: "SUPER_ADMIN" } },
      ];
      sinon.stub(UserModel("sample_tenant"), "find").resolves(existingUsers);

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal(
        "Cannot unassign SUPER_ADMIN role from user super_admin_user_id"
      );
    });

    it("should handle UserModel updateMany failure and return failure response", async () => {
      const request = {
        params: {
          role_id: "sample_role_id",
        },
        query: {
          tenant: "sample_tenant",
        },
        body: {
          user_ids: ["user_id_1", "user_id_2", "user_id_3"],
        },
      };

      // Mock the response from the RoleModel findById method (role exists)
      const roleObject = {
        // Add necessary role data
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleObject);

      // Mock the response from the UserModel find method (existing users)
      const existingUsers = [
        { _id: "user_id_1" },
        { _id: "user_id_2" },
        { _id: "user_id_3" },
      ];
      sinon.stub(UserModel("sample_tenant"), "find").resolves(existingUsers);

      // Mock the UserModel updateMany method (failure)
      sinon
        .stub(UserModel("sample_tenant"), "updateMany")
        .rejects(new Error("Update Error"));

      // Call the unAssignManyUsersFromRole method
      const result = await controlAccess.unAssignManyUsersFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal(
        "Could not unassign all users from role."
      );
    });
  });
  describe("listPermissionsForRole method", () => {
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

      // Mock the response from the PermissionModel list method (permissions found)
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

      // Call the listPermissionsForRole method
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

      // Mock the response from the PermissionModel list method (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .rejects(new Error("List Error"));

      // Call the listPermissionsForRole method
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

      // Mock the response from the PermissionModel list method (unsuccessful response)
      const responseFromlistPermissionsForRole = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        errors: { message: "Invalid role ID" },
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "list")
        .resolves(responseFromlistPermissionsForRole);

      // Call the listPermissionsForRole method
      const result = await controlAccess.listPermissionsForRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Invalid role ID");
    });
  });
  describe("listAvailablePermissionsForRole method", () => {
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

      // Mock the response from generateFilter.roles method
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list method (roles found)
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

      // Mock the response from the PermissionModel list method (permissions found)
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

      // Call the listAvailablePermissionsForRole method
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

      // Mock the response from generateFilter.roles method (failure)
      const filterResponse = {
        success: false,
        message: "Filter generation failed",
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Call the listAvailablePermissionsForRole method
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

      // Mock the response from generateFilter.roles method
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .rejects(new Error("List Error"));

      // Call the listAvailablePermissionsForRole method
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

      // Mock the response from generateFilter.roles method
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list method (unsuccessful response)
      const responseFromListAvailablePermissionsForRole = {
        success: false,
        status: httpStatus.BAD_REQUEST,
        message: "Bad Request Error",
        errors: { message: "Role not found" },
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListAvailablePermissionsForRole);

      // Call the listAvailablePermissionsForRole method
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

      // Mock the response from generateFilter.roles method
      const filterResponse = {
        success: true,
        filter: { role_id: "sample_role_id" },
      };
      sinon.stub(generateFilter, "roles").returns(filterResponse);

      // Mock the response from the RoleModel list method (roles found, but no permissions)
      const roleData = [{ _id: "sample_role_id", role_permissions: [] }];
      const responseFromListAvailablePermissionsForRole = {
        success: true,
        status: httpStatus.OK,
        data: roleData,
      };
      sinon
        .stub(RoleModel("sample_tenant"), "list")
        .resolves(responseFromListAvailablePermissionsForRole);

      // Call the listAvailablePermissionsForRole method
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
  describe("assignPermissionsToRole method", () => {
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOneAndUpdate method (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3", "permission_1", "permission_2"],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "findOneAndUpdate")
        .resolves(updatedRoleData);

      // Call the assignPermissionsToRole method
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

      // Mock the response from the RoleModel findById method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the assignPermissionsToRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permissions not found"));

      // Call the assignPermissionsToRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_1", "permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Call the assignPermissionsToRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [{ _id: "permission_1" }, { _id: "permission_2" }];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOneAndUpdate method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findOneAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the assignPermissionsToRole method
      const result = await controlAccess.assignPermissionsToRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("unable to update Role");
    });
  });
  describe("unAssignPermissionFromRole method", () => {
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById method (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne method (role and permission association found)
      const roleResponse = {
        _id: "sample_role_id",
        role_permissions: ["sample_permission_id"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(roleResponse);

      // Mock the response from the RoleModel modify method (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_1", "permission_3"],
      };
      sinon.stub(RoleModel("sample_tenant"), "modify").resolves({
        success: true,
        message: "successfully modified the Permission",
      });

      // Call the unAssignPermissionFromRole method
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

      // Mock the response from the RoleModel findById method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the unAssignPermissionFromRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById method (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .rejects(new Error("Permission not found"));

      // Call the unAssignPermissionFromRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById method (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne method (failure)
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(null);

      // Call the unAssignPermissionFromRole method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: [
          "permission_1",
          "sample_permission_id",
          "permission_3",
        ],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel findById method (permission found)
      const permissionData = {
        _id: "sample_permission_id",
      };
      sinon
        .stub(PermissionModel("sample_tenant"), "findById")
        .resolves(permissionData);

      // Mock the response from the RoleModel findOne method (role and permission association found)
      const roleResponse = {
        _id: "sample_role_id",
        role_permissions: ["sample_permission_id"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findOne").resolves(roleResponse);

      // Mock the response from the RoleModel modify method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "modify")
        .rejects(new Error("Failed to modify role"));

      // Call the unAssignPermissionFromRole method
      const result = await controlAccess.unAssignPermissionFromRole(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.message).to.equal("Bad Request Error");
      expect(result.errors.message).to.equal("Internal Server Error");
    });
  });
  describe("unAssignManyPermissionsFromRole method", () => {
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

      // Mock the response from the RoleModel findById method (role found)
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

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate method (role updated)
      const updatedRoleData = {
        _id: "sample_role_id",
        role_permissions: ["permission_id_1", "permission_id_3"],
      };
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .resolves(updatedRoleData);

      // Call the unAssignManyPermissionsFromRole method
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

      // Mock the response from the RoleModel findById method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the unAssignManyPermissionsFromRole method
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

      // Mock the response from the RoleModel findById method (role found)
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

      // Mock the response from the PermissionModel find method (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permission not found"));

      // Call the unAssignManyPermissionsFromRole method
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

      // Mock the response from the RoleModel findById method (role found)
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

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the unAssignManyPermissionsFromRole method
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
  describe("updateRolePermissions method", () => {
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate method (role updated)
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

      // Call the updateRolePermissions method
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

      // Mock the response from the RoleModel findById method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findById")
        .rejects(new Error("Role not found"));

      // Call the updateRolePermissions method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (failure)
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .rejects(new Error("Permission not found"));

      // Call the updateRolePermissions method
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

      // Mock the response from the RoleModel findById method (role found)
      const roleData = {
        _id: "sample_role_id",
        role_permissions: ["old_permission_id_1", "old_permission_id_2"],
      };
      sinon.stub(RoleModel("sample_tenant"), "findById").resolves(roleData);

      // Mock the response from the PermissionModel find method (permissions found)
      const permissionData = [
        { _id: "permission_id_1" },
        { _id: "permission_id_2" },
        { _id: "permission_id_3" },
      ];
      sinon
        .stub(PermissionModel("sample_tenant"), "find")
        .resolves(permissionData);

      // Mock the response from the RoleModel findByIdAndUpdate method (failure)
      sinon
        .stub(RoleModel("sample_tenant"), "findByIdAndUpdate")
        .rejects(new Error("Failed to update role"));

      // Call the updateRolePermissions method
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
  describe("listPermission method", () => {
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

      // Mock the response from the PermissionModel list method (permissions found)
      const permissionData = [
        { _id: "permission_id_1", permission: "permission_1" },
        { _id: "permission_id_2", permission: "permission_2" },
      ];
      sinon.stub(PermissionModel("sample_tenant"), "list").resolves({
        success: true,
        data: permissionData,
      });

      // Call the listPermission method
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

      // Mock the response from the PermissionModel list method (failure)
      sinon.stub(PermissionModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to fetch permissions",
      });

      // Call the listPermission method
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

      // Mock the response from the generateFilter.permissions method (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the listPermission method
      const result = await controlAccess.listPermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("deletePermission method", () => {
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

      // Mock the response from the PermissionModel remove method (success)
      sinon.stub(PermissionModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Permission deleted successfully",
      });

      // Mock the response from the generateFilter.permissions method
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission method
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

      // Mock the response from the PermissionModel remove method (failure)
      sinon.stub(PermissionModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete permission",
      });

      // Mock the response from the generateFilter.permissions method
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission method
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

      // Mock the response from the generateFilter.permissions method (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the deletePermission method
      const result = await controlAccess.deletePermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("updatePermission method", () => {
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

      // Mock the response from the PermissionModel modify method (success)
      sinon.stub(PermissionModel("sample_tenant"), "modify").resolves({
        success: true,
        message: "Permission updated successfully",
      });

      // Mock the response from the generateFilter.permissions method
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission method
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

      // Mock the response from the PermissionModel modify method (failure)
      sinon.stub(PermissionModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update permission",
      });

      // Mock the response from the generateFilter.permissions method
      const filterResponse = { success: true, permission_id: "permission_id" };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission method
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

      // Mock the response from the generateFilter.permissions method (failure)
      const filterResponse = {
        success: false,
        message: "Invalid query parameter",
        errors: {
          message: "Invalid query parameter 'type'",
        },
      };
      sinon.stub(controlAccess, "generateFilter").resolves(filterResponse);

      // Call the updatePermission method
      const result = await controlAccess.updatePermission(request);

      // Verify the response
      expect(result).to.deep.equal(filterResponse);
    });
  });
  describe("createPermission method", () => {
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

      // Mock the response from the PermissionModel register method (success)
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

      // Call the createPermission method
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

      // Mock the response from the PermissionModel register method (failure)
      sinon.stub(PermissionModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create permission",
      });

      // Call the createPermission method
      const result = await controlAccess.createPermission(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create permission");
    });
  });
  describe("createDepartment method", () => {
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

      // Mock the response from the DepartmentModel register method (success)
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

      // Call the createDepartment method
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

      // Mock the response from the DepartmentModel register method (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create department",
      });

      // Call the createDepartment method
      const result = await controlAccess.createDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create department");
    });
  });
  describe("updateDepartment method", () => {
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel modify method (success)
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

      // Call the updateDepartment method
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

      // Mock the response from generateFilter.departments method (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the updateDepartment method
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel modify method (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update department",
      });

      // Call the updateDepartment method
      const result = await controlAccess.updateDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update department");
    });
  });
  describe("deleteDepartment method", () => {
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel remove method (success)
      sinon.stub(DepartmentModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Department deleted successfully",
      });

      // Call the deleteDepartment method
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

      // Mock the response from generateFilter.departments method (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the deleteDepartment method
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          _id: "department_id",
        },
      });

      // Mock the response from the DepartmentModel remove method (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete department",
      });

      // Call the deleteDepartment method
      const result = await controlAccess.deleteDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete department");
    });
  });
  describe("listDepartment method", () => {
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          // Filter data
        },
      });

      // Mock the response from the DepartmentModel list method (success)
      sinon.stub(DepartmentModel("sample_tenant"), "list").resolves({
        success: true,
        data: [
          // Department data
        ],
      });

      // Call the listDepartment method
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

      // Mock the response from generateFilter.departments method (failure)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: false,
        message: "Invalid filter parameters",
      });

      // Call the listDepartment method
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

      // Mock the response from generateFilter.departments method (success)
      sinon.stub(controlAccess, "generateFilter").resolves({
        success: true,
        data: {
          // Filter data
        },
      });

      // Mock the response from the DepartmentModel list method (failure)
      sinon.stub(DepartmentModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to fetch departments",
      });

      // Call the listDepartment method
      const result = await controlAccess.listDepartment(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to fetch departments");
    });
  });
  describe("createGroup method", () => {
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

      // Mock the response from the GroupModel register method (success)
      sinon.stub(GroupModel("sample_tenant"), "register").resolves({
        success: true,
        data: {
          // Newly created group data
        },
      });

      // Call the createGroup method
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

      // Mock the response from the GroupModel register method (failure)
      sinon.stub(GroupModel("sample_tenant"), "register").resolves({
        success: false,
        message: "Failed to create group",
      });

      // Call the createGroup method
      const result = await controlAccess.createGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create group");
    });
  });
  describe("updateGroup method", () => {
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

      // Mock the response from the GroupModel modify method (success)
      sinon.stub(GroupModel("sample_tenant"), "modify").resolves({
        success: true,
        data: {
          // Updated group data
        },
      });

      // Call the updateGroup method
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

      // Mock the response from the GroupModel modify method (failure)
      sinon.stub(GroupModel("sample_tenant"), "modify").resolves({
        success: false,
        message: "Failed to update group",
      });

      // Call the updateGroup method
      const result = await controlAccess.updateGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to update group");
    });
  });
  describe("deleteGroup method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should delete a group and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for deleteGroup function
      };

      // Mock the response from the GroupModel remove method (success)
      sinon.stub(GroupModel("sample_tenant"), "remove").resolves({
        success: true,
        message: "Group deleted successfully",
      });

      // Call the deleteGroup method
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
        // Add other required parameters for deleteGroup function
      };

      // Mock the response from the GroupModel remove method (failure)
      sinon.stub(GroupModel("sample_tenant"), "remove").resolves({
        success: false,
        message: "Failed to delete group",
      });

      // Call the deleteGroup method
      const result = await controlAccess.deleteGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to delete group");
    });
  });
  describe("listGroup method", () => {
    beforeEach(() => {
      // Restore all the Sinon stubs and mocks before each test case
      sinon.restore();
    });

    it("should list groups and send success response", async () => {
      const request = {
        query: {
          tenant: "sample_tenant",
        },
        // Add other required parameters for listGroup function
      };

      // Mock the response from the GroupModel list method (success)
      const mockListResponse = {
        success: true,
        data: [
          // Sample group objects returned by the GroupModel.list method
        ],
      };
      sinon
        .stub(GroupModel("sample_tenant"), "list")
        .resolves(mockListResponse);

      // Call the listGroup method
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
        // Add other required parameters for listGroup function
      };

      // Mock the response from the GroupModel list method (failure)
      sinon.stub(GroupModel("sample_tenant"), "list").resolves({
        success: false,
        message: "Failed to list groups",
      });

      // Call the listGroup method
      const result = await controlAccess.listGroup(request);

      // Verify the response
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to list groups");
    });
  });
  describe("verifyToken function", () => {
    let request;

    beforeEach(() => {
      request = {
        query: {},
        headers: {},
      };
    });

    it("should return an unauthorized response when filterResponse.success is false", async () => {
      const generateFilter = {
        tokens: sinon.fake.returns({ success: false }),
      };
      const result = await controlAccess.verifyToken(request, generateFilter);
      expect(result).to.deep.equal({ success: false });
    });

    it("should return an unauthorized response when service is deprecated-events-endpoint", async () => {
      request.headers = {
        "x-original-uri": "/some/uri",
        "x-original-method": "GET",
      };
      const getService = sinon.fake.returns("deprecated-events-endpoint");
      const result = await controlAccess.verifyToken(request, null, getService);
      expect(result).to.deep.equal(createUnauthorizedResponse());
    });

    it("should return a valid token response when conditions are met", async () => {
      // Mocking AccessTokenModel(tenant).list
      const responseFromListAccessToken = {
        success: true,
        status: httpStatus.OK,
        data: [
          {
            user: { email: "test@example.com" },
          },
        ],
      };
      const AccessTokenModel = sinon.stub().returns({
        list: sinon.fake.resolves(responseFromListAccessToken),
      });

      request.headers = {
        "x-original-uri": "/some/uri",
        "x-original-method": "GET",
      };
      const getService = sinon.fake.returns("some-service");
      const getUserAction = sinon.fake.returns("some-action");

      const result = await controlAccess.verifyToken(
        request,
        null,
        getService,
        AccessTokenModel,
        getUserAction
      );
      expect(result).to.deep.equal(createValidTokenResponse());

      // Verify the logs or other expectations as needed
    });

    // Add more test cases as needed
  });
  describe("verifyVerificationToken", () => {
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
  describe("getUserAction", () => {
    it('should return "update operation" for PUT method', () => {
      const headers = { "x-original-method": "PUT" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("update operation");
    });

    it('should return "delete operation" for DELETE method', () => {
      const headers = { "x-original-method": "DELETE" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("delete operation");
    });

    it('should return "creation operation" for POST method', () => {
      const headers = { "x-original-method": "POST" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("creation operation");
    });

    it('should return "Unknown Action" for unknown method', () => {
      const headers = { "x-original-method": "UNKNOWN" };
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("Unknown Action");
    });

    it('should return "Unknown Action" for missing method', () => {
      const headers = {};
      const result = getUserActionFunction.getUserAction(headers);
      expect(result).to.equal("Unknown Action");
    });
  });
  describe("getService", () => {
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
  describe("routeDefinitions", () => {
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
  // Add more test cases for other methods in the controlAccess object
});
