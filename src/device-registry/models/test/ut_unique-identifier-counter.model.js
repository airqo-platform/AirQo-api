require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { describe } = require("mocha");
const mongoose = require("mongoose");
const uniqueIdentifierCounterSchema = require("@models/UniqueIdentifierCounter"); //

describe("Unique Identifier Counter Model Unit Tests", () => {
  let Counter;

  before(async () => {
    // Connect to the test database
    await mongoose.connect("mongodb://localhost:27017/test-db", {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    Counter = mongoose.model("Counter", uniqueIdentifierCounterSchema);
  });

  after(async () => {
    // Close the database connection after all tests
    await mongoose.connection.close();
  });

  describe("Schema Definition", () => {
    it("Should be a valid Mongoose model", () => {
      expect(Counter).to.be.a("function");
    });

    it("Should have the required 'COUNT' field", () => {
      const countField = Counter.schema.obj.COUNT;
      expect(countField).to.exist;
      expect(countField.type).to.equal(Number);
      expect(countField.required).to.be.true;
    });

    it("Should have a unique 'COUNT' field", () => {
      const countField = Counter.schema.obj.COUNT;
      expect(countField.unique).to.be.true;
    });

    it("Should have the 'NOTES' field", () => {
      const notesField = Counter.schema.obj.NOTES;
      expect(notesField).to.exist;
      expect(notesField.type).to.equal(String);
    });

    it("Should have the required 'NAME' field", () => {
      const nameField = Counter.schema.obj.NAME;
      expect(nameField).to.exist;
      expect(nameField.type).to.equal(String);
      expect(nameField.required).to.be.true;
    });

    it("Should have a unique 'NAME' field", () => {
      const nameField = Counter.schema.obj.NAME;
      expect(nameField.unique).to.be.true;
    });
  });

  describe("Instance Methods", () => {
    // Add your instance method tests here
  });

  describe("Static Methods", () => {
    describe("Static Method 'modify'", () => {
      it("Should modify the counter document", async () => {
        // Prepare test data (if needed)
        const testData = {
          COUNT: 1,
          NOTES: "Test notes",
          NAME: "Test counter",
        };

        // Create a test counter document
        const createdCounter = await Counter.create(testData);

        // Prepare the update data
        const updateData = {
          COUNT: 5,
        };

        // Call the modify static method
        const response = await Counter.modify({
          filter: { _id: createdCounter._id },
          update: updateData,
        });

        // Assertions
        expect(response.success).to.be.true;
        expect(response.message).to.equal(
          "successfully modified the counter document"
        );
        expect(response.status).to.equal(200);
        expect(response.data).to.have.property("_id");
        expect(response.data).to.have.property("COUNT", 5);
        expect(response.data).to.have.property("NOTES", "Test notes");
        expect(response.data).to.have.property("NAME", "Test counter");
      });

      it("Should handle a non-existent counter document", async () => {
        // Prepare the filter for a non-existent counter document
        const filter = { _id: mongoose.Types.ObjectId() };

        // Prepare the update data
        const updateData = {
          COUNT: 10,
        };

        // Call the modify static method
        const response = await Counter.modify({ filter, update: updateData });

        // Assertions
        expect(response.success).to.be.false;
        expect(response.message).to.equal(
          "counter does not exist, please crosscheck"
        );
        expect(response.status).to.equal(400);
        expect(response.errors.message).to.equal(
          "can't locate the relevant counter document -- site_0"
        );
      });

      // Add more tests for other scenarios if necessary
    });
  });
});
