require("module-alias/register");
const { expect } = require("chai");
const { Schema } = require("mongoose");
const eventSchema = require("@models/Event");
// const valueSchema = require("");

// Helper function to create a new test value object
const createTestValue = (overrides = {}) => {
  return {
    time: new Date(),
    frequency: "test frequency",
    is_test_data: true,
    // ... Add other properties as needed
    ...overrides,
  };
};

// Helper function to create a new test event object
const createTestEvent = (overrides = {}) => {
  return {
    day: "test day",
    device: "test device",
    network: "test network",
    tenant: "test tenant",
    is_device_primary: true,
    // ... Add other properties as needed
    values: [createTestValue()],
    ...overrides,
  };
};

// Describe block for valueSchema
describe("valueSchema", () => {
  it("should be valid when all required fields are provided", () => {
    const value = new Schema(valueSchema).validateSync(createTestValue());
    expect(value).to.not.haveOwnProperty("errors");
  });

  it("should require 'time' field", () => {
    const value = new Schema(valueSchema).validate(
      createTestValue({ time: undefined })
    );
    expect(value.errors).to.haveOwnProperty("time");
  });

  it("should require 'frequency' field", () => {
    const value = new Schema(valueSchema).validate(
      createTestValue({ frequency: undefined })
    );
    expect(value.errors).to.haveOwnProperty("frequency");
  });

  // Add more test cases for other properties and validations in valueSchema
});

// Describe block for eventSchema
describe("eventSchema", () => {
  it("should be valid when all required fields are provided", () => {
    const event = new Schema(eventSchema).validateSync(createTestEvent());
    expect(event).to.not.haveOwnProperty("errors");
  });

  it("should require 'day' field", () => {
    const event = new Schema(eventSchema).validate(
      createTestEvent({ day: undefined })
    );
    expect(event.errors).to.haveOwnProperty("day");
  });

  it("should require 'values' field", () => {
    const event = new Schema(eventSchema).validate(
      createTestEvent({ values: undefined })
    );
    expect(event.errors).to.haveOwnProperty("values");
  });

  // Add more test cases for other properties and validations in eventSchema
});

describe("Custom methods", () => {
  // Example for testing a custom method in eventSchema
  it("createEvent should create a new Event document", async () => {
    // Create test data
    const eventData = createTestEvent();

    // Call the custom method
    const createdEvent = await eventSchema.statics.createEvent(eventData);

    // Verify that the createdEvent is saved to the database correctly
    expect(createdEvent).to.be.an("object");
    expect(createdEvent).to.haveOwnProperty("day", eventData.day);
    // Add more assertions for other properties
  });

  // Add more test cases for other custom methods, if any
});
