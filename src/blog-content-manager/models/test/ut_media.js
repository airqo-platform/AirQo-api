const chai = require("chai");
const expect = chai.expect;
const DepartmentSchema = require("@models/Department");
const mongoose = require("mongoose");

describe("DepartmentSchema - Statics", () => {
  describe("Static Method: register", () => {
    it("should create a new department and return success response", async () => {
      // Mock input data
      const args = {
        dep_network_id: mongoose.Types.ObjectId(),
        dep_parent: mongoose.Types.ObjectId(),
        dep_title: "Department A",
        dep_status: "active",
        dep_manager: mongoose.Types.ObjectId(),
        dep_last: 10,
        dep_manager_username: "manager_username",
        dep_manager_firstname: "John",
        dep_manager_lastname: "Doe",
        has_children: "yes",
        dep_children: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        dep_description: "Department A Description",
        dep_users: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
      };

      // Call the register static method
      const result = await DepartmentSchema.register(args);

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "department created",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle duplicate values and return conflict response", async () => {
      // Mock input data with duplicate values
      const args = {
        dep_network_id: mongoose.Types.ObjectId(),
        dep_parent: mongoose.Types.ObjectId(),
        dep_title: "Department A",
        dep_status: "active",
        dep_manager: mongoose.Types.ObjectId(),
        dep_last: 10,
        dep_manager_username: "manager_username",
        dep_manager_firstname: "John",
        dep_manager_lastname: "Doe",
        has_children: "yes",
        dep_children: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
        dep_description: "Department A Description",
        dep_users: [mongoose.Types.ObjectId(), mongoose.Types.ObjectId()],
      };

      // Call the register static method
      const result = await DepartmentSchema.register(args);

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "duplicate values provided",
        status: httpStatus.CONFLICT,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: list", () => {
    it("should return a list of departments", async () => {
      // Mock input data (optional)
      const filter = { dep_status: "active" };
      const skip = 0;
      const limit = 20;

      // Call the list static method
      const result = await DepartmentSchema.list({ filter, skip, limit });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully retrieved the departments",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions to verify the result
    });

    it("should handle error and return conflict response", async () => {
      // Mock input data (optional)
      const filter = { dep_status: "inactive" };
      const skip = 0;
      const limit = 20;

      // Call the list static method
      const result = await DepartmentSchema.list({ filter, skip, limit });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: false,
        message: "internal server error",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });
      expect(result).to.have.property("errors").that.is.an("object");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: modify", () => {
    it("should modify the department and return success response", async () => {
      // Mock input data
      const filter = { dep_title: "Department A" };
      const update = { dep_status: "inactive" };

      // Call the modify static method
      const result = await DepartmentSchema.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully modified the department",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle error and return not found response", async () => {
      // Mock input data
      const filter = { dep_title: "Department B" };
      const update = { dep_status: "active" };

      // Call the modify static method
      const result = await DepartmentSchema.modify({ filter, update });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "department does not exist, please crosscheck",
        status: httpStatus.NOT_FOUND,
      });
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("Static Method: remove", () => {
    it("should remove the department and return success response", async () => {
      // Mock input data
      const filter = { dep_title: "Department A" };

      // Call the remove static method
      const result = await DepartmentSchema.remove({ filter });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "successfully removed the department",
        status: httpStatus.OK,
      });
      expect(result).to.have.property("data").that.is.an("object");
      // Add more assertions to verify the result
    });

    it("should handle error and return not found response", async () => {
      // Mock input data
      const filter = { dep_title: "Department B" };

      // Call the remove static method
      const result = await DepartmentSchema.remove({ filter });

      // Assertions
      expect(result).to.be.an("object").that.includes({
        success: true,
        message: "department does not exist, please crosscheck",
        status: httpStatus.NOT_FOUND,
      });
      expect(result).to.have.property("data").that.is.an("array");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });

  describe("sanitizeName", () => {
    it("should sanitize a name by removing white spaces and converting to lowercase", () => {
      // Mock input data
      const name = "   John Doe   ";

      // Call the sanitizeName function
      const result = sanitizeName(name);

      // Assertions
      expect(result).to.equal("johndoe");
      // Add more assertions to verify the result
    });

    it("should truncate a long name and sanitize it", () => {
      // Mock input data
      const name = "This is a very long name with spaces";

      // Call the sanitizeName function
      const result = sanitizeName(name);

      // Assertions
      expect(result).to.equal("thisisaverylon");
      // Add more assertions to verify the result
    });

    it("should handle an empty name and return an empty string", () => {
      // Mock input data
      const name = "";

      // Call the sanitizeName function
      const result = sanitizeName(name);

      // Assertions
      expect(result).to.equal("");
      // Add more assertions to verify the result
    });

    it("should handle error and return an empty string", () => {
      // Mock input data
      const name = null;

      // Call the sanitizeName function
      const result = sanitizeName(name);

      // Assertions
      expect(result).to.equal("");
      // Add more assertions to verify the result
    });

    // Add more test cases to cover additional scenarios
  });
});

describe("DepartmentSchema instance methods", () => {
  describe("toJSON method", () => {
    it("should return the department data in the expected format", () => {
      // Sample department data
      const departmentData = {
        _id: "dept_id_1",
        dep_parent: "parent_dept_id",
        dep_title: "Department 1",
        dep_network_id: "network_id_1",
        dep_status: "active",
        dep_manager: "manager_id_1",
        dep_last: "last_dept_id",
        dep_manager_username: "manager_username",
        dep_manager_firstname: "John",
        dep_manager_lastname: "Doe",
        has_children: true,
        dep_children: ["child_dept_id_1", "child_dept_id_2"],
        dep_users: ["user_id_1", "user_id_2"],
        createdAt: new Date("2023-07-25T00:00:00Z"),
        updatedAt: new Date("2023-07-25T12:34:56Z"),
      };

      // Create a new instance of the DepartmentModel with the sample department data
      const departmentInstance = new DepartmentModel(departmentData);

      // Call the toJSON method
      const result = departmentInstance.toJSON();

      // Assertions
      expect(result).to.be.an("object");
      expect(result).to.have.property("_id", "dept_id_1");
      expect(result).to.have.property("dep_parent", "parent_dept_id");
      expect(result).to.have.property("dep_title", "Department 1");
      expect(result).to.have.property("dep_network_id", "network_id_1");
      expect(result).to.have.property("dep_status", "active");
      expect(result).to.have.property("dep_manager", "manager_id_1");
      expect(result).to.have.property("dep_last", "last_dept_id");
      expect(result).to.have.property(
        "dep_manager_username",
        "manager_username"
      );
      expect(result).to.have.property("dep_manager_firstname", "John");
      expect(result).to.have.property("dep_manager_lastname", "Doe");
      expect(result).to.have.property("has_children", true);
      expect(result)
        .to.have.property("dep_children")
        .that.deep.equals(["child_dept_id_1", "child_dept_id_2"]);
      expect(result)
        .to.have.property("dep_users")
        .that.deep.equals(["user_id_1", "user_id_2"]);
      expect(result).to.have.property("createdAt").that.is.an.instanceOf(Date);
      expect(result).to.have.property("updatedAt").that.is.an.instanceOf(Date);
    });

    // Add more test cases if needed
  });
});
