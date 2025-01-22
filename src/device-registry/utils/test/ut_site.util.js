const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
const createSite = require("@utils/create-site");
const SiteModel = require("@models/Site");
const UniqueIdentifierCounterModel = require("@models/UniqueIdentifierCounter");
chai.use(sinonChai);
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const distanceUtil = require("@utils/distance");
const httpStatus = require("http-status");

describe("createSite Util Functions", () => {
  describe("hasWhiteSpace", () => {
    it("should return true if the name contains whitespace", () => {
      const nameWithWhitespace = "John Doe";
      const result = createSite.hasWhiteSpace(nameWithWhitespace);
      expect(result).to.be.true;
    });

    it("should return false if the name does not contain whitespace", () => {
      const nameWithoutWhitespace = "JohnDoe";
      const result = createSite.hasWhiteSpace(nameWithoutWhitespace);
      expect(result).to.be.false;
    });

    it("should handle errors gracefully", () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const name = "John Doe";

      const result = createSite.hasWhiteSpace(name);

      expect(result).to.be.undefined; // The function does not return anything in case of an error
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
    });
  });
  describe("checkStringLength", () => {
    it("should return true for a valid name length", () => {
      const validName = "John Doe";
      const result = createSite.checkStringLength(validName);
      expect(result).to.be.true;
    });

    it("should return false for an invalid name length", () => {
      const shortName = "Jo";
      const longName = "ThisIsAReallyLongNameThatExceedsFiftyCharacters";

      const resultShort = createSite.checkStringLength(shortName);
      const resultLong = createSite.checkStringLength(longName);

      expect(resultShort).to.be.false;
      expect(resultLong).to.be.false;
    });

    it("should handle errors gracefully", () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const name = "John Doe";

      const result = createSite.checkStringLength(name);

      expect(result).to.be.undefined; // The function does not return anything in case of an error
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
    });
  });
  describe("findAirQlouds", () => {
    it("should return associated AirQlouds when site is inside polygons", async () => {
      // Stub createSite.list and createAirqloudUtil.list appropriately
      // Mock responseFromListSites and responseFromListAirQlouds

      const request = {
        query: { id: "siteId", tenant: "tenantId" },
        body: {}, // Body can be left empty for now
      };

      const result = await createSite.findAirQlouds(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully searched for the associated AirQlouds"
      );
      expect(result.data).to.be.an("array");
      // Add more assertions for the result based on your mock data
    });

    it("should return no associated AirQlouds when site is not inside any polygons", async () => {
      // Stub createSite.list and createAirqloudUtil.list appropriately
      // Mock responseFromListSites and responseFromListAirQlouds differently

      // ... Test the function behavior when there are no associated AirQlouds

      expect(result.success).to.be.true;
      expect(result.message).to.equal("no associated AirQlouds found");
      expect(result.data).to.be.an("array").that.is.empty;
      // Add more assertions for the result based on your mock data
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const request = {
        query: { id: "siteId", tenant: "tenantId" },
        body: {}, // Body can be left empty for now
      };

      const result = await createSite.findAirQlouds(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("findNearestWeatherStation", () => {
    it("should return the nearest weather station", async () => {
      // Stub createSite.list, createSite.listWeatherStations, and geolib.findNearest
      // Mock responseFromListSites, responseFromListWeatherStations, and nearestWeatherStation

      const request = {
        query: { id: "siteId", tenant: "tenantId" },
        body: {}, // Body can be left empty for now
      };

      const result = await createSite.findNearestWeatherStation(request);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully returned the nearest weather station"
      );
      expect(result.data).to.be.an("object"); // Assuming nearestWeatherStation is an object
      // Add more assertions for the result based on your mock data
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const request = {
        query: { id: "siteId", tenant: "tenantId" },
        body: {}, // Body can be left empty for now
      };

      const result = await createSite.findNearestWeatherStation(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("listWeatherStations", () => {
    it("should return the list of weather stations", async () => {
      // Stub axios.get appropriately and mock the response

      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved all the stations"
      );
      expect(result.data).to.be.an("array"); // Assuming data is an array
      // Add more assertions for the result based on your mock data
    });

    it("should return not found when the list of stations is empty", async () => {
      // Stub axios.get appropriately and mock the response with empty data

      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.false;
      expect(result.message).to.equal("List of stations is empty");
      expect(result.data).to.be.an("array").that.is.empty;
      // Add more assertions for the result based on the empty scenario
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method

      // Stub axios.get and mock the error scenario

      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Gateway Error");
      expect(result.status).to.equal(httpStatus.BAD_GATEWAY);
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("validateSiteName", () => {
    it("should return true for a valid site name", () => {
      const validName = "Valid Site Name";

      const result = createSite.validateSiteName(validName);

      expect(result).to.be.true;
    });

    it("should return false for an invalid site name", () => {
      const shortName = "Too";
      const longName = "ThisIsAReallyLongSiteNameThatExceedsFiftyCharacters";

      const resultShort = createSite.validateSiteName(shortName);
      const resultLong = createSite.validateSiteName(longName);

      expect(resultShort).to.be.false;
      expect(resultLong).to.be.false;
    });

    it("should handle errors gracefully", () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const name = "Valid Name";

      const result = createSite.validateSiteName(name);

      expect(result).to.be.undefined; // The function does not return anything in case of an error
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
    });
  });
  describe("generateName", () => {
    it("should generate a unique site name", async () => {
      const tenant = "exampleTenant";

      // Stub UniqueIdentifierCounterModel.modify and mock the response
      // Mock responseFromModifyUniqueIdentifierCounter accordingly

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("unique name generated for this site");
      expect(result.data).to.be.a("string"); // Assuming siteName is a string
      // Add more assertions for the result based on your mock data
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method
      const tenant = "exampleTenant";

      // Stub UniqueIdentifierCounterModel.modify to simulate failure

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "generateName -- createSite util server error"
      );
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("create", () => {
    it("should create a new site", async () => {
      // Stub/mock necessary methods and responses

      const result = await createSite.create(tenant, req);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Expected success message");
      // Add more assertions for the result based on the mock data
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method

      // Stub/mock necessary methods and responses to simulate an error scenario

      const result = await createSite.create(tenant, req);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("update", () => {
    it("should update a site", async () => {
      // Stub/mock necessary methods and responses

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("Expected success message");
      // Add more assertions for the result based on the mock data
    });

    it("should handle errors gracefully", async () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method

      // Stub/mock necessary methods and responses to simulate an error scenario

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "create site util server error -- update"
      );
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
      // Add more assertions for the result based on the error scenario
    });
  });
  describe("sanitiseName", () => {
    it("should sanitise the name correctly", () => {
      const name = "   This is A Name  with Spaces   ";
      const expectedSanitisedName = "thisisanamewith";

      const result = createSite.sanitiseName(name);

      expect(result).to.equal(expectedSanitisedName);
    });

    it("should handle errors gracefully", () => {
      const loggerStub = sinon.stub(console, "error"); // Stub the logger.error method

      const result = createSite.sanitiseName(undefined);

      expect(result).to.be.undefined;
      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called
      loggerStub.restore(); // Restore the stub after the test
    });
  });
  describe("getRoadMetadata", () => {
    it("should retrieve road metadata successfully", async () => {
      // Mock axios.get to return some sample response
      const axiosStub = sinon.stub(createSite, "axiosInstance").returns({
        get: sinon.stub().resolves({ data: { data: "sample metadata" } }),
      });

      const latitude = 123.456;
      const longitude = -45.678;

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the road metadata"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({ someKey: "sample metadata" });

      axiosStub.restore();
    });

    it("should handle errors gracefully", async () => {
      // Stub logger.error
      const loggerStub = sinon.stub(console, "error");
      // Stub axios.get to simulate an error
      const axiosStub = sinon.stub(createSite, "axiosInstance").returns({
        get: sinon.stub().rejects(new Error("Sample error")),
      });

      const latitude = 123.456;
      const longitude = -45.678;

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Sample error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      expect(loggerStub.calledOnce).to.be.true; // Verify that logger.error was called

      loggerStub.restore();
      axiosStub.restore();
    });
  });
  describe("generateMetadata", () => {
    it("should generate metadata successfully", async () => {
      // Stub the required functions and their responses
      const getAltitudeStub = sinon.stub(createSite, "getAltitude").resolves({
        success: true,
        data: 123.456,
      });
      const reverseGeoCodeStub = sinon
        .stub(createSite, "reverseGeoCode")
        .resolves({
          success: true,
          data: { site_tags: ["tag1", "tag2"] },
        });

      const req = {
        query: { tenant: "sampleTenant", id: "sampleId" },
        body: {
          latitude: 123.456,
          longitude: -45.678,
          network: "sampleNetwork",
        },
      };

      const result = await createSite.generateMetadata(req);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully generated the metadata");
      expect(result.status).to.equal(httpStatus.OK);
      // Verify that the returned data is as expected
      expect(result.data).to.deep.equal({
        altitude: 123.456,
        site_tags: ["tag1", "tag2"],
        latitude: 123.456,
        longitude: -45.678,
        network: "sampleNetwork",
        // ... other properties
      });

      // Restore the stubs
      getAltitudeStub.restore();
      reverseGeoCodeStub.restore();
    });

    it("should handle errors gracefully", async () => {
      // Stub logger.error
      const loggerStub = sinon.stub(console, "error");
      // Stub the required functions to simulate errors
      const getAltitudeStub = sinon
        .stub(createSite, "getAltitude")
        .rejects(new Error("Sample error"));
      const reverseGeoCodeStub = sinon
        .stub(createSite, "reverseGeoCode")
        .rejects(new Error("Sample error"));

      const req = {
        query: { tenant: "sampleTenant", id: "sampleId" },
        body: {
          latitude: 123.456,
          longitude: -45.678,
          network: "sampleNetwork",
        },
      };

      const result = await createSite.generateMetadata(req);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal("Sample error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      expect(loggerStub.calledTwice).to.be.true; // Verify that logger.error was called twice

      // Restore the stubs
      loggerStub.restore();
      getAltitudeStub.restore();
      reverseGeoCodeStub.restore();
    });
  });
  describe("pickAvailableValue", () => {
    it("should pick the first available value", () => {
      const valuesInObject = {
        value1: null,
        value2: "available",
        value3: null,
      };

      const result = createSite.pickAvailableValue(valuesInObject);
      expect(result).to.equal("available");
    });

    it("should return null if no available value is found", () => {
      const valuesInObject = {
        value1: null,
        value2: null,
        value3: null,
      };

      const result = createSite.pickAvailableValue(valuesInObject);
      expect(result).to.be.null;
    });
  });
  describe("refresh", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should successfully refresh site details", async () => {
      const req = {
        query: { id: "site_id" },
        body: {
          // Provide body data
        },
      };
      const tenant = "example_tenant";

      // Stub SiteModel.list to return mock response
      sandbox.stub(SiteModel(tenant), "list").resolves({
        success: true,
        data: [
          // Provide mock site data
        ],
      });

      // Stub createSite functions as needed

      // Call the function
      const result = await createSite.refresh(tenant, req);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Site details successfully refreshed");
      // Add more assertions as needed
    });

    it("should handle errors gracefully", async () => {
      const req = {
        query: { id: "site_id" },
        body: {
          // Provide body data
        },
      };
      const tenant = "example_tenant";

      // Stub SiteModel.list to return error response
      sandbox
        .stub(SiteModel(tenant), "list")
        .rejects(new Error("Database error"));

      // Stub createSite functions as needed

      // Call the function
      const result = await createSite.refresh(tenant, req);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions as needed
    });

    // Add more test cases for different scenarios
  });
  describe("delete", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should temporarily disable the feature and return a message", async () => {
      const tenant = "example_tenant";
      const filter = {
        // Provide filter data
      };

      // Call the function
      const result = await createSite.delete(tenant, filter);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "feature temporarity disabled --coming soon"
      );
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      // Add more assertions as needed
    });

    it("should handle errors gracefully", async () => {
      const tenant = "example_tenant";
      const filter = {
        // Provide filter data
      };

      // Stub SiteModel.remove to return error response
      sandbox
        .stub(SiteModel(tenant), "remove")
        .rejects(new Error("Database error"));

      // Call the function
      const result = await createSite.delete(tenant, filter);

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions as needed
    });

    // Add more test cases for different scenarios
  });
  describe("list", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should list sites successfully with modified response", async () => {
      const tenant = "example_tenant";
      const filter = {
        // Provide filter data
      };
      const skip = 0;
      const limit = 10;

      // Stub SiteModel.list to return a successful response
      const listResponse = {
        success: true,
        data: [
          {
            _id: "site_id_1",
            lat_long: "1_1",
            // Add other properties
          },
          {
            _id: "site_id_2",
            lat_long: "4_4", // This site will be filtered out
            // Add other properties
          },
        ],
      };
      sandbox.stub(SiteModel(tenant), "list").resolves(listResponse);

      // Call the function
      const result = await createSite.list({ tenant, filter, skip, limit });

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(1);
      // Add more assertions as needed
    });

    it("should handle errors gracefully", async () => {
      const tenant = "example_tenant";
      const filter = {
        // Provide filter data
      };
      const skip = 0;
      const limit = 10;

      // Stub SiteModel.list to return an error response
      sandbox
        .stub(SiteModel(tenant), "list")
        .rejects(new Error("Database error"));

      // Call the function
      const result = await createSite.list({ tenant, filter, skip, limit });

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions as needed
    });

    // Add more test cases for different scenarios
  });
  describe("formatSiteName", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should format site name correctly", () => {
      const inputName = "Example Site Name with Spaces";
      const expectedFormattedName = "examplesitenamewithspaces";

      const formattedName = createSite.formatSiteName(inputName);

      expect(formattedName).to.equal(expectedFormattedName);
    });

    it("should handle errors gracefully", () => {
      // Stub logElement for error logging
      const logElementStub = sandbox.stub(console, "log");

      const inputName = "Example Site Name";
      // Stub the replace method to throw an error
      sandbox
        .stub(String.prototype, "replace")
        .throws(new Error("Replace error"));

      const formattedName = createSite.formatSiteName(inputName);

      expect(formattedName).to.be.undefined;
      expect(logElementStub).to.have.been.calledWith("server error", {
        message: "Replace error",
      });
    });

    // Add more test cases for different scenarios
  });
  describe("retrieveInformationFromAddress", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should retrieve information from address correctly", () => {
      const address = {
        results: [
          {
            address_components: [
              { types: ["locality"], long_name: "Town" },
              { types: ["administrative_area_level_3"], long_name: "City" },
              { types: ["administrative_area_level_2"], long_name: "District" },
              { types: ["administrative_area_level_1"], long_name: "Region" },
              { types: ["route"], long_name: "Street" },
              { types: ["country"], long_name: "Country" },
              {
                types: ["sublocality", "sublocality_level_1"],
                long_name: "Parish",
              },
            ],
            formatted_address: "Formatted Address",
            geometry: {},
            place_id: "Place ID",
            types: ["type1", "type2"],
          },
        ],
      };

      const expectedData = {
        town: "Town",
        city: "City",
        district: "District",
        county: "District",
        region: "Region",
        street: "Street",
        country: "Country",
        parish: "Parish",
        division: "Parish",
        village: "Parish",
        sub_county: "Parish",
        search_name: "Town",
        formatted_name: "Formatted Address",
        geometry: {},
        site_tags: ["type1", "type2"],
        google_place_id: "Place ID",
        location_name: "Region, Country",
      };

      const retrievedAddress = createSite.retrieveInformationFromAddress(
        address
      );

      expect(retrievedAddress.success).to.be.true;
      expect(retrievedAddress.data).to.deep.equal(expectedData);
    });

    it("should handle errors gracefully", () => {
      // Stub logger.error for error logging
      const loggerErrorStub = sandbox.stub(console, "error");

      const address = {
        results: [
          // ...
        ],
      };
      // Stub the forEach method to throw an error
      sandbox
        .stub(Array.prototype, "forEach")
        .throws(new Error("ForEach error"));

      const retrievedAddress = createSite.retrieveInformationFromAddress(
        address
      );

      expect(retrievedAddress.success).to.be.false;
      expect(retrievedAddress.errors).to.deep.equal({
        message: "ForEach error",
      });
      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- ForEach error"
      );
    });

    // Add more test cases for different scenarios
  });
  describe("reverseGeoCode", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should reverse geocode correctly", async () => {
      const latitude = 123.456;
      const longitude = 456.789;

      const responseJSON = {
        results: [
          {
            // ... Sample response data
          },
        ],
      };

      // Stub axios.get to return the sample response data
      const axiosGetStub = sandbox
        .stub(axios, "get")
        .resolves({ data: responseJSON });

      const expectedTransformedData = {
        success: true,
        message: "retrieved the Google address details of this site",
        data: {
          // ... Expected transformed data
        },
      };

      const transformedAddressStub = sandbox
        .stub(createSite, "retrieveInformationFromAddress")
        .returns(expectedTransformedData);

      const response = await createSite.reverseGeoCode(latitude, longitude);

      expect(axiosGetStub).to.have.been.calledOnceWithExactly(
        `GET_ADDRESS_URL(latitude,longitude)`
      ); // Replace with actual URL
      expect(transformedAddressStub).to.have.been.calledOnceWithExactly(
        responseJSON
      );
      expect(response).to.deep.equal(expectedTransformedData);
    });

    it("should handle empty response", async () => {
      const latitude = 123.456;
      const longitude = 456.789;

      // Stub axios.get to return an empty response
      const axiosGetStub = sandbox.stub(axios, "get").resolves({ data: {} });

      const response = await createSite.reverseGeoCode(latitude, longitude);

      expect(axiosGetStub).to.have.been.calledOnceWithExactly(
        `GET_ADDRESS_URL(latitude,longitude)`
      ); // Replace with actual URL
      expect(response.success).to.be.false;
      expect(response.errors.message).to.equal(
        "review the GPS coordinates provided, we cannot get corresponding metadata"
      );
    });

    it("should handle axios.get error", async () => {
      const latitude = 123.456;
      const longitude = 456.789;

      // Stub axios.get to simulate an error
      const axiosGetStub = sandbox
        .stub(axios, "get")
        .rejects(new Error("Axios error"));

      const loggerErrorStub = sandbox.stub(console, "error");

      const response = await createSite.reverseGeoCode(latitude, longitude);

      expect(axiosGetStub).to.have.been.calledOnceWithExactly(
        `GET_ADDRESS_URL(latitude,longitude)`
      ); // Replace with actual URL
      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- Axios error"
      );
      expect(response.success).to.be.false;
      expect(response.message).to.equal("constants server side error");
    });

    it("should handle unexpected error", async () => {
      const latitude = 123.456;
      const longitude = 456.789;

      // Stub axios.get to simulate an error
      const axiosGetStub = sandbox
        .stub(axios, "get")
        .rejects(new Error("Axios error"));

      // Stub logger.error for error logging
      const loggerErrorStub = sandbox.stub(console, "error");

      // Stub createSite.retrieveInformationFromAddress to throw an error
      sandbox
        .stub(createSite, "retrieveInformationFromAddress")
        .throws(new Error("Transform error"));

      const response = await createSite.reverseGeoCode(latitude, longitude);

      expect(axiosGetStub).to.have.been.calledOnceWithExactly(
        `GET_ADDRESS_URL(latitude,longitude)`
      ); // Replace with actual URL
      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- Transform error"
      );
      expect(response.success).to.be.false;
      expect(response.errors.message).to.equal("Transform error");
    });

    // Add more test cases for different scenarios
  });
  describe("getAltitude", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should get altitude correctly", async () => {
      const lat = 123.456;
      const long = 456.789;

      const elevationResponse = {
        data: {
          results: [
            {
              elevation: 100, // Sample elevation value
            },
          ],
        },
      };

      // Stub axiosInstance for axios configuration
      sandbox.stub(axiosInstance, "axiosInstance").returns({});

      // Stub client.elevation to return sample elevation response
      const clientElevationStub = sandbox
        .stub(client, "elevation")
        .resolves(elevationResponse);

      const expectedResponse = {
        success: true,
        message: "successfully retrieved the altitude details",
        data: elevationResponse.data.results[0].elevation,
        status: httpStatus.OK,
      };

      const response = await createSite.getAltitude(lat, long);

      expect(clientElevationStub).to.have.been.calledOnceWithExactly(
        {
          params: {
            locations: [{ lat: lat, lng: long }],
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
          timeout: 1000,
        },
        {}
      );
      expect(response).to.deep.equal(expectedResponse);
    });

    it("should handle elevation error", async () => {
      const lat = 123.456;
      const long = 456.789;

      // Stub axiosInstance for axios configuration
      sandbox.stub(axiosInstance, "axiosInstance").returns({});

      // Stub client.elevation to simulate an error
      const clientElevationStub = sandbox
        .stub(client, "elevation")
        .rejects(new Error("Elevation error"));

      const loggerErrorStub = sandbox.stub(console, "error");

      const expectedResponse = {
        success: false,
        message: "get altitude server error",
        errors: { message: "Elevation error" },
        status: httpStatus.BAD_GATEWAY,
      };

      const response = await createSite.getAltitude(lat, long);

      expect(clientElevationStub).to.have.been.calledOnceWithExactly(
        {
          params: {
            locations: [{ lat: lat, lng: long }],
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
          timeout: 1000,
        },
        {}
      );
      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- Elevation error"
      );
      expect(response).to.deep.equal(expectedResponse);
    });

    it("should handle unexpected error", async () => {
      const lat = 123.456;
      const long = 456.789;

      // Stub axiosInstance for axios configuration
      sandbox.stub(axiosInstance, "axiosInstance").returns({});

      // Stub client.elevation to simulate an error
      sandbox.stub(client, "elevation").rejects(new Error("Elevation error"));

      // Stub logger.error for error logging
      const loggerErrorStub = sandbox.stub(console, "error");

      // Stub process.env.GOOGLE_MAPS_API_KEY for testing
      sandbox.stub(process.env, "GOOGLE_MAPS_API_KEY").value("fake-api-key");

      const expectedResponse = {
        success: false,
        message: "get altitude server error",
        errors: { message: "Elevation error" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      const response = await createSite.getAltitude(lat, long);

      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- Elevation error"
      );
      expect(response).to.deep.equal(expectedResponse);
    });

    // Add more test cases for different scenarios
  });
  describe("generateLatLong", () => {
    it("should generate lat_long string", () => {
      const lat = 123.456;
      const long = 456.789;

      const expectedLatLong = `${lat}_${long}`;

      const result = createSite.generateLatLong(lat, long);

      expect(result).to.equal(expectedLatLong);
    });

    it("should handle unexpected error", () => {
      // Stub logger.error for error logging
      const loggerErrorStub = sinon.stub(console, "error");

      const result = createSite.generateLatLong(undefined, undefined);

      expect(loggerErrorStub).to.have.been.calledWith(
        "internal server error -- Cannot read property 'message' of undefined"
      );
      expect(result).to.be.undefined;
    });

    // Add more test cases for different scenarios
  });
  describe("findNearestSitesByCoordinates", () => {
    it("should find nearest sites", async () => {
      const radius = 10;
      const latitude = 123.456;
      const longitude = 456.789;
      const tenant = "exampleTenant";

      const distanceBetweenTwoPointsStub = sinon.stub(
        distanceUtil,
        "distanceBtnTwoPoints"
      );
      distanceBetweenTwoPointsStub.returns(5); // Simulate that the distance is within the radius

      const listResponse = {
        success: true,
        data: [
          {
            latitude: 123.45,
            longitude: 456.78,
          },
          {
            latitude: 123.46,
            longitude: 456.8,
          },
        ],
        status: httpStatus.OK,
      };

      const listStub = sinon.stub(createSite, "list");
      listStub.returns(listResponse);

      const expectedResult = {
        success: true,
        data: [
          {
            latitude: 123.45,
            longitude: 456.78,
            distance: 5,
          },
        ],
        message: "successfully retrieved the nearest sites",
        status: httpStatus.OK,
      };

      const result = await createSite.findNearestSitesByCoordinates({
        radius,
        latitude,
        longitude,
        tenant,
      });

      expect(result).to.deep.equal(expectedResult);

      distanceBetweenTwoPointsStub.restore();
      listStub.restore();
    });

    it("should handle error", async () => {
      const radius = 10;
      const latitude = 123.456;
      const longitude = 456.789;
      const tenant = "exampleTenant";

      const distanceBetweenTwoPointsStub = sinon.stub(
        distanceUtil,
        "distanceBtnTwoPoints"
      );
      distanceBetweenTwoPointsStub.throws(
        new Error("Error calculating distance")
      );

      const listResponse = {
        success: false,
        message: "Unable to list sites",
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      const listStub = sinon.stub(createSite, "list");
      listStub.returns(listResponse);

      const expectedResult = {
        success: false,
        message: "Internal Server Error",
        errors: { message: "Error calculating distance" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };

      const result = await createSite.findNearestSitesByCoordinates({
        radius,
        latitude,
        longitude,
        tenant,
      });

      expect(result).to.deep.equal(expectedResult);

      distanceBetweenTwoPointsStub.restore();
      listStub.restore();
    });

    // Add more test cases for different scenarios
  });
  describe("createApproximateCoordinates", () => {
    it("should create approximate coordinates", () => {
      const latitude = 123.456;
      const longitude = 456.789;
      const approximate_distance_in_km = 10;
      const bearing = 45;

      const responseFromDistanceUtil = {
        approximate_latitude: 123.46,
        approximate_longitude: 456.793,
        bearing_in_radians: 0.7853981634,
        approximate_distance_in_km: 10,
      };

      const createApproximateCoordinatesStub = sinon.stub(
        distanceUtil,
        "createApproximateCoordinates"
      );
      createApproximateCoordinatesStub.returns(responseFromDistanceUtil);

      const expectedResult = {
        success: true,
        data: responseFromDistanceUtil,
        message: "successfully approximated the GPS coordinates",
      };

      const result = createSite.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      });

      expect(result).to.deep.equal(expectedResult);

      createApproximateCoordinatesStub.restore();
    });

    it("should handle error", () => {
      const latitude = 123.456;
      const longitude = 456.789;
      const approximate_distance_in_km = 10;
      const bearing = 45;

      const createApproximateCoordinatesStub = sinon.stub(
        distanceUtil,
        "createApproximateCoordinates"
      );
      createApproximateCoordinatesStub.throws(
        new Error("Error creating approximate coordinates")
      );

      const expectedResult = {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Error creating approximate coordinates",
        },
      };

      const result = createSite.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      });

      expect(result).to.deep.equal(expectedResult);

      createApproximateCoordinatesStub.restore();
    });

    // Add more test cases for different scenarios
  });
});
