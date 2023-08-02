require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const { describe } = require("mocha");
const measurementsModel = require("@models/Measurement");

describe("Measurement Schema Unit Tests", () => {
  let MeasurementModel;

  before(() => {
    // Stub the `create` and `aggregate` methods of the model
    MeasurementModel = {
      create: sinon.stub(),
      aggregate: sinon.stub(),
    };
  });

  afterEach(() => {
    // Reset stubs after each test
    sinon.reset();
  });

  it("should create a measurement", async () => {
    // Set up test data
    const measurementData = {
      day: "2023-07-25",
      values: [
        {
          time: new Date(),
          frequency: "hourly",
          is_test_data: false,
          device: "Device1",
          device_id: "device1_id",
          site: "Site1",
          site_id: "site1_id",
          pm2_5: {
            value: 10.5,
            calibrated_value: 10.2,
            uncertainty_value: 0.2,
            standard_deviation_value: 0.1,
          },
          // Add other properties
        },
      ],
    };

    // Stub the `create` method to return a resolved Promise with the created data
    MeasurementModel.create.resolves(measurementData);

    // Call the createEvent method and assert the result
    const result = await MeasurementModel.createEvent(measurementData);

    expect(result).to.deep.equal(measurementData);
    expect(MeasurementModel.create.calledOnce).to.be.true;
  });

  it("should list measurements", async () => {
    // Set up test data and filter
    const testData = [
      {
        _id: "measurement_id1",
        day: "2023-07-25",
        values: [
          {
            time: new Date(),
            frequency: "hourly",
            is_test_data: false,
            device: "Device1",
            device_id: "device1_id",
            site: "Site1",
            site_id: "site1_id",
            pm2_5: {
              value: 10.5,
              calibrated_value: 10.2,
              uncertainty_value: 0.2,
              standard_deviation_value: 0.1,
            },
            // Add other properties
          },
        ],
      },
      // Add more test data
    ];

    const filter = {
      // Add filter criteria
    };

    // Stub the `aggregate` method to return a resolved Promise with the test data
    MeasurementModel.aggregate.resolves(testData);

    // Call the list method and assert the result
    const result = await MeasurementModel.list({ filter });

    expect(result.success).to.be.true;
    expect(result.data).to.deep.equal(testData);
    expect(MeasurementModel.aggregate.calledOnce).to.be.true;
  });

  // Add more unit tests for other methods if needed
});

// Add other test cases for the Schema methods as required
