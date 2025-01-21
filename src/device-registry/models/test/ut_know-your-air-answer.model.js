require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const knowYourAirAnswerSchema = require("@models/KnowYourAirAnswer");

// Helper function to create a new test answer object
const createTestAnswer = (overrides = {}) => {
  return {
    title: "Test Answer",
    image: "test-image.jpg",
    completion_message: "Test completion message",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for knowYourAirAnswerSchema
describe("knowYourAirAnswerSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const answer = new Schema(knowYourAirAnswerSchema).validateSync(
        createTestAnswer()
      );
      expect(answer).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const answer = new Schema(knowYourAirAnswerSchema).validate(
        createTestAnswer({ title: undefined })
      );
      expect(answer.errors).to.haveOwnProperty("title");
    });

    it("should require 'image' field", () => {
      const answer = new Schema(knowYourAirAnswerSchema).validate(
        createTestAnswer({ image: undefined })
      );
      expect(answer.errors).to.haveOwnProperty("image");
    });

    it("should require 'completion_message' field", () => {
      const answer = new Schema(knowYourAirAnswerSchema).validate(
        createTestAnswer({ completion_message: undefined })
      );
      expect(answer.errors).to.haveOwnProperty("completion_message");
    });

    // Add more test cases for other properties and validations in knowYourAirAnswerSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in knowYourAirAnswerSchema
    describe(".register()", () => {
      it("should create a new Answer document", async () => {
        // Create test data
        const answerData = createTestAnswer();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(answerData);

        // Call the custom method
        const result = await knowYourAirAnswerSchema.statics.register(
          answerData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in knowYourAirAnswerSchema
    describe(".list()", () => {
      it("should return a list of Answer documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestAnswer()]);

        // Call the custom method
        const result = await knowYourAirAnswerSchema.statics.list({
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

    // Example for testing the "modify" custom method in knowYourAirAnswerSchema
    describe(".modify()", () => {
      it("should modify an existing Answer document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-answer-id" };
        const update = { title: "Modified Answer Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestAnswer(update));

        // Call the custom method
        const result = await knowYourAirAnswerSchema.statics.modify({
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

    // Example for testing the "remove" custom method in knowYourAirAnswerSchema
    describe(".remove()", () => {
      it("should remove an existing Answer document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-answer-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestAnswer());

        // Call the custom method
        const result = await knowYourAirAnswerSchema.statics.remove({ filter });

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
