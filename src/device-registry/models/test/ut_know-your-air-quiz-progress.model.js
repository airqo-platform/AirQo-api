require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const userQuizProgressSchema = require("@models/KnowYourAirUserQuizProgress");

// Helper function to create a new test quiz progress object
const createTestQuizProgress = (overrides = {}) => {
  return {
    user_id: "test-user-id",
    quiz_id: "quiz-id", // Replace with a valid quiz ID from your database if needed
    completed: false,
    active_task: 0,
    status: "TODO",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for userQuizProgressSchema
describe("userQuizProgressSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const quizProgress = new Schema(userQuizProgressSchema).validateSync(
        createTestQuizProgress()
      );
      expect(quizProgress).to.not.haveOwnProperty("errors");
    });

    it("should require 'user_id' field", () => {
      const quizProgress = new Schema(userQuizProgressSchema).validate(
        createTestQuizProgress({ user_id: undefined })
      );
      expect(quizProgress.errors).to.haveOwnProperty("user_id");
    });

    it("should require 'quiz_id' field", () => {
      const quizProgress = new Schema(userQuizProgressSchema).validate(
        createTestQuizProgress({ quiz_id: undefined })
      );
      expect(quizProgress.errors).to.haveOwnProperty("quiz_id");
    });

    // Add more test cases for other properties and validations in userQuizProgressSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in userQuizProgressSchema
    describe(".register()", () => {
      it("should create a new Quiz Progress document", async () => {
        // Create test data
        const quizProgressData = createTestQuizProgress();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(quizProgressData);

        // Call the custom method
        const result = await userQuizProgressSchema.statics.register(
          quizProgressData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in userQuizProgressSchema
    describe(".list()", () => {
      it("should return a list of Quiz Progress documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestQuizProgress()]);

        // Call the custom method
        const result = await userQuizProgressSchema.statics.list({
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

    // Example for testing the "modify" custom method in userQuizProgressSchema
    describe(".modify()", () => {
      it("should modify an existing Quiz Progress document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-quiz-progress-id" };
        const update = { completed: true };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestQuizProgress(update));

        // Call the custom method
        const result = await userQuizProgressSchema.statics.modify({
          filter,
          update,
          opts,
        });

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        expect(result.data.completed).to.equal(update.completed);
        // Add more assertions for the returned data

        // Restore the stub after the test
        findOneAndUpdateStub.restore();
      });
    });

    // Example for testing the "remove" custom method in userQuizProgressSchema
    describe(".remove()", () => {
      it("should remove an existing Quiz Progress document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-quiz-progress-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestQuizProgress());

        // Call the custom method
        const result = await userQuizProgressSchema.statics.remove({
          filter,
        });

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
