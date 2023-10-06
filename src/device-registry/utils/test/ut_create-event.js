require("module-alias/register");
process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const EventModel = require("@models/Event");
const eventUtil = require("@utils/create-event");

const generateFilter = require("@utils/generate-filter");
const constants = require("@config/constants");
const { logObject, logText } = require("@utils/log");
const { Parser } = require("json2csv");
const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();
const { formatDate, addMonthsToProvideDateTime } = require("@utils/date");
const createHealthTips = require("@utils/create-health-tips");
const HealthTipSchema = require("@models/HealthTips");
const { getModelByTenant } = require("@config/database");
const { Kafka } = require("kafkajs");
const httpStatus = require("http-status");

// Mock Redis
const redis = {
  set: sinon.stub(),
  expire: sinon.stub(),
  get: sinon.stub(),
};

describe("create Event utils", function() {
  afterEach(() => {
    sinon.restore();
  });

  describe("listDevices", () => {
    it("should list devices successfully", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
          limit: 10,
          skip: 0,
          // Add other necessary properties for filtering, etc.
        },
      };

      // Mock the getModelByTenant function to return a device model with the desired list method
      const deviceModelMock = {
        list: sinon.stub().resolves({
          success: true,
          data: [
            // Replace with the necessary device data objects
          ],
        }),
      };
      const getModelByTenantStub = sinon.stub().resolves(deviceModelMock);

      // Call the function and assert
      const result = await eventUtil.listDevices(request, {
        getModelByTenant: getModelByTenantStub,
      });

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array");
      // Add more assertions based on the expected results of the eventUtil.listDevices function
    });

    it("should handle errors during device listing", async () => {
      // Mock the request object
      const request = {
        query: {
          tenant: "test_tenant",
          limit: 10,
          skip: 0,
          // Add other necessary properties for filtering, etc.
        },
      };

      // Mock the getModelByTenant function to return an error
      const getModelByTenantStub = sinon
        .stub()
        .rejects(new Error("Error message"));

      // Call the function and assert
      const result = await eventUtil.listDevices(request, {
        getModelByTenant: getModelByTenantStub,
      });

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Error message");
      // Add more assertions based on your error handling logic
    });

    // Add more test cases for different scenarios, e.g., pagination, filtering, etc.
  });
  describe("decryptKey", () => {
    it("should successfully decrypt the key", async () => {
      // Mock the encryptedKey
      const encryptedKey = "your_encrypted_key_here";

      // Call the function and assert
      const result = await eventUtil.decryptKey(encryptedKey);

      expect(result.success).to.be.true;
      expect(result.data).to.exist;
      // Add more assertions based on the expected decrypted key or status
    });

    it("should handle unknown or unrecognized keys", async () => {
      // Mock an unknown or unrecognized encrypted key
      const encryptedKey = "unknown_encrypted_key_here";

      // Call the function and assert
      const result = await eventUtil.decryptKey(encryptedKey);

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      // Add more assertions based on the expected status and message
    });

    it("should handle errors during key decryption", async () => {
      // Mock an error during decryption
      const encryptedKey = "your_encrypted_key_here";
      const cryptoJSStub = sinon
        .stub(cryptoJS.AES, "decrypt")
        .throws(new Error("Error message"));

      // Call the function and assert
      const result = await eventUtil.decryptKey(encryptedKey);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors.message).to.equal("Error message");
      // Add more assertions based on your error handling logic
      cryptoJSStub.restore(); // Restore the original decrypt method after the test
    });

    // Add more test cases for different scenarios if necessary
  });
  describe("create", function() {
    it("should create a new event", async function() {
      const stub = sinon
        .stub(EventModel(stubValue.tenant), "create")
        .returns(stubValue);

      const event = await eventUtil.createEvent(
        stubValue.tenant,
        stubValue.latitude,
        stubValue.longitude,
        stubValue.name
      );

      expect(stub.calledOnce).to.be.true;
      expect(event._id).to.equal(stubValue._id);
      expect(event.createdAt).to.equal(stubValue.createdAt);
      expect(event.updatedAt).to.equal(stubValue.updatedAt);
    });
  });
  describe("clear Events", function() {
    it("should clear the Events", async function() {
      const stub = sinon
        .stub(EventModel(stubValue.tenant), "delete")
        .returns(stubValue);

      const deletedEvent = await eventUtil.clearEventsOnPlatform(
        stubValue.tenant,
        stubValue.lat_long
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedEvent).to.not.be.empty;
      expect(deletedEvent).to.be.a("object");
      assert.equal(deletedEvent.success, true, "the event has been deleted");
    });
  });
  describe("getMeasurementsFromBigQuery", () => {
    it("should retrieve measurements successfully and return data", async () => {
      // Arrange
      const requestMock = {
        query: {
          frequency: "raw",
          device: "someDevice",
          // Add other required query parameters here
        },
      };

      const responseFromListStub = [
        {
          /* Add your test data here */
        },
      ];
      const responseFromGetQueryResultsStub = [
        {
          /* Add your test data here */
        },
      ];

      const createQueryJobStub = sinon.stub(bigquery, "createQueryJob");
      const getQueryResultsStub = sinon
        .stub()
        .resolves(responseFromGetQueryResultsStub);
      createQueryJobStub.resolves([{}, getQueryResultsStub]);

      // Replace the bigquery constructor in the getMeasurementsFromBigQuery object
      eventUtil.getMeasurementsFromBigQuery = eventUtil.getMeasurementsFromBigQuery.bind(
        {
          bigquery,
          generateFilter,
          cleanDeep,
          constants,
          logObject,
          logger,
          formatDate,
          addMonthsToProvideDateTime,
          createHealthTips,
          HealthTipSchema,
          getModelByTenant,
          Kafka,
          Parser,
        }
      );

      // Act
      const result = await eventUtil.getMeasurementsFromBigQuery(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromGetQueryResultsStub);
      // Add other assertions if needed
    });

    it("should handle internal server error during query job creation", async () => {
      // Arrange
      const requestMock = {
        query: {
          frequency: "raw",
          device: "someDevice",
          // Add other required query parameters here
        },
      };

      const error = new Error("Query job creation error");
      const createQueryJobStub = sinon.stub(bigquery, "createQueryJob");
      createQueryJobStub.rejects(error);

      // Replace the bigquery constructor in the getMeasurementsFromBigQuery object
      eventUtil.getMeasurementsFromBigQuery = eventUtil.getMeasurementsFromBigQuery.bind(
        {
          bigquery,
          generateFilter,
          cleanDeep,
          constants,
          logObject,
          logger,
          formatDate,
          addMonthsToProvideDateTime,
          createHealthTips,
          HealthTipSchema,
          getModelByTenant,
          Kafka,
          Parser,
        }
      );

      // Act
      const result = await eventUtil.getMeasurementsFromBigQuery(requestMock);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(error.message);
    });

    // Add more tests for the getMeasurementsFromBigQuery function if needed
  });
  describe("latestFromBigQuery", () => {
    it("should retrieve latest measurements successfully and return data", async () => {
      // Arrange
      const requestMock = {
        query: {
          frequency: "raw",
          device: "someDevice",
          // Add other required query parameters here
        },
      };

      const responseFromGetQueryResultsStub = [
        {
          /* Add your test data here */
        },
      ];
      const generateDateFormatWithoutHrsStub = sinon
        .stub()
        .returns("2023-07-04");
      const addMonthsToProvideDateTimeStub = sinon.stub().returns("2023-05-04");
      const createQueryJobStub = sinon.stub(bigquery, "createQueryJob");
      const getQueryResultsStub = sinon
        .stub()
        .resolves(responseFromGetQueryResultsStub);
      createQueryJobStub.resolves([{}, getQueryResultsStub]);

      // Replace the bigquery constructor in the latestFromBigQuery object
      eventUtil.latestFromBigQuery = eventUtil.latestFromBigQuery.bind({
        bigquery,
        constants,
        generateDateFormatWithoutHrs: generateDateFormatWithoutHrsStub,
        addMonthsToProvideDateTime: addMonthsToProvideDateTimeStub,
        createHealthTips,
        getModelByTenant,
        logObject,
      });

      // Act
      const result = await eventUtil.latestFromBigQuery(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromGetQueryResultsStub);
      // Add other assertions if needed
    });

    it("should handle internal server error during query job creation", async () => {
      // Arrange
      const requestMock = {
        query: {
          frequency: "raw",
          device: "someDevice",
          // Add other required query parameters here
        },
      };

      const error = new Error("Query job creation error");
      const generateDateFormatWithoutHrsStub = sinon
        .stub()
        .returns("2023-07-04");
      const addMonthsToProvideDateTimeStub = sinon.stub().returns("2023-05-04");
      const createQueryJobStub = sinon.stub(bigquery, "createQueryJob");
      createQueryJobStub.rejects(error);

      // Replace the bigquery constructor in the latestFromBigQuery object
      eventUtil.latestFromBigQuery = eventUtil.latestFromBigQuery.bind({
        bigquery,
        constants,
        generateDateFormatWithoutHrs: generateDateFormatWithoutHrsStub,
        addMonthsToProvideDateTime: addMonthsToProvideDateTimeStub,
        createHealthTips,
        getModelByTenant,
        logObject,
      });

      // Act
      const result = await eventUtil.latestFromBigQuery(requestMock);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(error.message);
    });

    // Add more tests for the latestFromBigQuery function if needed
  });
  describe("list", () => {
    it("should list events and return data when cache is available", async () => {
      // Arrange
      const requestMock = {
        query: {
          // Add required query parameters here
        },
      };

      const responseFromGenerateFilterStub = {
        success: true,
        data: {
          /* Add your filter data here */
        },
      };
      const getCacheStub = sinon.stub(createEvent, "getCache");
      getCacheStub.callsArgWith(1, {
        success: true,
        message: "Cache data available",
        data: {
          /* Add your cached data here */
        },
      });

      // Replace the eventUtil.getCache call in the list function
      eventUtil.list = eventUtil.list.bind({
        generateFilter,
        createEvent,
        getModelByTenant,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.list(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        /* Your expected data from the cache */
      });
      // Add other assertions if needed
    });

    it("should list events and return data when cache is not available", async () => {
      // Arrange
      const requestMock = {
        query: {
          // Add required query parameters here
        },
      };

      const responseFromGenerateFilterStub = {
        success: true,
        data: {
          /* Add your filter data here */
        },
      };
      const getCacheStub = sinon.stub(createEvent, "getCache");
      getCacheStub.callsArgWith(1, {
        success: false,
        message: "Cache data not available",
      });

      const responseFromGetDevicesCountStub = {
        success: true,
        data: 100, // Set your devices count here
      };
      const getDevicesCountStub = sinon
        .stub()
        .callsArgWith(1, responseFromGetDevicesCountStub);

      const responseFromListEventsStub = {
        success: true,
        data: [
          /* Add your list of events here */
        ],
      };
      const listStub = sinon
        .stub(EventModel.prototype, "list")
        .resolves(responseFromListEventsStub);

      // Replace the eventUtil.getCache and eventUtil.getDevicesCount calls in the list function
      eventUtil.list = eventUtil.list.bind({
        generateFilter,
        createEvent,
        getModelByTenant,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.list(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromListEventsStub.data);
      // Add other assertions if needed
    });

    it("should handle internal server error during cache retrieval", async () => {
      // Arrange
      const requestMock = {
        query: {
          // Add required query parameters here
        },
      };

      const error = new Error("Cache retrieval error");
      const getCacheStub = sinon.stub(createEvent, "getCache");
      getCacheStub.callsArgWith(1, {
        success: false,
        message: "Cache retrieval error",
        errors: { message: error.message },
      });

      // Replace the eventUtil.getCache call in the list function
      eventUtil.list = eventUtil.list.bind({
        generateFilter,
        createEvent,
        getModelByTenant,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.list(requestMock);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(error.message);
    });

    // Add more tests for the list function if needed
  });
  describe("create", () => {
    it("should add events successfully and return success response", async () => {
      // Arrange
      const requestMock = {
        /* Add your request data here */
      };

      const responseFromTransformEventStub = {
        success: true,
        data: [
          /* Add your transformed events data here */
        ],
      };
      const transformManyEventsStub = sinon
        .stub(createEvent, "transformManyEvents")
        .resolves(responseFromTransformEventStub);

      const responseFromUpdateOneStub = {
        /* Add your response data from EventModel.updateOne here, if needed */
      };
      const updateOneStub = sinon
        .stub(EventModel.prototype, "updateOne")
        .resolves(responseFromUpdateOneStub);

      // Replace the eventUtil.transformManyEvents and EventModel.updateOne calls in the create function
      eventUtil.create = eventUtil.create.bind({
        createEvent,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.create(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully added all the events");
      // Add other assertions if needed
    });

    it("should handle conflicts and return response with some errors", async () => {
      // Arrange
      const requestMock = {
        /* Add your request data here */
      };

      const responseFromTransformEventStub = {
        success: true,
        data: [
          /* Add your transformed events data here */
        ],
      };
      const transformManyEventsStub = sinon
        .stub(createEvent, "transformManyEvents")
        .resolves(responseFromTransformEventStub);

      // Mock the updateOne function to return some conflicts
      const responseFromUpdateOneStub = null;
      const updateOneStub = sinon
        .stub(EventModel.prototype, "updateOne")
        .resolves(responseFromUpdateOneStub);

      // Replace the eventUtil.transformManyEvents and EventModel.updateOne calls in the create function
      eventUtil.create = eventUtil.create.bind({
        createEvent,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.create(requestMock);

      // Assert
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.CONFLICT);
      expect(result.message).to.equal("all operations failed with conflicts");
      expect(result.errors).to.be.an("array").that.is.not.empty;
      // Add other assertions if needed
    });

    it("should handle conflicts and return response with some successes and errors", async () => {
      // Arrange
      const requestMock = {
        /* Add your request data here */
      };

      const responseFromTransformEventStub = {
        success: true,
        data: [
          /* Add your transformed events data here */
        ],
      };
      const transformManyEventsStub = sinon
        .stub(createEvent, "transformManyEvents")
        .resolves(responseFromTransformEventStub);

      // Mock the updateOne function to return some successes and some conflicts
      const responseFromUpdateOneStub = [
        /* Add your successful updates here, if needed */
        null, // Add null or false for events with conflicts
      ];
      const updateOneStub = sinon
        .stub(EventModel.prototype, "updateOne")
        .resolves(responseFromUpdateOneStub);

      // Replace the eventUtil.transformManyEvents and EventModel.updateOne calls in the create function
      eventUtil.create = eventUtil.create.bind({
        createEvent,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.create(requestMock);

      // Assert
      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.message).to.equal(
        "finished the operation with some conflicts"
      );
      expect(result.errors).to.be.an("array").that.is.not.empty;
      // Add other assertions if needed
    });

    it("should handle internal server error during event creation", async () => {
      // Arrange
      const requestMock = {
        /* Add your request data here */
      };

      const error = new Error("Internal Server Error");
      const responseFromTransformEventStub = {
        success: true,
        data: [
          /* Add your transformed events data here */
        ],
      };
      const transformManyEventsStub = sinon
        .stub(createEvent, "transformManyEvents")
        .resolves(responseFromTransformEventStub);

      const updateOneStub = sinon
        .stub(EventModel.prototype, "updateOne")
        .rejects(error);

      // Replace the eventUtil.transformManyEvents and EventModel.updateOne calls in the create function
      eventUtil.create = eventUtil.create.bind({
        createEvent,
        EventModel,
        logObject,
        logText,
      });

      // Act
      const result = await eventUtil.create(requestMock);

      // Assert
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(error.message);
    });

    // Add more tests for the create function if needed
  });
  describe("generateOtherDataString", () => {
    it("should return a comma-separated string of values from the input object", () => {
      // Arrange
      const inputObject = {
        field1: "value1",
        field2: "value2",
        field3: "value3",
      };

      // Act
      const result = eventUtil.generateOtherDataString(inputObject);

      // Assert
      expect(result)
        .to.be.a("string")
        .and.equal("value1,value2,value3");
    });

    it("should return an empty string if the input object is empty", () => {
      // Arrange
      const inputObject = {};

      // Act
      const result = eventUtil.generateOtherDataString(inputObject);

      // Assert
      expect(result)
        .to.be.a("string")
        .and.equal("");
    });

    // Add more tests for edge cases or specific scenarios if needed
  });

  describe("createThingSpeakRequestBody", () => {
    it("should create a lowCostRequestBody when the category is 'lowcost'", () => {
      // Arrange
      const req = {
        body: {
          api_key: "API_KEY",
          time: "2023-07-04T12:00:00Z",
          s1_pm2_5: 10,
          s1_pm10: 15,
          s2_pm2_5: 8,
          s2_pm10: 12,
          latitude: 37.7749,
          longitude: -122.4194,
          battery: 85,
          status: "online",
          altitude: 50,
          wind_speed: 10,
          satellites: 12,
          hdop: 0.8,
          internal_temperature: 25,
          internal_humidity: 60,
          external_temperature: 20,
          external_humidity: 70,
          external_pressure: 1000,
          external_altitude: 45,
          category: "lowcost",
          rtc_adc: 800,
          rtc_v: 3.3,
          rtc: 25,
          stc_adc: 820,
          stc_v: 3.4,
          stc: 28,
        },
      };

      // Act
      const result = eventUtil.createThingSpeakRequestBody(req);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        api_key: "API_KEY",
        created_at: "2023-07-04T12:00:00Z",
        field1: 10,
        field2: 15,
        field3: 8,
        field4: 12,
        field5: 37.7749,
        field6: -122.4194,
        field7: 85,
        field8: "37.7749,-122.4194,50,10,12,0.8,25,60,20,70,1000,45,lowcost",
        latitude: 37.7749,
        longitude: -122.4194,
        status: "online",
      });
    });

    it("should create a bamRequestBody when the category is 'bam'", () => {
      // Arrange
      const req = {
        body: {
          api_key: "API_KEY",
          time: "2023-07-04T12:00:00Z",
          s1_pm2_5: null,
          s1_pm10: null,
          s2_pm2_5: null,
          s2_pm10: null,
          latitude: 37.7749,
          longitude: -122.4194,
          battery: 75,
          status: "offline",
          altitude: null,
          wind_speed: null,
          satellites: null,
          hdop: null,
          internal_temperature: null,
          internal_humidity: null,
          external_temperature: null,
          external_humidity: null,
          external_pressure: null,
          external_altitude: null,
          category: "bam",
          rtc_adc: 900,
          rtc_v: 3.2,
          rtc: 22,
          stc_adc: 880,
          stc_v: 3.1,
          stc: 21,
        },
      };

      // Act
      const result = eventUtil.createThingSpeakRequestBody(req);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        api_key: "API_KEY",
        created_at: "2023-07-04T12:00:00Z",
        field1: 900,
        field2: 3.2,
        field3: 22,
        field4: 880,
        field5: 3.1,
        field6: 21,
        field7: 75,
        field8: "37.7749,-122.4194,,,,,0.8,,,20,,1000,,bam",
        latitude: 37.7749,
        longitude: -122.4194,
        status: "offline",
      });
    });

    it("should return an error response if there is an internal server error", () => {
      // Arrange
      const req = {
        body: {
          // Missing required fields, causing an error
        },
      };

      // Act
      const result = eventUtil.createThingSpeakRequestBody(req);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.be.an("object");
    });

    // Add more tests for edge cases or specific scenarios if needed
  });

  describe("transmitMultipleSensorValues", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return an error response if no matching devices found", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };

      // Stub the list function to return a failure response indicating no matching devices
      sinon.stub(createEvent, "list").resolves({
        success: false,
        message: "no matching devices found",
      });

      // Act
      const result = await eventUtil.transmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("no matching devices found");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return an error response if unable to categorize the device", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };

      // Stub the list function to return a success response with an empty category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [{ category: null }],
      });

      // Act
      const result = await eventUtil.transmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "unable to categorise this device, please first update device details"
      );
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.be.an("object");
    });

    it("should return an error response if createThingSpeakRequestBody fails", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: "lowcost" };

      // Stub the list function to return a success response with a category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Stub the createThingSpeakRequestBody function to return a failure response
      sinon.stub(createEvent, "createThingSpeakRequestBody").returns({
        success: false,
        message: "Failed to create ThingSpeak request body",
      });

      // Act
      const result = await eventUtil.transmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "Failed to create ThingSpeak request body"
      );
    });

    it("should return an error response if eventUtil.decryptKey fails", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: "lowcost", writeKey: "ENCRYPTED_KEY" };

      // Stub the list function to return a success response with a category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Stub the createThingSpeakRequestBody function to return a success response
      sinon.stub(createEvent, "createThingSpeakRequestBody").returns({
        success: true,
        data: {
          api_key: "API_KEY",
          // ... other data ...
        },
      });

      // Stub the eventUtil.decryptKey function to return a failure response
      sinon.stub(createEvent, "eventUtil.decryptKey").resolves({
        success: false,
        message: "Failed to decrypt the key",
      });

      // Act
      const result = await eventUtil.transmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to decrypt the key");
    });

    it("should return a success response and transmit data to ThingSpeak successfully", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: "lowcost", writeKey: "ENCRYPTED_KEY" };

      // Stub the list function to return a success response with a category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Stub the createThingSpeakRequestBody function to return a success response
      sinon.stub(createEvent, "createThingSpeakRequestBody").returns({
        success: true,
        data: {
          api_key: "API_KEY",
          // ... other data ...
        },
      });

      // Stub the eventUtil.decryptKey function to return a success response
      sinon.stub(createEvent, "eventUtil.decryptKey").resolves({
        success: true,
        data: "DECRYPTED_KEY",
      });

      // Stub the axios.post function to return a success response
      sinon.stub(axios, "post").resolves({
        data: {
          channel_id: "CHANNEL_ID",
          created_at: "2023-07-04T12:00:00Z",
          entry_id: "ENTRY_ID",
        },
      });

      // Act
      const result = await eventUtil.transmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully transmitted the data");
      expect(result.data).to.deep.equal({
        channel_id: "CHANNEL_ID",
        created_at: "2023-07-04T12:00:00Z",
        entry_id: "ENTRY_ID",
      });
    });

    // Add more tests for other scenarios as needed
  });

  describe("bulkTransmitMultipleSensorValues", () => {
    afterEach(() => {
      sinon.restore();
    });

    it("should return an error response if no matching devices found", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };

      // Stub the list function to return a failure response indicating no matching devices
      sinon.stub(createEvent, "list").resolves({
        success: false,
        message: "device not found for this organisation",
      });

      // Act
      const result = await eventUtil.bulkTransmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("device not found for this organisation");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("should return an error response if unable to categorize the device", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: null };

      // Stub the list function to return a success response with an empty category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Act
      const result = await eventUtil.bulkTransmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "unable to categorise this device, please first update device details"
      );
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("should return an error response if eventUtil.decryptKey fails", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: "lowcost", writeKey: "ENCRYPTED_KEY" };

      // Stub the list function to return a success response with a category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Stub the eventUtil.decryptKey function to return a failure response
      sinon.stub(createEvent, "eventUtil.decryptKey").resolves({
        success: false,
        message: "Failed to decrypt the key",
      });

      // Act
      const result = await eventUtil.bulkTransmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to decrypt the key");
    });

    it("should return a success response and transmit data to ThingSpeak successfully", async () => {
      // Arrange
      const request = {
        // ... Some test data ...
      };
      const deviceDetail = { category: "lowcost", writeKey: "ENCRYPTED_KEY" };

      // Stub the list function to return a success response with a category
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [deviceDetail],
      });

      // Stub the eventUtil.decryptKey function to return a success response
      sinon.stub(createEvent, "eventUtil.decryptKey").resolves({
        success: true,
        data: "DECRYPTED_KEY",
      });

      // Stub the eventUtil.transformMeasurementFields function to return a success response
      sinon.stub(createEvent, "transformMeasurementFields").resolves({
        success: true,
        data: {
          // ... Some transformed data ...
        },
      });

      // Stub the axios.post function to return a success response
      sinon.stub(axios, "post").resolves({
        data: {
          // ... Some response data ...
        },
      });

      // Act
      const result = await eventUtil.bulkTransmitMultipleSensorValues(request);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully transmitted the data");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({
        // ... Expected data from the response ...
      });
    });

    // Add more tests for other scenarios as needed
  });

  describe("generateCacheID", () => {
    it("should generate a cache ID with all provided query parameters", () => {
      // Arrange
      const request = {
        query: {
          device: "DeviceA",
          device_number: "123",
          device_id: "DeviceID1",
          site: "SiteA",
          site_id: "SiteID1",
          airqloud_id: "AirQloudID1",
          airqloud: "AirQloudA",
          tenant: "Tenant1",
          skip: 10,
          limit: 50,
          frequency: "raw",
          startTime: "2023-07-01T00:00:00.000Z",
          endTime: "2023-07-03T00:00:00.000Z",
          metadata: true,
          external: false,
          recent: "yes",
          lat_long: "40.7128,-74.0060",
          page: 2,
          index: 3,
          running: true,
          brief: false,
          latitude: "40.7128",
          longitude: "-74.0060",
          network: "WiFi",
        },
      };

      // Act
      const cacheID = eventUtil.generateCacheID(request);

      // Assert
      expect(cacheID).to.equal(
        "list_events_DeviceA_Tenant1_10_50_yes_raw_2023-07-03T00:00:00.000Z_2023-07-01T00:00:00.000Z_DeviceID1_SiteA_SiteID1_2023-07-03_noDeviceNumber_true_AirQloudA_AirQloudID1_40.7128,-74.0060_2_3_false_false_40.7128_-74.0060__WiFi"
      );
    });

    it("should generate a cache ID with default values for missing query parameters", () => {
      // Arrange
      const request = {
        query: {
          tenant: "Tenant2",
        },
      };

      // Act
      const cacheID = eventUtil.generateCacheID(request);

      // Assert
      expect(cacheID).to.equal(
        "list_events_noDevice_Tenant2_0_0_noRecent_noFrequency_noEndTime_noStartTime_noDeviceId_noSite_noSiteId_noDay_noDeviceNumber_noMetadata_noExternal_noAirQloud_noAirQloudID_noLatLong_noPage_noIndex_noLatitude_noLongitude__noNetwork"
      );
    });
  });

  describe("setCache", () => {
    it("should store data in cache with the generated cache ID", () => {
      // Arrange
      const data = [
        { id: 1, value: "Measurement 1" },
        { id: 2, value: "Measurement 2" },
      ];
      const request = {
        query: {
          device: "DeviceA",
          tenant: "Tenant1",
          skip: 10,
          limit: 50,
          frequency: "raw",
        },
      };
      const callback = sinon.stub();

      // Act
      eventUtil.setCache(data, request);

      // Assert
      const cacheID = eventUtil.generateCacheID(request);
      expect(redis.set.calledOnceWith(cacheID)).to.be.true;
      expect(
        redis.expire.calledOnceWith(
          cacheID,
          parseInt(constants.EVENTS_CACHE_LIMIT)
        )
      ).to.be.true;
      expect(
        callback.calledOnceWith({
          success: true,
          message: "response stored in cache",
          status: httpStatus.OK,
        })
      ).to.be.true;
    });

    it("should call the callback with an error message in case of an internal server error", () => {
      // Arrange
      const data = [
        { id: 1, value: "Measurement 1" },
        { id: 2, value: "Measurement 2" },
      ];
      const request = {
        query: {
          tenant: "Tenant2",
        },
      };
      const callback = sinon.stub();

      // Mock an internal server error by causing an exception
      const redisError = new Error("Redis connection error");
      redis.set.throws(redisError);

      // Act
      eventUtil.setCache(data, request);

      // Assert
      expect(
        callback.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: redisError.message },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        })
      ).to.be.true;
    });
  });

  describe("getCache", () => {
    it("should return data from cache if present", () => {
      // Arrange
      const request = {
        query: {
          device: "DeviceA",
          tenant: "Tenant1",
          skip: 10,
          limit: 50,
          frequency: "raw",
        },
      };
      const cacheData = {
        isCache: true,
        success: true,
        message: "successfully retrieved the measurements",
        data: [
          { id: 1, value: "Measurement 1" },
          { id: 2, value: "Measurement 2" },
        ],
      };
      const callback = sinon.stub();

      // Mock Redis get operation
      redis.get
        .withArgs(
          "list_events_DeviceA_Tenant1_10_50_raw_noEndTime_noStartTime_noDeviceId_noSite_noSiteId_noDay_noDeviceNumber_noMetadata_noExternal_noAirQloud_noAirQloudID_noLatLong_noPage_noRunning_noIndex_noBrief_noLatitude_noLongitude__noNetwork"
        )
        .yields(null, JSON.stringify(cacheData));

      // Act
      eventUtil.getCache(request);

      // Assert
      expect(redis.get.calledOnce).to.be.true;
      expect(
        callback.calledOnceWith({
          success: true,
          message: "utilising cache...",
          data: cacheData,
          status: httpStatus.OK,
        })
      ).to.be.true;
    });

    it("should call the callback with an error message if there's an error fetching from cache", () => {
      // Arrange
      const request = {
        query: {
          device: "DeviceB",
          tenant: "Tenant2",
          skip: 5,
          limit: 20,
          frequency: "averaged",
        },
      };
      const callback = sinon.stub();

      // Mock an error while fetching from Redis
      const redisError = new Error("Redis connection error");
      redis.get
        .withArgs(
          "list_events_DeviceB_Tenant2_5_20_averaged_noEndTime_noStartTime_noDeviceId_noSite_noSiteId_noDay_noDeviceNumber_noMetadata_noExternal_noAirQloud_noAirQloudID_noLatLong_noPage_noRunning_noIndex_noBrief_noLatitude_noLongitude__noNetwork"
        )
        .yields(redisError);

      // Act
      eventUtil.getCache(request);

      // Assert
      expect(redis.get.calledOnce).to.be.true;
      expect(
        callback.calledOnceWith({
          success: false,
          message: "Internal Server Error",
          errors: { message: redisError.message },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        })
      ).to.be.true;
    });

    it("should call the callback with a message if there's no cache present", () => {
      // Arrange
      const request = {
        query: {
          device: "DeviceC",
          tenant: "Tenant3",
          skip: 0,
          limit: 100,
          frequency: "raw",
        },
      };
      const callback = sinon.stub();

      // Mock Redis get operation with no cache
      redis.get
        .withArgs(
          "list_events_DeviceC_Tenant3_0_100_raw_noEndTime_noStartTime_noDeviceId_noSite_noSiteId_noDay_noDeviceNumber_noMetadata_noExternal_noAirQloud_noAirQloudID_noLatLong_noPage_noRunning_noIndex_noBrief_noLatitude_noLongitude__noNetwork"
        )
        .yields(null, null);

      // Act
      eventUtil.getCache(request);

      // Assert
      expect(redis.get.calledOnce).to.be.true;
      expect(
        callback.calledOnceWith({
          success: false,
          message: "no cache present",
          errors: { message: "no cache present" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        })
      ).to.be.true;
    });
  });

  describe("transformOneEvent", () => {
    it("should return successfully transformed event data", async () => {
      // Arrange
      const eventData = {
        id: 1,
        pm2_5: 10,
        pm10: 20,
        temperature: 25,
      };
      const map = {
        pm2_5: "field1",
        pm10: "field2",
        temperature: "field3",
      };
      const context = {
        tenant: "Tenant1",
        device: "DeviceA",
        site: "SiteX",
      };
      const transformedEvent = {
        field1: 10,
        field2: 20,
        field3: 25,
      };

      // Stub the enrichOneEvent function to return the transformed event data
      const enrichOneEventStub = sinon.stub(createEvent, "enrichOneEvent");
      enrichOneEventStub.resolves({
        success: true,
        data: transformedEvent,
      });

      // Act
      const result = await eventUtil.transformOneEvent({
        data: eventData,
        map,
        context,
      });

      // Assert
      expect(enrichOneEventStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully transformed the provided event",
        data: transformedEvent,
      });

      // Restore the stub
      enrichOneEventStub.restore();
    });

    it("should return an error if the enrichment fails", async () => {
      // Arrange
      const eventData = {
        id: 2,
        pm2_5: 15,
        pm10: 25,
        temperature: 30,
      };
      const map = {
        pm2_5: "field1",
        pm10: "field2",
        temperature: "field3",
      };
      const context = {
        tenant: "Tenant2",
        device: "DeviceB",
        site: "SiteY",
      };

      // Stub the enrichOneEvent function to return an error
      const enrichOneEventStub = sinon.stub(createEvent, "enrichOneEvent");
      enrichOneEventStub.resolves({
        success: false,
        message: "Unable to enrich event",
        status: 500,
      });

      // Act
      const result = await eventUtil.transformOneEvent({
        data: eventData,
        map,
        context,
      });

      // Assert
      expect(enrichOneEventStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "unable to enrich event using device details",
        errors: { message: "Unable to enrich event" },
        status: 500,
      });

      // Restore the stub
      enrichOneEventStub.restore();
    });

    it("should return an error if the transformed result is empty", async () => {
      // Arrange
      const eventData = {
        id: 3,
        pm2_5: 5,
        pm10: 15,
        temperature: 20,
      };
      const map = {
        pm2_5: "field1",
        pm10: "field2",
        temperature: "field3",
      };
      const context = {
        tenant: "Tenant3",
        device: "DeviceC",
        site: "SiteZ",
      };

      // Stub the enrichOneEvent function to return an empty result
      const enrichOneEventStub = sinon.stub(createEvent, "enrichOneEvent");
      enrichOneEventStub.resolves({
        success: true,
        data: {},
      });

      // Act
      const result = await eventUtil.transformOneEvent({
        data: eventData,
        map,
        context,
      });

      // Assert
      expect(enrichOneEventStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message:
          "the request body for the external system is empty after transformation",
      });

      // Restore the stub
      enrichOneEventStub.restore();
    });

    it("should handle internal server error", async () => {
      // Arrange
      const eventData = {
        id: 4,
        pm2_5: 8,
        pm10: 18,
        temperature: 28,
      };
      const map = {
        pm2_5: "field1",
        pm10: "field2",
        temperature: "field3",
      };
      const context = {
        tenant: "Tenant4",
        device: "DeviceD",
        site: "SiteW",
      };

      // Stub the enrichOneEvent function to throw an error
      const enrichOneEventStub = sinon.stub(createEvent, "enrichOneEvent");
      enrichOneEventStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.transformOneEvent({
        data: eventData,
        map,
        context,
      });

      // Assert
      expect(enrichOneEventStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "server error - transform util",
        errors: { message: "Internal server error" },
      });

      // Restore the stub
      enrichOneEventStub.restore();
    });
  });

  describe("enrichOneEvent", () => {
    it("should enrich and return successfully", async () => {
      // Arrange
      const transformedEvent = {
        id: 1,
        pm2_5: 10,
        pm10: 20,
        temperature: 25,
        filter: { device: "DeviceA" },
        tenant: "Tenant1",
      };

      // Stub the list function to return device details
      const listStub = sinon.stub(createEvent, "list");
      listStub.resolves({
        success: true,
        data: [
          {
            id: 1,
            device: "DeviceA",
            isActive: true,
            isPrimaryInLocation: true,
          },
        ],
      });

      // Act
      const result = await eventUtil.enrichOneEvent(transformedEvent);

      // Assert
      expect(listStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully enriched",
        data: {
          id: 1,
          pm2_5: 10,
          pm10: 20,
          temperature: 25,
          filter: { device: "DeviceA" },
          tenant: "Tenant1",
          is_test_data: false,
          is_device_primary: true,
        },
      });

      // Restore the stub
      listStub.restore();
    });

    it("should return an error when device details not found", async () => {
      // Arrange
      const transformedEvent = {
        id: 2,
        pm2_5: 15,
        pm10: 25,
        temperature: 30,
        filter: { device: "DeviceB" },
        tenant: "Tenant2",
      };

      // Stub the list function to return an empty response
      const listStub = sinon.stub(createEvent, "list");
      listStub.resolves({
        success: true,
        data: [],
      });

      // Act
      const result = await eventUtil.enrichOneEvent(transformedEvent);

      // Assert
      expect(listStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "unable to find one device matching provided details",
        status: 400,
      });

      // Restore the stub
      listStub.restore();
    });

    it("should handle internal server error", async () => {
      // Arrange
      const transformedEvent = {
        id: 3,
        pm2_5: 5,
        pm10: 15,
        temperature: 20,
        filter: { device: "DeviceC" },
        tenant: "Tenant3",
      };

      // Stub the list function to throw an error
      const listStub = sinon.stub(createEvent, "list");
      listStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.enrichOneEvent(transformedEvent);

      // Assert
      expect(listStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Internal Server Error",
        errors: { message: "Internal server error" },
      });

      // Restore the stub
      listStub.restore();
    });
  });

  describe("transformManyEvents", () => {
    it("should transform and return successfully", async () => {
      // Arrange
      const request = {
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformOneEvent function to return successful responses
      const transformOneEventStub = sinon.stub(
        createEvent,
        "transformOneEvent"
      );
      transformOneEventStub.onCall(0).resolves({
        success: true,
        data: { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
      });
      transformOneEventStub.onCall(1).resolves({
        success: true,
        data: { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
      });
      transformOneEventStub.onCall(2).resolves({
        success: true,
        data: { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
      });

      // Act
      const result = await eventUtil.transformManyEvents(request);

      // Assert
      expect(transformOneEventStub.callCount).to.equal(3);
      expect(result).to.deep.equal({
        success: true,
        message: "transformation successfully done",
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
        status: 200,
      });

      // Restore the stub
      transformOneEventStub.restore();
    });

    it("should handle errors during transformation", async () => {
      // Arrange
      const request = {
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformOneEvent function to return some unsuccessful responses
      const transformOneEventStub = sinon.stub(
        createEvent,
        "transformOneEvent"
      );
      transformOneEventStub.onCall(0).resolves({
        success: true,
        data: { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
      });
      transformOneEventStub.onCall(1).resolves({
        success: false,
        errors: { message: "Unable to transform event 2" },
      });
      transformOneEventStub.onCall(2).resolves({
        success: true,
        data: { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
      });

      // Act
      const result = await eventUtil.transformManyEvents(request);

      // Assert
      expect(transformOneEventStub.callCount).to.equal(3);
      expect(result).to.deep.equal({
        success: false,
        errors: [
          { message: "" },
          { message: "Unable to transform event 2" },
          { message: "" },
        ],
        message: "some operational errors as we were trying to transform",
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          undefined,
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
        status: 400,
      });

      // Restore the stub
      transformOneEventStub.restore();
    });

    it("should handle internal server error during transformation", async () => {
      // Arrange
      const request = {
        body: [{ id: 1, pm2_5: 10, pm10: 20, temperature: 25 }],
      };

      // Stub the transformOneEvent function to throw an error
      const transformOneEventStub = sinon.stub(
        createEvent,
        "transformOneEvent"
      );
      transformOneEventStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.transformManyEvents(request);

      // Assert
      expect(transformOneEventStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "server side error - transformEvents",
        errors: { message: "Internal server error" },
        status: 500,
      });

      // Restore the stub
      transformOneEventStub.restore();
    });
  });

  describe("addEvents", () => {
    it("should add events successfully", async () => {
      // Arrange
      const request = {
        query: { tenant: "exampleTenant" },
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformManyEvents function to return successful responses
      const transformManyEventsStub = sinon.stub(
        createEvent,
        "transformManyEvents"
      );
      transformManyEventsStub.resolves({
        success: true,
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
      });

      // Stub the insertTransformedEvents function to return a successful response
      const insertTransformedEventsStub = sinon.stub(
        createEvent,
        "insertTransformedEvents"
      );
      insertTransformedEventsStub.resolves({
        success: true,
        message: "Events added successfully",
        status: 201,
      });

      // Act
      const result = await eventUtil.addEvents(request);

      // Assert
      expect(transformManyEventsStub.calledOnce).to.be.true;
      expect(insertTransformedEventsStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "Events added successfully",
        status: 201,
      });

      // Restore the stubs
      transformManyEventsStub.restore();
      insertTransformedEventsStub.restore();
    });

    it("should handle errors during transformation", async () => {
      // Arrange
      const request = {
        query: { tenant: "exampleTenant" },
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformManyEvents function to return an unsuccessful response
      const transformManyEventsStub = sinon.stub(
        createEvent,
        "transformManyEvents"
      );
      transformManyEventsStub.resolves({
        success: false,
        errors: [{ message: "Unable to transform event 2" }],
        message: "some operational errors as we were trying to transform",
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          undefined,
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
        status: 400,
      });

      // Act
      const result = await eventUtil.addEvents(request);

      // Assert
      expect(transformManyEventsStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        errors: [{ message: "Unable to transform event 2" }],
        message: "some operational errors as we were trying to transform",
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          undefined,
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
        status: 400,
      });

      // Restore the stub
      transformManyEventsStub.restore();
    });

    it("should handle errors during insertion", async () => {
      // Arrange
      const request = {
        query: { tenant: "exampleTenant" },
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformManyEvents function to return successful response
      const transformManyEventsStub = sinon.stub(
        createEvent,
        "transformManyEvents"
      );
      transformManyEventsStub.resolves({
        success: true,
        data: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
        ],
      });

      // Stub the insertTransformedEvents function to return an unsuccessful response
      const insertTransformedEventsStub = sinon.stub(
        createEvent,
        "insertTransformedEvents"
      );
      insertTransformedEventsStub.resolves({
        success: false,
        message: "Failed to insert events",
        status: 500,
      });

      // Act
      const result = await eventUtil.addEvents(request);

      // Assert
      expect(transformManyEventsStub.calledOnce).to.be.true;
      expect(insertTransformedEventsStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "Failed to insert events",
        status: 500,
      });

      // Restore the stubs
      transformManyEventsStub.restore();
      insertTransformedEventsStub.restore();
    });

    it("should handle internal server error", async () => {
      // Arrange
      const request = {
        query: { tenant: "exampleTenant" },
        body: [
          { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
          { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
          { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
        ],
      };

      // Stub the transformManyEvents function to throw an error
      const transformManyEventsStub = sinon.stub(
        createEvent,
        "transformManyEvents"
      );
      transformManyEventsStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.addEvents(request);

      // Assert
      expect(transformManyEventsStub.calledOnce).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "server side error",
        errors: { message: "Internal server error" },
      });

      // Restore the stub
      transformManyEventsStub.restore();
    });
  });

  describe("insertTransformedEvents", () => {
    it("should insert transformed events successfully", async () => {
      // Arrange
      const tenant = "exampleTenant";
      const events = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
      ];

      // Stub the Model updateOne method to return a successful response
      const modelUpdateOneStub = sinon.stub(Model(tenant), "updateOne");
      modelUpdateOneStub.resolves({ nModified: 1 });

      // Act
      const result = await eventUtil.insertTransformedEvents(tenant, events);

      // Assert
      expect(modelUpdateOneStub.calledThrice).to.be.true;
      expect(result).to.deep.equal({
        success: true,
        message: "successfully added all the events",
        data: [
          {
            msg: "successfuly added the event",
            event_details: { id: 1 },
            status: 201,
          },
          {
            msg: "successfuly added the event",
            event_details: { id: 2 },
            status: 201,
          },
          {
            msg: "successfuly added the event",
            event_details: { id: 3 },
            status: 201,
          },
        ],
      });

      // Restore the stub
      modelUpdateOneStub.restore();
    });

    it("should handle errors during insertion", async () => {
      // Arrange
      const tenant = "exampleTenant";
      const events = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
      ];

      // Stub the Model updateOne method to return an unsuccessful response
      const modelUpdateOneStub = sinon.stub(Model(tenant), "updateOne");
      modelUpdateOneStub.resolves({ nModified: 0 }); // Indicate that no records were modified

      // Act
      const result = await eventUtil.insertTransformedEvents(tenant, events);

      // Assert
      expect(modelUpdateOneStub.calledThrice).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "finished the operation with some errors",
        errors: [
          {
            msg: "unable to add the event",
            event_details: { id: 1 },
            status: 304,
          },
          {
            msg: "unable to add the event",
            event_details: { id: 2 },
            status: 304,
          },
          {
            msg: "unable to add the event",
            event_details: { id: 3 },
            status: 304,
          },
        ],
      });

      // Restore the stub
      modelUpdateOneStub.restore();
    });

    it("should handle internal server error during insertion", async () => {
      // Arrange
      const tenant = "exampleTenant";
      const events = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25, enriched: true },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28, enriched: true },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22, enriched: true },
      ];

      // Stub the Model updateOne method to throw an error
      const modelUpdateOneStub = sinon.stub(Model(tenant), "updateOne");
      modelUpdateOneStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.insertTransformedEvents(tenant, events);

      // Assert
      expect(modelUpdateOneStub.calledThrice).to.be.true;
      expect(result).to.deep.equal({
        success: false,
        message: "internal server error",
        errors: { message: "Internal server error" },
      });

      // Restore the stub
      modelUpdateOneStub.restore();
    });
  });

  describe("insertMeasurements", () => {
    it("should insert measurements successfully", async () => {
      // Arrange
      const measurements = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the eventUtil.insert method to return a successful response
      const createEventInsertStub = sinon.stub(createEvent, "insert");
      createEventInsertStub.resolves({
        success: true,
        message: "Measurements inserted successfully",
        data: measurements,
      });

      // Act
      const result = await eventUtil.insertMeasurements(measurements);

      // Assert
      expect(createEventInsertStub.calledOnce).to.be.true;
      expect(createEventInsertStub.firstCall.args[0]).to.equal("airqo");
      expect(createEventInsertStub.firstCall.args[1]).to.deep.equal(
        measurements
      );
      expect(result).to.deep.equal({
        success: true,
        message: "Measurements inserted successfully",
        data: measurements,
      });

      // Restore the stub
      createEventInsertStub.restore();
    });

    it("should handle internal server error during insertion", async () => {
      // Arrange
      const measurements = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the eventUtil.insert method to throw an error
      const createEventInsertStub = sinon.stub(createEvent, "insert");
      createEventInsertStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.insertMeasurements(measurements);

      // Assert
      expect(createEventInsertStub.calledOnce).to.be.true;
      expect(createEventInsertStub.firstCall.args[0]).to.equal("airqo");
      expect(createEventInsertStub.firstCall.args[1]).to.deep.equal(
        measurements
      );
      expect(result).to.deep.equal({
        success: false,
        message: "Unable to insert measurements",
        errors: { message: "Internal server error" },
      });

      // Restore the stub
      createEventInsertStub.restore();
    });
  });

  describe("insert", () => {
    it("should insert measurements successfully", async () => {
      // Arrange
      const tenant = "airqo";
      const measurements = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the eventUtil.transformMeasurements_v2 method to return a successful response
      const createEventTransformStub = sinon.stub(
        createEvent,
        "transformMeasurements_v2"
      );
      createEventTransformStub.resolves({
        success: true,
        data: measurements,
      });

      // Stub the EventModel.updateOne method to return a successful response
      const EventModelUpdateOneStub = sinon.stub(
        EventModel(tenant),
        "updateOne"
      );
      EventModelUpdateOneStub.resolves({});

      // Act
      const result = await eventUtil.insert(tenant, measurements);

      // Assert
      expect(createEventTransformStub.calledOnce).to.be.true;
      expect(createEventTransformStub.firstCall.args[0]).to.deep.equal(
        measurements
      );

      expect(EventModelUpdateOneStub.callCount).to.equal(measurements.length);
      for (let i = 0; i < measurements.length; i++) {
        const measurement = measurements[i];
        const eventsFilter = {
          day: measurement.day,
          site_id: measurement.site_id,
          device_id: measurement.device_id,
          nValues: { $lt: parseInt(constants.N_VALUES) },
          $or: [
            { "values.time": { $ne: measurement.time } },
            { "values.device": { $ne: measurement.device } },
            { "values.frequency": { $ne: measurement.frequency } },
            { "values.device_id": { $ne: measurement.device_id } },
            { "values.site_id": { $ne: measurement.site_id } },
            { day: { $ne: measurement.day } },
          ],
        };
        const eventsUpdate = {
          $push: { values: measurement },
          $min: { first: measurement.time },
          $max: { last: measurement.time },
          $inc: { nValues: 1 },
        };
        expect(EventModelUpdateOneStub.getCall(i).args[0]).to.deep.equal(
          eventsFilter
        );
        expect(EventModelUpdateOneStub.getCall(i).args[1]).to.deep.equal(
          eventsUpdate
        );
        expect(EventModelUpdateOneStub.getCall(i).args[2]).to.deep.equal({
          upsert: true,
        });
      }

      expect(result).to.deep.equal({
        success: true,
        message: "successfully added all the events",
        status: httpStatus.OK,
      });

      // Restore the stubs
      createEventTransformStub.restore();
      EventModelUpdateOneStub.restore();
    });

    it("should handle errors during insertion", async () => {
      // Arrange
      const tenant = "airqo";
      const measurements = [
        { id: 1, pm2_5: 10, pm10: 20, temperature: 25 },
        { id: 2, pm2_5: 15, pm10: 30, temperature: 28 },
        { id: 3, pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the eventUtil.transformMeasurements_v2 method to return a successful response
      const createEventTransformStub = sinon.stub(
        createEvent,
        "transformMeasurements_v2"
      );
      createEventTransformStub.resolves({
        success: true,
        data: measurements,
      });

      // Stub the EventModel.updateOne method to throw an error
      const EventModelUpdateOneStub = sinon.stub(
        EventModel(tenant),
        "updateOne"
      );
      EventModelUpdateOneStub.rejects(new Error("Internal server error"));

      // Act
      const result = await eventUtil.insert(tenant, measurements);

      // Assert
      expect(createEventTransformStub.calledOnce).to.be.true;
      expect(createEventTransformStub.firstCall.args[0]).to.deep.equal(
        measurements
      );

      expect(EventModelUpdateOneStub.callCount).to.equal(measurements.length);

      // The first measurement should throw an error
      const measurementWithError = measurements[0];
      const eventsFilterWithError = {
        day: measurementWithError.day,
        site_id: measurementWithError.site_id,
        device_id: measurementWithError.device_id,
        nValues: { $lt: parseInt(constants.N_VALUES) },
        $or: [
          { "values.time": { $ne: measurementWithError.time } },
          { "values.device": { $ne: measurementWithError.device } },
          { "values.frequency": { $ne: measurementWithError.frequency } },
          { "values.device_id": { $ne: measurementWithError.device_id } },
          { "values.site_id": { $ne: measurementWithError.site_id } },
          { day: { $ne: measurementWithError.day } },
        ],
      };
      const eventsUpdateWithError = {
        $push: { values: measurementWithError },
        $min: { first: measurementWithError.time },
        $max: { last: measurementWithError.time },
        $inc: { nValues: 1 },
      };
      expect(EventModelUpdateOneStub.getCall(0).args[0]).to.deep.equal(
        eventsFilterWithError
      );
      expect(EventModelUpdateOneStub.getCall(0).args[1]).to.deep.equal(
        eventsUpdateWithError
      );
      expect(EventModelUpdateOneStub.getCall(0).args[2]).to.deep.equal({
        upsert: true,
      });

      // The rest of the measurements should not be processed due to the error
      for (let i = 1; i < measurements.length; i++) {
        expect(EventModelUpdateOneStub.getCall(i).called).to.be.false;
      }

      expect(result).to.deep.equal({
        success: false,
        message: "finished the operation with some errors",
        errors: [
          {
            msg:
              "there is a system conflict, most likely a cast error or duplicate record",
            more: "Internal server error",
            record: {
              device: measurementWithError.device,
              frequency: measurementWithError.frequency,
              time: measurementWithError.time,
              device_id: measurementWithError.device_id,
              site_id: measurementWithError.site_id,
            },
          },
        ],
        status: httpStatus.INTERNAL_SERVER_ERROR,
      });

      // Restore the stubs
      createEventTransformStub.restore();
      EventModelUpdateOneStub.restore();
    });
  });

  describe("transformMeasurements", () => {
    it("should transform measurements successfully", async () => {
      // Arrange
      const device = "airqo-device";
      const measurements = [
        {
          time: "2023-07-04T12:00:00Z",
          pm2_5: 10,
          pm10: 20,
          temperature: 25,
        },
        {
          time: "2023-07-04T12:15:00Z",
          pm2_5: 15,
          pm10: 30,
          temperature: 28,
        },
        { time: "2023-07-04T12:30:00Z", pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Act
      const result = await eventUtil.transformMeasurements(
        device,
        measurements
      );

      // Assert
      expect(result)
        .to.be.an("array")
        .with.length(measurements.length);
      for (let i = 0; i < measurements.length; i++) {
        const transformedMeasurement = result[i];
        const measurement = measurements[i];
        const day = generateDateFormatWithoutHrs(measurement.time);
        expect(transformedMeasurement).to.deep.equal({
          device: device,
          day: day,
          ...measurement,
          success: true,
        });
      }
    });

    it("should handle errors during transformation", async () => {
      // Arrange
      const device = "airqo-device";
      const measurements = [
        {
          time: "2023-07-04T12:00:00Z",
          pm2_5: 10,
          pm10: 20,
          temperature: 25,
        },
        {
          time: "2023-07-04T12:15:00Z",
          pm2_5: 15,
          pm10: 30,
          temperature: 28,
        },
        { time: "2023-07-04T12:30:00Z", pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the generateDateFormatWithoutHrs method to throw an error
      const generateDateFormatWithoutHrsStub = sinon.stub(
        global,
        "generateDateFormatWithoutHrs"
      );
      generateDateFormatWithoutHrsStub.throws(new Error("Invalid time format"));

      // Act
      const result = await eventUtil.transformMeasurements(
        device,
        measurements
      );

      // Assert
      expect(result)
        .to.be.an("array")
        .with.length(measurements.length);
      for (let i = 0; i < measurements.length; i++) {
        const transformedMeasurement = result[i];
        const measurement = measurements[i];
        expect(transformedMeasurement).to.deep.equal({
          device: device,
          success: false,
          message: "Invalid time format",
          errors: { message: "Invalid time format" },
        });
      }

      // Restore the stub
      generateDateFormatWithoutHrsStub.restore();
    });
  });

  describe("transformMeasurements_v2", () => {
    it("should transform measurements successfully", async () => {
      // Arrange
      const measurements = [
        {
          time: "2023-07-04T12:00:00Z",
          pm2_5: 10,
          pm10: 20,
          temperature: 25,
        },
        {
          time: "2023-07-04T12:15:00Z",
          pm2_5: 15,
          pm10: 30,
          temperature: 28,
        },
        { time: "2023-07-04T12:30:00Z", pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Act
      const result = await eventUtil.transformMeasurements_v2(measurements);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.length(measurements.length);
      for (let i = 0; i < measurements.length; i++) {
        const transformedMeasurement = result.data[i];
        const measurement = measurements[i];
        const day = generateDateFormatWithoutHrs(measurement.time);
        expect(transformedMeasurement).to.deep.equal({
          day: day,
          ...measurement,
        });
      }
    });

    it("should handle errors during transformation", async () => {
      // Arrange
      const measurements = [
        {
          time: "2023-07-04T12:00:00Z",
          pm2_5: 10,
          pm10: 20,
          temperature: 25,
        },
        {
          time: "2023-07-04T12:15:00Z",
          pm2_5: 15,
          pm10: 30,
          temperature: 28,
        },
        { time: "2023-07-04T12:30:00Z", pm2_5: 8, pm10: 18, temperature: 22 },
      ];

      // Stub the generateDateFormatWithoutHrs method to throw an error
      const generateDateFormatWithoutHrsStub = sinon.stub(
        global,
        "generateDateFormatWithoutHrs"
      );
      generateDateFormatWithoutHrsStub.throws(new Error("Invalid time format"));

      // Act
      const result = await eventUtil.transformMeasurements_v2(measurements);

      // Assert
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.length(measurements.length);
      for (let i = 0; i < measurements.length; i++) {
        const transformedMeasurement = result.data[i];
        const measurement = measurements[i];
        expect(transformedMeasurement).to.deep.equal({
          success: false,
          message: "server side error",
          errors: { message: "Invalid time format" },
        });
      }

      // Restore the stub
      generateDateFormatWithoutHrsStub.restore();
    });
  });

  describe("transformField", () => {
    it("should transform known fields", () => {
      // Arrange
      const fields = [
        "s1_pm2_5",
        "s1_pm10",
        "s2_pm2_5",
        "s2_pm10",
        "latitude",
        "longitude",
        "battery",
        "others",
        "time",
        "elevation",
        "status",
      ];

      // Act
      const transformedFields = fields.map((field) =>
        eventUtil.transformField(field)
      );

      // Assert
      expect(transformedFields).to.deep.equal([
        "field1",
        "field2",
        "field3",
        "field4",
        "field5",
        "field6",
        "field7",
        "field8",
        "created_at",
        "elevation",
        "status",
      ]);
    });

    it("should return the same field for unknown fields", () => {
      // Arrange
      const unknownField = "unknown_field";

      // Act
      const transformedField = eventUtil.transformField(unknownField);

      // Assert
      expect(transformedField).to.equal(unknownField);
    });
  });

  describe("transformMeasurementFields", () => {
    it("should transform measurements successfully", async () => {
      // Arrange
      const measurements = [
        { field1: 10, field2: 20, time: "2023-07-04T12:00:00Z" },
        { field1: 15, field2: 25, time: "2023-07-04T13:00:00Z" },
        // Add more sample measurements as needed
      ];

      // Act
      const result = await eventUtil.transformMeasurementFields(measurements);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully transformed the measurements"
      );
      expect(result.data).to.be.an("array");
      // Add more assertions on the transformed measurements if needed
    });

    it("should handle errors and return failure status", async () => {
      // Arrange
      const measurements = [
        { field1: 10, field2: 20, time: "2023-07-04T12:00:00Z" },
        { field1: 15, field2: 25, time: "2023-07-04T13:00:00Z" },
        // Add more sample measurements as needed
      ];
      // Simulate an error in createThingSpeakRequestBody
      eventUtil.createThingSpeakRequestBody = () => {
        throw new Error("Simulated error in createThingSpeakRequestBody");
      };

      // Act
      const result = await eventUtil.transformMeasurementFields(measurements);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors).to.have.property("message");
      expect(result.status).to.equal(500);
    });
  });

  describe("deleteValuesOnThingspeak", () => {
    it("should delete values on ThingSpeak successfully", async () => {
      // Arrange
      const req = {
        query: {
          device: "DeviceName",
          tenant: "TenantName",
          chid: "ChannelID",
        },
      };
      const res = {};

      // Stub the list and getChannelID functions to return mock data
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [
          { device_number: "ChannelID" /* Add more properties as needed */ },
        ],
      });
      sinon.stub(createEvent, "getChannelID").resolves("ChannelID");

      // Stub the axios.delete function to return a successful response
      sinon.stub(axios, "delete").resolves({ data: "MockResponseData" });

      // Act
      const result = await eventUtil.deleteValuesOnThingspeak(req, res);

      // Assert
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully cleared the data for device DeviceName"
      );
      expect(result.data).to.have.property("message");
      expect(result.data).to.have.property("success", true);
      expect(result.data).to.have.property("updatedDevice");
      // Add more assertions on the response data if needed

      // Restore the stubbed functions
      eventUtil.list.restore();
      eventUtil.getChannelID.restore();
      axios.delete.restore();
    });

    it("should handle errors and return failure status if device does not exist", async () => {
      // Arrange
      const req = {
        query: {
          device: "NonExistentDevice",
          tenant: "TenantName",
          chid: "NonExistentChannelID",
        },
      };
      const res = {};

      // Stub the list function to return failure response
      sinon.stub(createEvent, "list").resolves({
        success: false,
        errors: { message: "Device not found" },
      });

      // Act
      const result = await eventUtil.deleteValuesOnThingspeak(req, res);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "device NonExistentDevice does not exist in the system"
      );
      expect(result.errors).to.have.property("message");
      // Add more assertions on the response data if needed

      // Restore the stubbed functions
      eventUtil.list.restore();
    });

    it("should handle errors and return failure status if clearing device data fails", async () => {
      // Arrange
      const req = {
        query: {
          device: "DeviceName",
          tenant: "TenantName",
          chid: "ChannelID",
        },
      };
      const res = {};

      // Stub the list function to return success response
      sinon.stub(createEvent, "list").resolves({
        success: true,
        data: [
          { device_number: "ChannelID" /* Add more properties as needed */ },
        ],
      });
      // Stub the axios.delete function to throw an error
      sinon.stub(axios, "delete").rejects(new Error("Clearing data failed"));

      // Act
      const result = await eventUtil.deleteValuesOnThingspeak(req, res);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "unable to clear the device data, device DeviceName does not exist"
      );
      expect(result.errors).to.have.property("message");
      // Add more assertions on the response data if needed

      // Restore the stubbed functions
      eventUtil.list.restore();
      axios.delete.restore();
    });

    it("should handle internal server error and return failure status", async () => {
      // Arrange
      const req = {
        query: {
          device: "DeviceName",
          tenant: "TenantName",
          chid: "ChannelID",
        },
      };
      const res = {};

      // Stub the list function to throw an error
      sinon
        .stub(createEvent, "list")
        .rejects(new Error("Internal Server Error"));

      // Act
      const result = await eventUtil.deleteValuesOnThingspeak(req, res);

      // Assert
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors).to.have.property("message");
      // Add more assertions on the response data if needed

      // Restore the stubbed functions
      eventUtil.list.restore();
    });
  });
});
