require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const mongoose = require("mongoose");

const UserSchema = require("@models/User");

// Replace this with the actual import path for your User model if applicable
const UserModel = mongoose.model("User", UserSchema);

describe("UserSchema static methods", () => {
  describe("register method", () => {
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

  describe("listStatistics method", () => {
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

  describe("list method", () => {
    it("should list users", async () => {
      const result = await UserModel.list();

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the user details"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
    });

    // Add more test cases to cover other scenarios
  });

  describe("modify method", () => {
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

  describe("remove method", () => {
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

  describe("v2_remove method", () => {
    it("should remove users with additional operations", async () => {
      // Assuming there is an existing user with ID "existing_user_id"
      const filter = { _id: "existing_user_id" };

      const result = await UserModel.v2_remove({ filter });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully deleted the user");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.be.an("array");
    });

    // Add more test cases to cover other scenarios
  });
});

describe("UserSchema instance methods", () => {
  describe("authenticateUser method", () => {
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

  describe("createToken method", () => {
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

  describe("newToken method", () => {
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

  describe("toAuthJSON method", () => {
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
