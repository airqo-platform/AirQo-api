require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const saltRounds = 10;
const constants = require("@config/constants");
const chaiAsPromised = require("chai-as-promised");
const mongoose = require("mongoose");
const UserModelFactory = require("@models/User");
const UserModel = UserModelFactory; // alias - factory function
const httpStatus = require("http-status");
chai.use(chaiAsPromised);

describe("UserSchema static methods", () => {
  describe("register()", () => {
    it("should register a new user", async () => {
      const sandbox = sinon.createSandbox();
      const fakeId = new mongoose.Types.ObjectId();
      const args = {
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      };
      const fakeUser = { _id: fakeId, ...args };

      sandbox.stub(UserModelFactory("airqo"), "create").resolves(fakeUser);

      try {
        const result = await UserModelFactory("airqo").register(args);

        expect(result.success).to.be.true;
        expect(result.message).to.equal("user created");
        expect(result.status).to.equal(httpStatus.OK);
        expect(result.data).to.have.property("_id");
        expect(result.data.firstName).to.equal("John");
        expect(result.data.lastName).to.equal("Doe");
        expect(result.data.userName).to.equal("john_doe");
        expect(result.data.email).to.equal("john@example.com");
      } finally {
        sandbox.restore();
      }
    });

    // Add more test cases to cover other scenarios
  });

  describe("listStatistics()", () => {
    it("should list statistics of users", async () => {
      const sandbox = sinon.createSandbox();
      const mockStats = {
        users: { number: 5 },
        active_users: { number: 2 },
        api_users: { number: 1 },
      };

      const mockAggregation = {
        match: sandbox.stub().returnsThis(),
        sort: sandbox.stub().returnsThis(),
        lookup: sandbox.stub().returnsThis(),
        group: sandbox.stub().returnsThis(),
        project: sandbox.stub().returnsThis(),
        allowDiskUse: sandbox.stub().resolves([mockStats]),
      };

      sandbox
        .stub(UserModelFactory("airqo"), "aggregate")
        .returns(mockAggregation);

      try {
        const result = await UserModelFactory("airqo").listStatistics();

        expect(result.success).to.be.true;
        expect(result.message).to.equal(
          "successfully retrieved the user statistics"
        );
        expect(result.status).to.equal(httpStatus.OK);
        expect(result.data).to.deep.equal(mockStats);
      } finally {
        sandbox.restore();
      }
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
      const mockResponse = [{ _id: new mongoose.Types.ObjectId(), email: "test@example.com" }];

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
        allowDiskUse: sandbox.stub().resolves(mockResponse),
        exec: sandbox.stub().resolves(mockResponse),
      };

      sandbox.stub(UserModelFactory("airqo"), "aggregate").returns(mockAggregation);
      sandbox
        .stub(UserModelFactory("airqo"), "countDocuments")
        .returns({ exec: sandbox.stub().resolves(1) });

      const filter = {};
      const result = await UserModelFactory("airqo").list({ filter });

      expect(result).to.deep.equal({
        success: true,
        message: "successfully retrieved the user details",
        data: mockResponse,
        status: httpStatus.OK,
        meta: {
          total: 1,
          skip: 0,
          limit: 100,
          page: 1,
          pages: 1,
        },
      });
    });

    it("should include onboarding_checklist, devices, and cohorts in the $group stage", async () => {
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
        allowDiskUse: sandbox.stub().resolves([]),
      };

      sandbox.stub(UserModelFactory("airqo"), "aggregate").returns(mockAggregation);
      sandbox.stub(UserModelFactory("airqo"), "countDocuments").returns({ exec: sandbox.stub().resolves(0) });

      await UserModelFactory("airqo").list({ filter: {} });

      const groupArg = mockAggregation.group.args[0][0];
      expect(groupArg).to.have.nested.property("onboarding_checklist.$first", "$onboarding_checklist");
      expect(groupArg).to.have.nested.property("devices.$first", "$devices");
      expect(groupArg).to.have.nested.property("cohorts.$first", "$cohorts");
    });

    // Add more test cases here for different scenarios (e.g., empty response, error handling, etc.)
  });

  describe("modify()", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should modify an existing user", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const updatedUser = { _id: fakeId, firstName: "Updated", lastName: "User" };

      sandbox
        .stub(UserModelFactory("airqo"), "findOneAndUpdate")
        .resolves(updatedUser);

      const filter = { _id: fakeId };
      const update = { firstName: "Updated", lastName: "User" };
      const result = await UserModelFactory("airqo").modify({ filter, update });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully modified the user");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.have.property("firstName", "Updated");
      expect(result.data).to.have.property("lastName", "User");
    });

    // Add more test cases to cover other scenarios
  });

  describe("remove()", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should remove an existing user", async () => {
      const removedDoc = { email: "john@example.com", firstName: "John", lastName: "Doe" };
      const removedUser = { _doc: removedDoc };

      sandbox
        .stub(UserModelFactory("airqo"), "findOneAndRemove")
        .returns({ exec: sandbox.stub().resolves(removedUser) });

      const filter = { email: "john@example.com" };
      const result = await UserModelFactory("airqo").remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully removed the user");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal(removedDoc);
    });

    // Add more test cases to cover other scenarios
  });
});

describe("UserSchema instance methods", () => {
  describe("authenticateUser()", () => {
    it("should return true if the password is correct", () => {
      // Sample user document
      const user = new (UserModelFactory("airqo"))({
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
      const user = new (UserModelFactory("airqo"))({
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
    it("should create a valid JWT token with the default 'no_roles_and_permissions' strategy", async () => {
      // Sample user document
      const user = new (UserModel("airqo"))({
        _id: new mongoose.Types.ObjectId(),
        firstName: "John",
        lastName: "Doe",
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
        organization: "AirQo",
        long_organization: "AirQo Long",
        privilege: "user",
        userType: "user",
      });

      // Call the createToken method without specifying a strategy
      const token = await user.createToken();

      // Assertions
      expect(token).to.be.a("string");

      // Verify the token content
      const decodedToken = jwt.verify(token, constants.JWT_SECRET);
      expect(decodedToken).to.have.property("_id", user._id.toString());
      expect(decodedToken).to.have.property("userName", user.userName);
      expect(decodedToken).to.have.property("firstName", user.firstName);
      expect(decodedToken).to.have.property("lastName", user.lastName);
      expect(decodedToken).to.have.property("email", user.email);
      expect(decodedToken).to.have.property("privilege", user.privilege);
      expect(decodedToken).to.have.property("nrp", 1); // Marker for the strategy
      expect(decodedToken).to.not.have.property("roles");
      expect(decodedToken).to.not.have.property("permissions");
      expect(decodedToken).to.have.property("iat");
      expect(decodedToken).to.have.property("exp");
    });

    it("should create a valid JWT token with the 'legacy' strategy when specified", async () => {
      // Sample user document
      const user = new (UserModel("airqo"))({
        _id: new mongoose.Types.ObjectId(),
        firstName: "Jane",
        lastName: "Doe",
        userName: "jane_doe",
        email: "jane@example.com",
        password: "password123",
        privilege: "user",
        userType: "user",
      });

      // Call the createToken method specifying the legacy strategy
      const token = await user.createToken(constants.TOKEN_STRATEGIES.LEGACY);

      // Assertions
      expect(token).to.be.a("string");

      // Verify the token content
      const decodedToken = jwt.verify(token, constants.JWT_SECRET);
      expect(decodedToken).to.have.property("_id", user._id.toString());
      expect(decodedToken).to.have.property("username", user.userName);
      expect(decodedToken).to.have.property("roles").that.is.an("array");
      expect(decodedToken).to.have.property("permissions").that.is.an("array");
      expect(decodedToken).to.not.have.property("nrp");
      expect(decodedToken).to.have.property("iat");
      expect(decodedToken).to.have.property("exp");
    });
  });

  describe("newToken()", () => {
    it("should generate a new access token", () => {
      // Sample user document
      const user = new (UserModelFactory("airqo"))({
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
    it("should return the JSON representation for authentication", async () => {
      const userId = new mongoose.Types.ObjectId();
      const user = new (UserModelFactory("airqo"))({
        _id: userId,
        userName: "john_doe",
        email: "john@example.com",
        password: "password123",
      });

      const result = await user.toAuthJSON();

      expect(result).to.be.an("object");
      expect(result._id.toString()).to.equal(userId.toString());
      expect(result).to.have.property("userName", "john_doe");
      expect(result).to.have.property("email", "john@example.com");
      expect(result).to.have.property("token");
      expect(result.token).to.be.a("string").and.to.include("JWT ");
    });

    // Add more test cases to cover other scenarios
  });
});
