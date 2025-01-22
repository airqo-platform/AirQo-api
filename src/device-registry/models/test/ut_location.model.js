require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const locationSchema = require("@models/Location");

// Helper function to create a new test location object
const createTestLocation = (overrides = {}) => {
  return {
    type: "Polygon",
    coordinates: [[[0, 0], [1, 1], [2, 2], [0, 0]]], // Replace with valid coordinates from your data if needed
    name: "Test Location",
    admin_level: "City", // Replace with a valid admin level from your data if needed
    isCustom: false,
    metadata: {
      country: "Test Country",
      region: "Test Region",
      // ... Add other metadata properties as needed
    },
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for locationSchema
describe("locationSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const location = new Schema(locationSchema).validateSync(
        createTestLocation()
      );
      expect(location).to.not.haveOwnProperty("errors");
    });

    it("should require 'type' field", () => {
      const location = new Schema(locationSchema).validate(
        createTestLocation({ type: undefined })
      );
      expect(location.errors).to.haveOwnProperty("type");
    });

    it("should require 'coordinates' field", () => {
      const location = new Schema(locationSchema).validate(
        createTestLocation({ coordinates: undefined })
      );
      expect(location.errors).to.haveOwnProperty("coordinates");
    });

    it("should require 'name' field", () => {
      const location = new Schema(locationSchema).validate(
        createTestLocation({ name: undefined })
      );
      expect(location.errors).to.haveOwnProperty("name");
    });

    it("should require 'admin_level' field", () => {
      const location = new Schema(locationSchema).validate(
        createTestLocation({ admin_level: undefined })
      );
      expect(location.errors).to.haveOwnProperty("admin_level");
    });

    it("should require 'isCustom' field", () => {
      const location = new Schema(locationSchema).validate(
        createTestLocation({ isCustom: undefined })
      );
      expect(location.errors).to.haveOwnProperty("isCustom");
    });

    // Add more test cases for other properties and validations in locationSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in locationSchema
    describe(".register()", () => {
      it("should create a new Location document", async () => {
        // Create test data
        const locationData = createTestLocation();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(locationData);

        // Call the custom method
        const result = await locationSchema.statics.register(locationData);

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in locationSchema
    describe(".list()", () => {
      it("should return a list of Location documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestLocation()]);

        // Call the custom method
        const result = await locationSchema.statics.list({
          filter,
          limit,
          skip,
        });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("array");
        // Add more assertions for the returned data

        // Restore the stub after the test
        aggregateStub.restore();
      });
    });

    // Example for testing the "modify" custom method in locationSchema
    describe(".modify()", () => {
      it("should modify an existing Location document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-location-id" };
        const update = { isCustom: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestLocation(update));

        // Call the custom method
        const result = await locationSchema.statics.modify({ filter, update });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        expect(result.data.isCustom).to.equal(update.isCustom);
        // Add more assertions for the returned data

        // Restore the stub after the test
        findOneAndUpdateStub.restore();
      });
    });

    // Example for testing the "remove" custom method in locationSchema
    describe(".remove()", () => {
      it("should remove an existing Location document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-location-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestLocation());

        // Call the custom method
        const result = await locationSchema.statics.remove({ filter });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for the returned data

        // Restore the stub after the test
        findOneAndRemoveStub.restore();
      });
    });

    // Add more test cases for other custom methods, if any
  });
});

// If there are other hierarchical describes or any additional test blocks, you can add them here as needed.
