require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const gridSchema = require("@models/Grid");

// Helper function to create a new test grid object
const createTestGrid = (overrides = {}) => {
  return {
    network: "test network",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for gridSchema
describe("gridSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const grid = new Schema(gridSchema).validateSync(createTestGrid());
      expect(grid).to.not.haveOwnProperty("errors");
    });

    it("should require 'network' field", () => {
      const grid = new Schema(gridSchema).validate(
        createTestGrid({ network: undefined })
      );
      expect(grid.errors).to.haveOwnProperty("network");
    });

    it("should require 'admin_level' field", () => {
      const grid = new Schema(gridSchema).validate(
        createTestGrid({ admin_level: undefined })
      );
      expect(grid.errors).to.haveOwnProperty("admin_level");
    });

    it("should require 'name' field", () => {
      const grid = new Schema(gridSchema).validate(
        createTestGrid({ name: undefined })
      );
      expect(grid.errors).to.haveOwnProperty("name");
    });

    it("should require 'shape' field", () => {
      const grid = new Schema(gridSchema).validate(
        createTestGrid({ shape: undefined })
      );
      expect(grid.errors).to.haveOwnProperty("shape");
    });

    // Add more test cases for other properties and validations in gridSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in gridSchema
    describe(".register()", () => {
      it("should create a new Grid document", async () => {
        // Create test data
        const gridData = createTestGrid();

        // Call the custom method
        const result = await gridSchema.statics.register(gridData);

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response
      });
    });

    // Example for testing the "list" custom method in gridSchema
    describe(".list()", () => {
      it("should return a list of Grid documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Call the custom method
        const result = await gridSchema.statics.list({ filter, limit, skip });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("array");
        // Add more assertions for the returned data
      });
    });

    // Add more test cases for other custom methods, if any
  });
});

// If there are other hierarchical describes or any additional test blocks, you can add them here as needed.
