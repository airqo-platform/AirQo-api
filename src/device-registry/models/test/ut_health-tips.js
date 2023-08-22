require("module-alias/register");
const { expect } = require("chai");
const { Schema, model } = require("mongoose");
const sinon = require("sinon");
const tipsSchema = require("@models/HealthTips");

// Helper function to create a new test tip object
const createTestTip = (overrides = {}) => {
  return {
    title: "Test Tip",
    description: "Test tip description",
    image: "test-image.jpg",
    aqi_category: { min: 0, max: 12.09 },
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for tipsSchema
describe("tipsSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const tip = new Schema(tipsSchema).validateSync(createTestTip());
      expect(tip).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const tip = new Schema(tipsSchema).validate(
        createTestTip({ title: undefined })
      );
      expect(tip.errors).to.haveOwnProperty("title");
    });

    it("should require 'description' field", () => {
      const tip = new Schema(tipsSchema).validate(
        createTestTip({ description: undefined })
      );
      expect(tip.errors).to.haveOwnProperty("description");
    });

    it("should require 'image' field", () => {
      const tip = new Schema(tipsSchema).validate(
        createTestTip({ image: undefined })
      );
      expect(tip.errors).to.haveOwnProperty("image");
    });

    it("should require 'aqi_category' field", () => {
      const tip = new Schema(tipsSchema).validate(
        createTestTip({ aqi_category: undefined })
      );
      expect(tip.errors).to.haveOwnProperty("aqi_category");
    });

    // Add more test cases for other properties and validations in tipsSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in tipsSchema
    describe(".register()", () => {
      it("should create a new Tip document", async () => {
        // Create test data
        const tipData = createTestTip();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon.stub(model("Tip"), "create").resolves(tipData);

        // Call the custom method
        const result = await tipsSchema.statics.register(tipData);

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in tipsSchema
    describe(".list()", () => {
      it("should return a list of Tip documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(model("Tip"), "aggregate")
          .resolves([createTestTip()]);

        // Call the custom method
        const result = await tipsSchema.statics.list({ filter, limit, skip });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("array");
        // Add more assertions for the returned data

        // Restore the stub after the test
        aggregateStub.restore();
      });
    });

    // Example for testing the "modify" custom method in tipsSchema
    describe(".modify()", () => {
      it("should modify an existing Tip document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-tip-id" };
        const update = { title: "Modified Tip Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(model("Tip"), "findOneAndUpdate")
          .resolves(createTestTip(update));

        // Call the custom method
        const result = await tipsSchema.statics.modify({
          filter,
          update,
          opts,
        });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        expect(result.data.title).to.equal(update.title);
        // Add more assertions for the returned data

        // Restore the stub after the test
        findOneAndUpdateStub.restore();
      });
    });

    // Example for testing the "remove" custom method in tipsSchema
    describe(".remove()", () => {
      it("should remove an existing Tip document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-tip-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(model("Tip"), "findOneAndRemove")
          .resolves(createTestTip());

        // Call the custom method
        const result = await tipsSchema.statics.remove({ filter });

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
