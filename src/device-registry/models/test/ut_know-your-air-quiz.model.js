require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const knowYourAirQuizSchema = require("@models/KnowYourAirQuiz");

// Helper function to create a new test quiz object
const createTestQuiz = (overrides = {}) => {
  return {
    title: "Test Quiz",
    image: "test-image.jpg",
    completion_message: "Test completion message",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for knowYourAirQuizSchema
describe("knowYourAirQuizSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const quiz = new Schema(knowYourAirQuizSchema).validateSync(
        createTestQuiz()
      );
      expect(quiz).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const quiz = new Schema(knowYourAirQuizSchema).validate(
        createTestQuiz({ title: undefined })
      );
      expect(quiz.errors).to.haveOwnProperty("title");
    });

    it("should require 'image' field", () => {
      const quiz = new Schema(knowYourAirQuizSchema).validate(
        createTestQuiz({ image: undefined })
      );
      expect(quiz.errors).to.haveOwnProperty("image");
    });

    it("should require 'completion_message' field", () => {
      const quiz = new Schema(knowYourAirQuizSchema).validate(
        createTestQuiz({ completion_message: undefined })
      );
      expect(quiz.errors).to.haveOwnProperty("completion_message");
    });

    it("should require 'description' field", () => {
      const quiz = new Schema(knowYourAirQuizSchema).validate(
        createTestQuiz({ description: undefined })
      );
      expect(quiz.errors).to.haveOwnProperty("description");
    });

    // Add more test cases for other properties and validations in knowYourAirQuizSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in knowYourAirQuizSchema
    describe(".register()", () => {
      it("should create a new Quiz document", async () => {
        // Create test data
        const quizData = createTestQuiz();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(quizData);

        // Call the custom method
        const result = await knowYourAirQuizSchema.statics.register(
          quizData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in knowYourAirQuizSchema
    describe(".list()", () => {
      it("should return a list of Quiz documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestQuiz()]);

        // Call the custom method
        const result = await knowYourAirQuizSchema.statics.list({
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

    // Example for testing the "modify" custom method in knowYourAirQuizSchema
    describe(".modify()", () => {
      it("should modify an existing Quiz document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-quiz-id" };
        const update = { title: "Modified Quiz Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestQuiz(update));

        // Call the custom method
        const result = await knowYourAirQuizSchema.statics.modify({
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

    // Example for testing the "remove" custom method in knowYourAirQuizSchema
    describe(".remove()", () => {
      it("should remove an existing Quiz document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-quiz-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestQuiz());

        // Call the custom method
        const result = await knowYourAirQuizSchema.statics.remove({ filter });

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
