require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const sinon = require("sinon");
const knowYourAirTaskSchema = require("@models/KnowYourAirTask");

// Helper function to create a new test task object
const createTestTask = (overrides = {}) => {
  return {
    title: "Test Task",
    image: "test-image.jpg",
    content: "Test task content",
    kya_lesson: "lesson-id", // Replace with a valid lesson ID from your database if needed
    task_position: 1,
    // ... Add other properties as needed
    ...overrides,
  };
};

// Describe block for knowYourAirTaskSchema
describe("knowYourAirTaskSchema", () => {
  // Test cases for validation
  describe("Validation", () => {
    it("should be valid when all required fields are provided", () => {
      const task = new Schema(knowYourAirTaskSchema).validateSync(
        createTestTask()
      );
      expect(task).to.not.haveOwnProperty("errors");
    });

    it("should require 'title' field", () => {
      const task = new Schema(knowYourAirTaskSchema).validate(
        createTestTask({ title: undefined })
      );
      expect(task.errors).to.haveOwnProperty("title");
    });

    it("should require 'image' field", () => {
      const task = new Schema(knowYourAirTaskSchema).validate(
        createTestTask({ image: undefined })
      );
      expect(task.errors).to.haveOwnProperty("image");
    });

    it("should require 'content' field", () => {
      const task = new Schema(knowYourAirTaskSchema).validate(
        createTestTask({ content: undefined })
      );
      expect(task.errors).to.haveOwnProperty("content");
    });

    it("should require 'kya_lesson' field", () => {
      const task = new Schema(knowYourAirTaskSchema).validate(
        createTestTask({ kya_lesson: undefined })
      );
      expect(task.errors).to.haveOwnProperty("kya_lesson");
    });

    it("should require 'task_position' field", () => {
      const task = new Schema(knowYourAirTaskSchema).validate(
        createTestTask({ task_position: undefined })
      );
      expect(task.errors).to.haveOwnProperty("task_position");
    });

    // Add more test cases for other properties and validations in knowYourAirTaskSchema
  });

  // Test cases for custom methods
  describe("Custom Methods", () => {
    // Example for testing the "register" custom method in knowYourAirTaskSchema
    describe(".register()", () => {
      it("should create a new Task document", async () => {
        // Create test data
        const taskData = createTestTask();

        // Stub the "create" method of the model to return the test data
        const createStub = sinon
          .stub(Schema.prototype, "create")
          .resolves(taskData);

        // Call the custom method
        const result = await knowYourAirTaskSchema.statics.register(taskData);

        // Verify the result
        expect(result.success).to.be.true;
        expect(result.data).to.be.an("object");
        // Add more assertions for other properties and response

        // Restore the stub after the test
        createStub.restore();
      });
    });

    // Example for testing the "list" custom method in knowYourAirTaskSchema
    describe(".list()", () => {
      it("should return a list of Task documents", async () => {
        // Create test data or use real data from the database
        const filter = {};
        const limit = 10;
        const skip = 0;

        // Stub the "aggregate" method of the model to return the test data
        const aggregateStub = sinon
          .stub(Schema.prototype, "aggregate")
          .resolves([createTestTask()]);

        // Call the custom method
        const result = await knowYourAirTaskSchema.statics.list({
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

    // Example for testing the "modify" custom method in knowYourAirTaskSchema
    describe(".modify()", () => {
      it("should modify an existing Task document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-task-id" };
        const update = { title: "Modified Task Title" };
        const opts = { new: true };

        // Stub the "findOneAndUpdate" method of the model to return the test data
        const findOneAndUpdateStub = sinon
          .stub(Schema.prototype, "findOneAndUpdate")
          .resolves(createTestTask(update));

        // Call the custom method
        const result = await knowYourAirTaskSchema.statics.modify({
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

    // Example for testing the "remove" custom method in knowYourAirTaskSchema
    describe(".remove()", () => {
      it("should remove an existing Task document", async () => {
        // Create test data or use real data from the database
        const filter = { _id: "test-task-id" };

        // Stub the "findOneAndRemove" method of the model to return the test data
        const findOneAndRemoveStub = sinon
          .stub(Schema.prototype, "findOneAndRemove")
          .resolves(createTestTask());

        // Call the custom method
        const result = await knowYourAirTaskSchema.statics.remove({ filter });

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
