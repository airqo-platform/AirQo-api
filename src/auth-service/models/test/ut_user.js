require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const chaiAsPromised = require("chai-as-promised");
const mongoose = require("mongoose");
const UserModel = require("@models/User");
const httpStatus = require("http-status");
chai.use(chaiAsPromised);

describe("UserSchema static methods", () => {
  describe("register()", () => {
    it("should register a new user", async () => {
      const args = {
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      };

      const result = await UserModel.register(args);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("user created");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id");
      expect(result.data.firstName).to.equal("John");
      expect(result.data.lastName).to.equal("Doe");
      expect(result.data.userName).to.equal("john_doe");
      expect(result.data.email).to.equal("john@example.com");
    });

    // Add more test cases to cover other scenarios
  });

  describe("listStatistics()", () => {
    it("should list statistics of users", async () => {
      const result = await UserModel.listStatistics();

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the user statistics"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
    });

    // Add more test cases to cover other scenarios
  });

  describe("list()", () => {
    let sandbox;

    before(() => {
      mongoose.set("useFindAndModify", false); // To suppress mongoose deprecation warnings
    });

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should return user details with valid filter", async () => {
      // Create a mock response
      const mockResponse = [
        // Mock user data here
      ];

      // Create a mock aggregation object with expected methods
      const mockAggregation = {
        match: sandbox.stub().returnsThis(),
        lookup: sandbox.stub().returnsThis(),
        addFields: sandbox.stub().returnsThis(),
        unwind: sandbox.stub().returnsThis(),
        group: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        skip: sandbox.stub().returnsThis(),
        limit: sandbox.stub().returnsThis(),
        allowDiskUse: sandbox.stub().returnsThis(),
        exec: sandbox.stub().resolves(mockResponse), // Resolve with your mock data
      };

      // Stub the UserModel.aggregate() method to return the mock aggregation object
      sandbox.stub(UserModel, "aggregate").returns(mockAggregation);

      // Define the filter you want to test
      const filter = {
        // Define your filter here
      };

      // Call the list function and make assertions
      const result = await UserModel.list({ filter });

      expect(result).to.deep.equal({
        success: true,
        message: "successfully retrieved the user details",
        data: mockResponse,
        status: httpStatus.OK,
      });
    });

    // Add more test cases here for different scenarios (e.g., empty response, error handling, etc.)
  });

  describe("modify()", () => {
    it("should modify an existing user", async () => {
      // Assuming there is an existing user with ID "existing_user_id"
      const filter = { _id: "existing_user_id" };
      const update = { firstName: "Updated", lastName: "User" };

      const result = await UserModel.modify({ filter, update });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the user");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id", "existing_user_id");
      expect(result.data).to.have.property("firstName", "Updated");
      expect(result.data).to.have.property("lastName", "User");
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove()", () => {
    it("should remove an existing user", async () => {
      // Assuming there is an existing user with ID "existing_user_id"
      const filter = { _id: "existing_user_id" };

      const result = await UserModel.remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully removed the user");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("_id", "existing_user_id");
    });

    // Add more test cases to cover other scenarios
  });
});

describe("UserSchema instance methods", () => {
  describe("authenticateUser()", () => {
    it("should return true if the password is correct", () => {
      // Sample user document
      const user = new UserModel({
        _id: "user_id_1",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: bcrypt.hashSync("password123", saltRounds),
      });

      // Call the authenticateUser method
      const result = user.authenticateUser("password123");

      // Assertion
      expect(result).to.be.true;
    });

    it("should return false if the password is incorrect", () => {
      // Sample user document
      const user = new UserModel({
        _id: "user_id_1",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: bcrypt.hashSync("password123", saltRounds),
      });

      // Call the authenticateUser method with an incorrect password
      const result = user.authenticateUser("wrong_password");

      // Assertion
      expect(result).to.be.false;
    });

    // Add more test cases to cover other scenarios
  });

  describe("createToken()", () => {
    it("should create a valid JWT token", () => {
      // Sample user document
      const user = new UserModel({
        _id: "user_id_1",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      });

      // Call the createToken method
      const token = user.createToken();

      // Assertions
      expect(token).to.be.a("string");
      // Add more assertions to verify the token contents if needed
    });

    // Add more test cases to cover other scenarios
  });

  describe("newToken()", () => {
    it("should generate a new access token", () => {
      // Sample user document
      const user = new UserModel({
        _id: "user_id_1",
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      });

      // Call the newToken method
      const result = user.newToken();

      // Assertions
      expect(result).to.be.an("object");
      expect(result.accessToken).to.be.a("string");
      expect(result.plainTextToken).to.be.a("string");
    });

    // Add more test cases to cover other scenarios
  });

  describe("toAuthJSON()", () => {
    it("should return the JSON representation for authentication", () => {
      // Sample user document
      const user = new UserModel({
        _id: "user_id_1",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      });

      // Call the toAuthJSON method
      const result = user.toAuthJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "user_id_1");
      expect(result).to.have.property("userName", "john_doe");
      expect(result).to.have.property("email", "john@example.com");
      expect(result).to.have.property("token");
      expect(result.token).to.be.a("string").and.to.include("JWT ");
    });

    // Add more test cases to cover other scenarios
  });
});
