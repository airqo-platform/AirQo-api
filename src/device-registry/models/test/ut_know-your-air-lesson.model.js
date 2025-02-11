require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const knowYourAirLessonSchema = require("@models/KnowYourAirLesson");

// Helper function to create a new test lesson object
const createTestLesson = (overrides = {}) => {
  return {
    title: "Test Lesson",
    image: "test-image.jpg",
    completion_message: "Test completion message",
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for knowYourAirLessonSchema
describe("knowYourAirLessonSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const lesson = new Schema(knowYourAirLessonSchema).validateSync(
        createTestLesson()
      );
      expect(lesson).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const lesson = new Schema(knowYourAirLessonSchema).validate(
        createTestLesson({ title: undefined })
      );
      expect(lesson.errors).to.haveOwnProperty("title");
    });

    it("should require 'image' field", () => {
      const lesson = new Schema(knowYourAirLessonSchema).validate(
        createTestLesson({ image: undefined })
      );
      expect(lesson.errors).to.haveOwnProperty("image");
    });

    it("should require 'completion_message' field", () => {
      const lesson = new Schema(knowYourAirLessonSchema).validate(
        createTestLesson({ completion_message: undefined })
      );
      expect(lesson.errors).to.haveOwnProperty("completion_message");
    });

    // Add more test cases for other properties and validations in knowYourAirLessonSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in knowYourAirLessonSchema
    describe(".register()", () => {
      it("should create a new Lesson document", async () => {
        // Create test data
        const lessonData = createTestLesson();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(lessonData);

        // Call the custom method
        const result = await knowYourAirLessonSchema.statics.register(
          lessonData
        );

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in knowYourAirLessonSchema
    describe(".list()", () => {
      it("should return a list of Lesson documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestLesson()]);

        // Call the custom method
        const result = await knowYourAirLessonSchema.statics.list({
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

    // Example for testing the "modify" custom method in knowYourAirLessonSchema
    describe(".modify()", () => {
      it("should modify an existing Lesson document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-lesson-id" };
        const update = { title: "Modified Lesson Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestLesson(update));

        // Call the custom method
        const result = await knowYourAirLessonSchema.statics.modify({
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

    // Example for testing the "remove" custom method in knowYourAirLessonSchema
    describe(".remove()", () => {
      it("should remove an existing Lesson document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-lesson-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestLesson());

        // Call the custom method
        const result = await knowYourAirLessonSchema.statics.remove({ filter });

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
