require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const AccessTokenModel = require("@models/AccessToken");

describe("AccessTokenSchema", () => {
  // Define a sandbox to manage stubs and mocks
  let sandbox;

  before(() => {
    // Create a sandbox before running the tests
    sandbox = sinon.createSandbox();
  });

  after(() => {
    // Restore the sandbox after running the tests
    sandbox.restore();
  });

  describe("AccessTokenSchema methods", () => {
    describe("findToken", () => {
      it("should find the user and currentAccessToken if a valid authorization token is provided", async () => {
        // Stub the AccessTokenModel.findOne method to return a mock accessToken
        const mockAccessToken = { user_id: "userId", token: "testToken" };
        sandbox.stub(AccessTokenModel, "findOne").resolves(mockAccessToken);

        // Call the findToken method with a valid authorization token
        const authorizationToken = "validToken";
        const result = await AccessTokenSchema.statics.findToken(
          authorizationToken
        );

        // Assertions
        expect(result.user).to.deep.equal(mockAccessToken.user_id);
        expect(result.currentAccessToken).to.deep.equal(mockAccessToken.token);
      });

      it("should return null for user and currentAccessToken if no authorization token is provided", async () => {
        // Call the findToken method with an empty authorization token
        const authorizationToken = "";
        const result = await AccessTokenSchema.statics.findToken(
          authorizationToken
        );

        // Assertions
        expect(result.user).to.be.null;
        expect(result.currentAccessToken).to.be.null;
      });

      // Add more test cases to cover different scenarios
    });
    describe("register", () => {
      it("should create a new access token and return success response", async () => {
        // Stub the AccessTokenModel.create method to return a mock access token
        const mockAccessToken = { token: "testToken" };
        sandbox.stub(AccessTokenModel, "create").resolves(mockAccessToken);

        // Call the register method with valid arguments
        const args = { user_id: "userId", token: "testToken" };
        const result = await AccessTokenSchema.statics.register(args);

        // Assertions
        expect(result.success).to.be.true;
        expect(result.data).to.deep.equal(mockAccessToken);
      });

      // Add more test cases to cover different scenarios
    });
    describe("list", () => {
      it("should return a list of access tokens with success response", async () => {
        // Stub the AccessTokenModel.aggregate method to return a mock response
        const mockResponse = [
          {
            _id: "tokenId1",
            token: "testToken1",
            user_id: "userId1",
            createdAt: "2023-07-25T12:00:00.000Z",
            updatedAt: "2023-07-25T12:00:00.000Z",
          },
          {
            _id: "tokenId2",
            token: "testToken2",
            user_id: "userId2",
            createdAt: "2023-07-26T12:00:00.000Z",
            updatedAt: "2023-07-26T12:00:00.000Z",
          },
        ];
        sandbox.stub(AccessTokenModel, "aggregate").resolves(mockResponse);

        // Mock the arguments for the list method
        const args = {
          skip: 0,
          limit: 10,
          filter: { category: "example" },
        };

        // Call the list method with mock arguments
        const result = await AccessTokenSchema.statics.list(args);

        // Assertions
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully retrieved the token details"
        );
        expect(result.data).to.deep.equal(mockResponse);
        expect(result.status).to.equal(httpStatus.OK);
      });

      it("should return an empty list with success response if no tokens are found", async () => {
        // Stub the AccessTokenModel.aggregate method to return an empty response
        sandbox.stub(AccessTokenModel, "aggregate").resolves([]);

        // Mock the arguments for the list method
        const args = {
          skip: 0,
          limit: 10,
          filter: { category: "example" },
        };

        // Call the list method with mock arguments
        const result = await AccessTokenSchema.statics.list(args);

        // Assertions
        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "not found, please crosscheck provided details"
        );
        expect(result.data).to.be.an("array").that.is.empty;
        expect(result.status).to.equal(httpStatus.NOT_FOUND);
      });

      it("should return an error response if an internal server error occurs", async () => {
        // Stub the AccessTokenModel.aggregate method to throw an error
        sandbox
          .stub(AccessTokenModel, "aggregate")
          .throws(new Error("Internal server error"));

        // Mock the arguments for the list method
        const args = {
          skip: 0,
          limit: 10,
          filter: { category: "example" },
        };

        // Call the list method with mock arguments
        const result = await AccessTokenSchema.statics.list(args);

        // Assertions
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors.message).to.equal("Internal server error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });

      // Add more test cases to cover different scenarios
    });
    describe(" modify", () => {
      // Define a sandbox to manage stubs and mocks
      let sandbox;

      before(() => {
        // Create a sandbox before running the tests
        sandbox = sinon.createSandbox();
      });

      after(() => {
        // Restore the sandbox after running the tests
        sandbox.restore();
      });

      it("should modify an access token and return a success response", async () => {
        // Stub the AccessTokenModel.findOneAndUpdate method to return a mock response
        const mockAccessToken = {
          _id: "tokenId1",
          token: "testToken1",
          user_id: "userId1",
          createdAt: "2023-07-25T12:00:00.000Z",
          updatedAt: "2023-07-25T12:00:00.000Z",
        };
        sandbox
          .stub(AccessTokenModel, "findOneAndUpdate")
          .resolves(mockAccessToken);

        // Mock the arguments for the modify method
        const args = {
          filter: { _id: "tokenId1" },
          update: { token: "updatedToken1" },
        };

        // Call the modify method with mock arguments
        const result = await AccessTokenSchema.statics.modify(args);

        // Assertions
        expect(result.success).to.be.true;
        expect(result.message).to.equal("successfully modified the Token");
        expect(result.data).to.deep.equal(mockAccessToken);
        expect(result.status).to.equal(httpStatus.OK);
      });

      it("should return an error response if the access token does not exist", async () => {
        // Stub the AccessTokenModel.findOneAndUpdate method to return null (token not found)
        sandbox.stub(AccessTokenModel, "findOneAndUpdate").resolves(null);

        // Mock the arguments for the modify method
        const args = {
          filter: { _id: "tokenId1" },
          update: { token: "updatedToken1" },
        };

        // Call the modify method with mock arguments
        const result = await AccessTokenSchema.statics.modify(args);

        // Assertions
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "Token does not exist, please crosscheck"
        );
        expect(result.errors.message).to.equal(
          "Token does not exist, please crosscheck"
        );
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      });

      it("should return an error response if an internal server error occurs", async () => {
        // Stub the AccessTokenModel.findOneAndUpdate method to throw an error
        sandbox
          .stub(AccessTokenModel, "findOneAndUpdate")
          .throws(new Error("Internal server error"));

        // Mock the arguments for the modify method
        const args = {
          filter: { _id: "tokenId1" },
          update: { token: "updatedToken1" },
        };

        // Call the modify method with mock arguments
        const result = await AccessTokenSchema.statics.modify(args);

        // Assertions
        expect(result.success).to.be.false;
        expect(result.message).to.equal("Internal Server Error");
        expect(result.errors.message).to.equal("Internal server error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });

      // Add more test cases to cover different scenarios
    });
    describe("remove", () => {
      // Define a sandbox to manage stubs and mocks
      let sandbox;

      before(() => {
        // Create a sandbox before running the tests
        sandbox = sinon.createSandbox();
      });

      after(() => {
        // Restore the sandbox after running the tests
        sandbox.restore();
      });

      it("should remove an access token and return a success response", async () => {
        // Stub the AccessTokenModel.findOneAndRemove method to return a mock response
        const mockAccessToken = {
          _id: "tokenId1",
          token: "testToken1",
          user_id: "userId1",
          network_id: "networkId1",
          expires_in: 3600,
        };
        sandbox
          .stub(AccessTokenModel, "findOneAndRemove")
          .resolves(mockAccessToken);

        // Mock the arguments for the remove method
        const args = {
          filter: { _id: "tokenId1" },
        };

        // Call the remove method with mock arguments
        const result = await AccessTokenSchema.statics.remove(args);

        // Assertions
        expect(result.success).to.be.true;
        expect(result.message).to.equal("successfully removed the Token");
        expect(result.data).to.deep.equal(mockAccessToken);
        expect(result.status).to.equal(httpStatus.OK);
      });

      it("should return an error response if the access token does not exist", async () => {
        // Stub the AccessTokenModel.findOneAndRemove method to return null (token not found)
        sandbox.stub(AccessTokenModel, "findOneAndRemove").resolves(null);

        // Mock the arguments for the remove method
        const args = {
          filter: { _id: "tokenId1" },
        };

        // Call the remove method with mock arguments
        const result = await AccessTokenSchema.statics.remove(args);

        // Assertions
        expect(result.success).to.be.false;
        expect(result.message).to.equal(
          "Token does not exist, please crosscheck"
        );
        expect(result.errors.message).to.equal(
          "Token does not exist, please crosscheck"
        );
        expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      });

      it("should return an error response if an internal server error occurs", async () => {
        // Stub the AccessTokenModel.findOneAndRemove method to throw an error
        sandbox
          .stub(AccessTokenModel, "findOneAndRemove")
          .throws(new Error("Internal server error"));

        // Mock the arguments for the remove method
        const args = {
          filter: { _id: "tokenId1" },
        };

        // Call the remove method with mock arguments
        const result = await AccessTokenSchema.statics.remove(args);

        // Assertions
        expect(result.success).to.be.false;
        expect(result.message).to.equal("internal server error");
        expect(result.errors.message).to.equal("Internal server error");
        expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      });

      // Add more test cases to cover different scenarios
    });
    describe("Method: toJSON", () => {
      it("should convert the AccessTokenSchema object to a JSON representation", () => {
        // Create a mock AccessTokenSchema object
        const mockAccessToken = new AccessTokenSchema({
          _id: mongoose.Types.ObjectId("tokenId1"),
          token: "testToken1",
          user_id: mongoose.Types.ObjectId("userId1"),
          network_id: mongoose.Types.ObjectId("networkId1"),
          client_id: "clientId1",
          permissions: [mongoose.Types.ObjectId("permissionId1")],
          scopes: [
            mongoose.Types.ObjectId("scopeId1"),
            mongoose.Types.ObjectId("scopeId2"),
          ],
          createdAt: new Date("2023-07-25T12:34:56Z"),
          updatedAt: new Date("2023-07-25T12:34:56Z"),
          name: "AccessToken 1",
          last_used_at: new Date("2023-07-25T12:34:56Z"),
          last_ip_address: "192.168.1.1",
          expires: new Date("2023-07-25T13:34:56Z"),
        });

        // Call the toJSON method
        const result = mockAccessToken.toJSON();

        // Assertions
        expect(result._id).to.deep.equal("tokenId1");
        expect(result.token).to.equal("testToken1");
        expect(result.user_id).to.deep.equal("userId1");
        expect(result.network_id).to.deep.equal("networkId1");
        expect(result.client_id).to.equal("clientId1");
        expect(result.permissions).to.deep.equal(["permissionId1"]);
        expect(result.scopes).to.deep.equal(["scopeId1", "scopeId2"]);
        expect(result.createdAt).to.equal("2023-07-25T12:34:56.000Z");
        expect(result.updatedAt).to.equal("2023-07-25T12:34:56.000Z");
        expect(result.name).to.equal("AccessToken 1");
        expect(result.last_used_at).to.equal("2023-07-25T12:34:56.000Z");
        expect(result.last_ip_address).to.equal("192.168.1.1");
        expect(result.expires).to.equal("2023-07-25T13:34:56.000Z");
      });

      // Add more test cases to cover additional scenarios if needed
    });
  });
});
