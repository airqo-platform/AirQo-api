require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const knowYourAirQuestionSchema = require("@models/KnowYourAirQuestion");

// Helper function to create a new test question object
const createTestQuestion = (overrides = {}) => {
  return {
    title: "Test Question",
    image: "test-image.jpg",
    completion_message: "Test completion message",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for knowYourAirQuestionSchema
describe("knowYourAirQuestionSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const question = new Schema(knowYourAirQuestionSchema).validateSync(
        createTestQuestion()
      );
      expect(question).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const question = new Schema(knowYourAirQuestionSchema).validate(
        createTestQuestion({ title: undefined })
      );
      expect(question.errors).to.haveOwnProperty("title");
    });

    it("should require 'image' field", () => {
      const question = new Schema(knowYourAirQuestionSchema).validate(
        createTestQuestion({ image: undefined })
      );
      expect(question.errors).to.haveOwnProperty("image");
    });

    it("should require 'completion_message' field", () => {
      const question = new Schema(knowYourAirQuestionSchema).validate(
        createTestQuestion({ completion_message: undefined })
      );
      expect(question.errors).to.haveOwnProperty("completion_message");
    });

    // Add more test cases for other properties and validations in knowYourAirQuestionSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in knowYourAirQuestionSchema
    describe(".register()", () => {
      it("should create a new Question document", async () => {
        // Create test data
        const questionData = createTestQuestion();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(questionData);

        // Call the custom method
        const result = await knowYourAirQuestionSchema.statics.register(
          questionData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in knowYourAirQuestionSchema
    describe(".list()", () => {
      it("should return a list of Question documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestQuestion()]);

        // Call the custom method
        const result = await knowYourAirQuestionSchema.statics.list({
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

    // Example for testing the "modify" custom method in knowYourAirQuestionSchema
    describe(".modify()", () => {
      it("should modify an existing Question document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-question-id" };
        const update = { title: "Modified Question Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestQuestion(update));

        // Call the custom method
        const result = await knowYourAirQuestionSchema.statics.modify({
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

    // Example for testing the "remove" custom method in knowYourAirQuestionSchema
    describe(".remove()", () => {
      it("should remove an existing Question document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-question-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestQuestion());

        // Call the custom method
        const result = await knowYourAirQuestionSchema.statics.remove({ filter });

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
