require("module-alias/register");
const dotenv = require("dotenv");
dotenv.config();
const { expect } = require("chai");
const sinon = require("sinon");
const { MongoClient } = require("mongodb");
const commonUtils = require("../common");
const { getSitesFromAirQloud, getSitesFromLatitudeAndLongitude } = commonUtils;

describe("getSitesFromAirQloud", () => {
  let mongoClientStub;
  let mongoCollectionStub;

  beforeEach(() => {
    // Create a stub for the MongoDB client
    mongoClientStub = sinon.createStubInstance(MongoClient);
    // Create a stub for the AirQlouds collection
    mongoCollectionStub = sinon.stub();
    // Set the find method on the AirQlouds collection to return a mock result
    mongoCollectionStub.find.returns({
      toArray: sinon
        .stub()
        .resolves([{ _id: "some_id", sites: ["site1", "site2"] }]),
    });
    // Set the collection method on the MongoDB client to return the AirQlouds collection stub
    mongoClientStub.db.returns({ collection: mongoCollectionStub });
  });

  afterEach(() => {
    // Restore the MongoDB client and AirQlouds collection to their original states
    sinon.restore();
  });

  it("should retrieve sites for a given AirQloud ID", async () => {
    // Define the AirQloud ID to query for
    const airqloudId = "some_id";
    // Call the getSitesFromAirQloud function with the AirQloud ID
    const sites = await getSitesFromAirQloud(mongoClientStub, airqloudId);
    // Assert that the AirQlouds collection was queried for the specified ID
    expect(mongoCollectionStub.find).to.have.been.calledWith({
      _id: airqloudId,
    });
    // Assert that the sites were retrieved correctly
    expect(sites).to.deep.equal(["site1", "site2"]);
  });
});

describe("getSitesFromLatitudeAndLongitude", () => {
  let mongoClientStub;
  let mongoCollectionStub;

  beforeEach(() => {
    // Create a stub for the MongoDB client
    mongoClientStub = sinon.createStubInstance(MongoClient);
    // Create a stub for the Sites collection
    mongoCollectionStub = sinon.stub();
    // Set the find method on the Sites collection to return a mock result
    mongoCollectionStub.find.returns({
      toArray: sinon
        .stub()
        .resolves([
          { _id: "site1", latitude: 40.755931, longitude: -73.984606 },
          { _id: "site2", latitude: 40.756078, longitude: -73.984805 },
          { _id: "site3", latitude: 40.75552, longitude: -73.98414 },
          { _id: "site4", latitude: 40.754765, longitude: -73.983426 },
        ]),
    });
    // Set the collection method on the MongoDB client to return the Sites collection stub
    mongoClientStub.db.returns({ collection: mongoCollectionStub });
  });

  afterEach(() => {
    // Restore the MongoDB client and Sites collection to their original states
    sinon.restore();
  });

  it("should retrieve sites closest to the given latitude and longitude", async () => {
    // Define the latitude and longitude to query for
    const latitude = 40.755931;
    const longitude = -73.984606;
    // Call the getSitesFromLatitudeAndLongitude function with the latitude and longitude
    const sites = await getSitesFromLatitudeAndLongitude(
      mongoClientStub,
      latitude,
      longitude
    );
    // Assert that the Sites collection was queried for the specified latitude and longitude
    expect(mongoCollectionStub.find).to.have.been.calledWith({
      latitude: { $gte: latitude - 0.045, $lte: latitude + 0.045 },
      longitude: { $gte: longitude - 0.045, $lte: longitude + 0.045 },
    });
    // Assert that the sites were retrieved correctly
    expect(sites).to.deep.equal(["site1", "site2", "site3"]);
  });
});
