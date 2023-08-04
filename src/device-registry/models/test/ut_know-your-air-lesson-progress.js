require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const userLessonProgressSchema = require("@models/KnowYourAirUserLessonProgress");

// Helper function to create a new test lesson progress object
const createTestLessonProgress = (overrides = {}) => {
  return {
    user_id: "test-user-id",
    lesson_id: "lesson-id", // Replace with a valid lesson ID from your database if needed
    completed: false,
    active_task: 0,
    status: "TODO",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for userLessonProgressSchema
describe("userLessonProgressSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const lessonProgress = new Schema(userLessonProgressSchema).validateSync(
        createTestLessonProgress()
      );
      expect(lessonProgress).to.not.haveOwnProperty("errors");
    });

    it("should require 'user_id' field", () => {
      const lessonProgress = new Schema(userLessonProgressSchema).validate(
        createTestLessonProgress({ user_id: undefined })
      );
      expect(lessonProgress.errors).to.haveOwnProperty("user_id");
    });

    it("should require 'lesson_id' field", () => {
      const lessonProgress = new Schema(userLessonProgressSchema).validate(
        createTestLessonProgress({ lesson_id: undefined })
      );
      expect(lessonProgress.errors).to.haveOwnProperty("lesson_id");
    });

    // Add more test cases for other properties and validations in userLessonProgressSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in userLessonProgressSchema
    describe(".register()", () => {
      it("should create a new Lesson Progress document", async () => {
        // Create test data
        const lessonProgressData = createTestLessonProgress();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(lessonProgressData);

        // Call the custom method
        const result = await userLessonProgressSchema.statics.register(
          lessonProgressData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in userLessonProgressSchema
    describe(".list()", () => {
      it("should return a list of Lesson Progress documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestLessonProgress()]);

        // Call the custom method
        const result = await userLessonProgressSchema.statics.list({
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

    // Example for testing the "modify" custom method in userLessonProgressSchema
    describe(".modify()", () => {
      it("should modify an existing Lesson Progress document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-lesson-progress-id" };
        const update = { completed: true };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestLessonProgress(update));

        // Call the custom method
        const result = await userLessonProgressSchema.statics.modify({
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

    // Example for testing the "remove" custom method in userLessonProgressSchema
    describe(".remove()", () => {
      it("should remove an existing Lesson Progress document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-lesson-progress-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestLessonProgress());

        // Call the custom method
        const result = await userLessonProgressSchema.statics.remove({
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
