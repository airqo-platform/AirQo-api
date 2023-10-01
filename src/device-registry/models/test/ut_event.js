require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const Event = require("@models/Event");
const Schema = require("mongoose").Schema;
const HTTPStatus = require("http-status");

describe("Event Schema", () => {
  describe("createEvent", () => {
    it("should create an event", async () => {
      // Positive test cases
      // Test case 1: Create a basic event with minimal information
      const eventData1 = {
        title: "Basic Event",
        date: "2023-09-20",
      };
      const createdEvent1 = await createEvent(eventData1);
      assertEventEquals(createdEvent1, eventData1);

      // Test case 2: Create an event with additional details
      const eventData2 = {
        title: "Detailed Event",
        date: "2023-09-25",
        location: "Sample Location",
        description: "A detailed description of the event.",
      };
      const createdEvent2 = await createEvent(eventData2);
      assertEventEquals(createdEvent2, eventData2);

      // Test case 3: Create an event with more advanced options
      const eventData3 = {
        title: "Advanced Event",
        date: "2023-09-30",
        location: "Another Location",
        description: "An advanced event description.",
        attendees: ["User1", "User2"],
      };
      const createdEvent3 = await createEvent(eventData3);
      assertEventEquals(createdEvent3, eventData3);
    });

    it("should handle errors when creating an event", async () => {
      // Negative test cases and error handling
      // Test case 4: Try to create an event without a title (missing required field)
      const eventData4 = {
        date: "2023-09-20",
      };
      try {
        await createEvent(eventData4);
        // Add an assertion to check that this code path should not be reached
        assert.fail(
          "Expected an error, but the event was created successfully."
        );
      } catch (error) {
        assert.strictEqual(error.message, "Title is required.");
      }

      // Test case 5: Try to create an event with an invalid date format
      const eventData5 = {
        title: "Invalid Date Event",
        date: "2023/09/20", // Invalid date format
      };
      try {
        await createEvent(eventData5);
        assert.fail(
          "Expected an error, but the event was created successfully."
        );
      } catch (error) {
        assert.strictEqual(error.message, "Invalid date format.");
      }

      // Test case 6: Try to create an event with an empty object (no arguments)
      const eventData6 = {};
      try {
        await createEvent(eventData6);
        assert.fail(
          "Expected an error, but the event was created successfully."
        );
      } catch (error) {
        assert.strictEqual(error.message, "Event data is empty.");
      }
    });

    it("should handle boundary cases when creating an event", async () => {
      // Boundary test cases
      // Test case 7: Create an event with the minimum allowed date
      const eventData7 = {
        title: "Min Date Event",
        date: "1970-01-01", // Minimum date
      };
      const createdEvent7 = await createEvent(eventData7);
      assertEventEquals(createdEvent7, eventData7);

      // Test case 8: Create an event with the maximum allowed date
      const eventData8 = {
        title: "Max Date Event",
        date: "2100-12-31", // Maximum date
      };
      const createdEvent8 = await createEvent(eventData8);
      assertEventEquals(createdEvent8, eventData8);
    });
  });
  // Helper function to assert that the created event matches the expected data
  function assertEventEquals(createdEvent, expectedEvent) {
    assert.strictEqual(createdEvent.title, expectedEvent.title);
    assert.strictEqual(createdEvent.date, expectedEvent.date);
    assert.strictEqual(createdEvent.location, expectedEvent.location);
    assert.strictEqual(createdEvent.description, expectedEvent.description);
    assert.deepStrictEqual(createdEvent.attendees, expectedEvent.attendees);
  }

  describe("list()", () => {
    it("should return a list of events with default parameters", async () => {
      const result = await list();

      // Add assertions to check the structure and content of the result
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, HTTPStatus.OK);
      assert.strictEqual(
        result.message,
        "successfully returned the measurements"
      );
      // Add more specific assertions based on your expected result structure.
    });

    it("should return a list of events with custom parameters", async () => {
      const customParams = {
        skip: 10,
        limit: 20,
        filter: {
          tenant: "airqo",
          metadata: "site_id",
          recent: "no",
        },
        page: 2,
      };

      const result = await list(customParams);

      // Add assertions to check the structure and content of the result
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.status, HTTPStatus.OK);
      assert.strictEqual(
        result.message,
        "successfully returned the measurements"
      );
      // Add more specific assertions based on your expected result structure.
    });

    it("should handle errors and return an error response", async () => {
      // Simulate an error by passing invalid parameters
      const invalidParams = {
        filter: {
          invalidFilterKey: "invalidValue",
        },
      };

      const result = await list(invalidParams);

      // Add assertions to check that the function handles errors correctly
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.status, HTTPStatus.INTERNAL_SERVER_ERROR);
      assert.strictEqual(result.message, "Internal Server Error");
      // Add more specific assertions based on your expected error response.
    });
  });

  describe("view()", () => {
    it("should return a successful response with data", async () => {
      // Create a mock input
      const mockInput = {
        skip: 0,
        limit: 10,
        filter: { recent: "yes" },
        page: 1,
      };

      // Create a mock aggregation result
      const mockAggregationResult = [
        {
          data: [
            {
              // Add your mock measurement data here
              // Ensure it matches the structure expected in the function
            },
          ],
          total: [{ device: 5 }],
        },
      ];

      // Create a stub for the Event model's aggregate method
      const aggregateStub = sinon
        .stub(Event, "aggregate")
        .resolves(mockAggregationResult);

      // Call the view function with the mock input
      const result = await Event.view(mockInput);

      // Assert the expected result
      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal(mockAggregationResult);
      expect(result.message).to.equal("Successfully returned the measurements");
      expect(result.status).to.equal(HTTPStatus.OK);
      // Add more assertions for meta and other fields as needed

      // Restore the stub after the test
      aggregateStub.restore();
    });

    it("should handle errors and return an error response", async () => {
      // Create a mock input that triggers an error (e.g., invalid input)
      const mockInput = {
        skip: 0,
        limit: 10,
        filter: { invalidFilter: "yes" }, // This may trigger an error in the function
        page: 1,
      };

      // Create a stub for the Event model's aggregate method that throws an error
      const aggregateStub = sinon
        .stub(Event, "aggregate")
        .throws(new Error("Sample error"));

      // Call the view function with the mock input
      const result = await Event.view(mockInput);

      // Assert the expected error handling behavior
      expect(result.success).to.equal(false);
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Sample error");
      expect(result.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);

      // Restore the stub after the test
      aggregateStub.restore();
    });
  });
});
