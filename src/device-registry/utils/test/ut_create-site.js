require("module-alias/register");
process.env.NODE_ENV = "development";
require('dotenv').config();

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);

const geolib = require("geolib");
const httpStatus = require("http-status");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
const { Kafka } = require("kafkajs");

const UniqueIdentifierCounterSchema = require("@models/UniqueIdentifierCounter");
const siteSchema = require("@models/Site");
const createSite = require("@utils/create-site");
const createAirqloud = require("@utils/create-airqloud");
const constants = require("@config/constants");
const generateFilter = require("../generate-filter");
const distanceUtil = require("../distance");

let stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "test",
  name: faker.name.findName(),
  generated_name: faker.address.secondaryAddress(),
  formatted_name: faker.address.streetAddress(),
  latitude: faker.address.latitude(),
  longitude: faker.address.longitude(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  description: faker.address.direction(),
  site_activities: faker.random.words(),
  county: faker.address.county(),
  sub_county: faker.address.county(),
  parish: faker.address.county(),
  village: faker.address.county(),
  region: faker.address.country(),
  district: faker.address.state(),
  city: faker.address.city(),
  road_intensity: faker.datatype.float(),
  distance_to_nearest_motor_way: faker.datatype.float(),
  distance_to_nearest_residential_area: faker.datatype.float(),
  distance_to_nearest_city: faker.datatype.float(),
  distance_to_nearest_road: faker.datatype.float(),
  lat_long: `${this.latitude}_${this.longitude}`,
  altitude: faker.datatype.float(),
  aspect: faker.datatype.float(),
  greenness: faker.datatype.float(),
  roadStatus: faker.datatype.float(),
  landUse: faker.datatype.float(),
  terrain: faker.datatype.float(),
  trafficFactor: faker.datatype.float(),
};


const kafka = new Kafka({
  clientId: "location-test-service",
  brokers: "brokers:9092",
});

// Mocked data
const mockReq = {
  query: { tenant: "sample_tenant", id: "sample_id" },
  body: { latitude: 40.7128, longitude: -74.006 },
};

describe("create-site-util", () => {
  describe("hasWhiteSpace", () => {
    it("should return true if the name has white space", () => {
      const name = "site name with spaces";
      const result = createSite.hasWhiteSpace(name);
      expect(result).to.be.true;
    });

    it("should return false if the name does not have white space", () => {
      const name = "site_name_without_spaces";
      const result = createSite.hasWhiteSpace(name);
      expect(result).to.be.false;
    });
  });
  describe("checkStringLength", () => {
    it("should return true if the name length is between 5 and 50", () => {
      const name = "site_name_with_valid_length";
      const result = createSite.checkStringLength(name);
      expect(result).to.be.true;
    });

    it("should return false if the name length is less than 5", () => {
      const name = "site";
      const result = createSite.checkStringLength(name);
      expect(result).to.be.false;
    });

    it("should return false if the name length is greater than 50", () => {
      const name =
        "site_name_with_length_greater_than_50_characters_site_name_with_length_greater_than_50_characters";
      const result = createSite.checkStringLength(name);
      expect(result).to.be.false;
    });
  });
  describe("findAirQlouds", () => {
    it("should return success response with associated AirQlouds if site is inside AirQlouds", async () => {
      // Mock the request object if needed for findAirQlouds
      const request = {
        query: {
          tenant: "example_tenant", // Replace with the tenant you want to test
          id: "site_id", // Replace with the site ID you want to test
        },
      };

      // Mock the response from list function used in findAirQlouds
      const listResponse = {
        success: true,
        data: [
          {
            _id: "airqloud_id1",
            location: {
              coordinates: [[[1, 1], [1, 2], [2, 2], [2, 1], [1, 1]]],
            },
            latitude: 1,
            longitude: 1,
          },

        ],
      };

      // Stub the list function in createSite to return the mock response
      const listStub = sinon.stub(createSite, "list");
      listStub.resolves(listResponse);

      const airqloudStub = sinon.stub(createAirqloud, "list");
      airqloudStub.resolves(listResponse);

      const geoLibStub = sinon.stub(geolib, "isPointInPolygon").returns(true);

      // Call the function and assert
      const result = await createSite.findAirQlouds(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(["airqloud_id1"]);
      // Add more assertions based on the expected results for successful case

      // Restore the stub to its original function
      listStub.restore();
      geoLibStub.restore();
      airqloudStub.restore();
    });

    // Add more test cases for different scenarios if necessary
  });
  describe("findNearestWeatherStation", () => {
    it("should return the nearest weather station for a valid site", async () => {
      // Mock the request object if needed for findNearestWeatherStation
      const request = {
        query: {
          tenant: "example_tenant", // Replace with the tenant you want to test
          id: "site_id", // Replace with the site ID you want to test
        },
      };

      // Mock the response from list function used in findNearestWeatherStation for sites
      const listSitesResponse = {
        success: true,
        data: [
          {
            _id: "site_id",
            latitude: 1.234, // Replace with the latitude of the site you want to test
            longitude: 5.678, // Replace with the longitude of the site you want to test
          },
        ],
      };

      // Mock the response from listWeatherStations function used in findNearestWeatherStation
      const listWeatherStationsResponse = {
        success: true,
        data: [
          {
            id: "station_id_1",
            latitude: 1.111, // Replace with the latitude of the weather station
            longitude: 5.555, // Replace with the longitude of the weather station
          },
          {
            id: "station_id_2",
            latitude: 2.222,
            longitude: 6.666,
          },
        ],
      };

      // Stub the list function in createSite to return the mock responses
      const listSitesStub = sinon.stub(createSite, "list");
      listSitesStub.resolves(listSitesResponse);

      const listWeatherStationsStub = sinon.stub(
        createSite,
        "listWeatherStations"
      );
      listWeatherStationsStub.resolves(listWeatherStationsResponse);

      // Call the function and assert
      const result = await createSite.findNearestWeatherStation(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        id: "station_id_1", // Expected nearest weather station ID
        latitude: 1.111,
        longitude: 5.555,
      });
      // Add more assertions based on the expected results for a successful case

      // Restore the stubs to their original functions
      listSitesStub.restore();
      listWeatherStationsStub.restore();
    });

    it("should return an error response if no matching site is found", async () => {
      // Mock the request object if needed for findNearestWeatherStation
      const request = {
        query: {
          tenant: "example_tenant", // Replace with the tenant you want to test
          id: "invalid_site_id", // Replace with a non-existent site ID to test the error case
        },
      };

      // Mock the response from list function used in findNearestWeatherStation for sites
      const listSitesResponse = {
        success: true,
        data: [],
      };

      // Stub the list function in createSite to return the mock response with no matching site
      const listSitesStub = sinon.stub(createSite, "list");
      listSitesStub.resolves(listSitesResponse);

      // Call the function and assert
      const result = await createSite.findNearestWeatherStation(request);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("unable to find one match for this site");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      // Add more assertions based on the expected error response

      // Restore the stub to its original function
      listSitesStub.restore();
    });

    // Add more test cases for different scenarios if necessary
  });
  describe("listWeatherStations", () => {
    it("should return a list of weather stations when API call is successful", async () => {

      const mockResponse = {
        success: true,
        message: 'successfully retrieved all the stations',
        status: 200,
        data: {
          data: [
            {
              id: 200,
              code: 'Test',
              location: {
                latitude: 10.56302,
                longitude: 31.39055,
                elevationmsl: 1319,
                countrycode: 'UG',
                timezone: 'Africa/Nairobi',
                timezoneoffset: 0,
                name: 'Mubende Hydromet',
                type: 'Meteo Office'
              },
            },
            {
              id: 218,
              code: 'Test',
              location: {
                latitude: 10.499446,
                longitude: 33.2634,
                elevationmsl: 1354.624,
                countrycode: 'UG',
                timezone: 'Africa/Nairobi',
                timezoneoffset: 0,
                name: 'Busoga College Mwiri',
                type: 'Secondary school'
              },
            }
          ]
        },
      };
      let outputData = [
        {
          id: 200,
          code: 'Test',
          latitude: 10.56302,
          longitude: 31.39055,
          elevation: 1319,
          countrycode: 'UG',
          timezone: 'Africa/Nairobi',
          timezoneoffset: 0,
          name: 'Mubende Hydromet',
          type: 'Meteo Office'
        },
        {
          id: 218,
          code: 'Test',
          latitude: 10.499446,
          longitude: 33.2634,
          elevation: 1354.624,
          countrycode: 'UG',
          timezone: 'Africa/Nairobi',
          timezoneoffset: 0,
          name: 'Busoga College Mwiri',
          type: 'Secondary school'

        }
      ];
      const axiosGetStub = sinon.stub(axios, "get").resolves(mockResponse);
      const result = await createSite.listWeatherStations();
      expect(result.data).to.be.an("array");
      expect(result.data).to.have.lengthOf(2);
      expect(result.data).to.deep.equal(outputData);

      axiosGetStub.restore();
    }).timeout(6000);

    it("should return a list with only the expected keys", async () => {
      const expectedKeys = [
        'id',
        'code',
        'latitude',
        'longitude',
        'elevation',
        'countrycode',
        'timezone',
        'timezoneoffset',
        'name',
        'type'
      ];

      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array");
      for (const station of result.data) {
        expect(Object.keys(station)).to.have.members(expectedKeys);
      }

    });

    it("should return an error response when the API call fails", async () => {
      // Mock the axios.get function to return an error response
      const axiosGetStub = sinon.stub(axios, "get");
      const mockError = new Error("API error");
      axiosGetStub.rejects(mockError);

      // Call the function and assert
      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Bad Gateway Error");
      expect(result.status).to.equal(httpStatus.BAD_GATEWAY);
      // Add more assertions based on the expected error response

      // Restore the stub to its original function
      axiosGetStub.restore();
    });

    it("should return an empty array when the API call response has no data", async () => {
      // Mock the axios.get function to return a response with no data
      const axiosGetStub = sinon.stub(axios, "get");
      const mockResponse = {
        success: true,
        data: {},
      };
      axiosGetStub.resolves(mockResponse);

      // Call the function and assert
      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.false;
      expect(result.data).to.be.an("array").that.is.empty;
      axiosGetStub.restore();
    });
  });
  describe("validateSiteName", () => {
    it("should return true for a valid site name", () => {
      const validName = "My Site Name";

      const result = createSite.validateSiteName(validName);

      expect(result).to.be.true;
    });

    it("should return false for a site name with less than 5 characters", () => {
      const invalidName = "ABC";

      const result = createSite.validateSiteName(invalidName);

      expect(result).to.be.false;
    });

    it("should return false for a site name with more than 50 characters", () => {
      const invalidName =
        "This is a very long site name that exceeds the maximum character limit";

      const result = createSite.validateSiteName(invalidName);

      expect(result).to.be.false;
    });

    it("should return false for an empty site name", () => {
      const invalidName = "";

      const result = createSite.validateSiteName(invalidName);

      expect(result).to.be.false;
    });

    it("should return false for a site name with only whitespace characters", () => {
      const invalidName = "     ";

      const result = createSite.validateSiteName(invalidName);

      expect(result).to.be.false;
    });

    // Add more test cases based on specific validation rules and edge cases
  });
  describe("generateName", () => {
    const uniqueIdentifierStub = sinon.stub(UniqueIdentifierCounterSchema.statics, "modify");
    it("should generate a unique name for the site", async () => {
      const tenant = "example_tenant";
      const expectedName = "site_1"; // Assuming the initial count is 0 and it increments for each generation

      const responseFromModifyUniqueIdentifierCounter = {
        success: true,
        data: {
          COUNT: 1,
        },
        status: 200,
      };
      uniqueIdentifierStub.returns(responseFromModifyUniqueIdentifierCounter);

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("unique name generated for this site");
      expect(result.data).to.equal(expectedName);
      expect(result.status).to.equal(200);

      uniqueIdentifierStub.restore();
    });

    it("should handle errors when unable to find the counter document", async () => {
      const tenant = "example_tenant";

      const responseFromModifyUniqueIdentifierCounter = {
        success: false,
        errors: { message: "Unable to find the counter document" },
        status: 404,
      };
      uniqueIdentifierStub.throws(new Error("Unable to find the counter document"));

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "generateName -- createSite util server error"
      );
      expect(result.errors).to.deep.equal({
        message: "Unable to find the counter document",
      });
      expect(result.status).to.equal(500);

    });

    // Add more test cases based on other possible scenarios and error cases
  });
  describe("create", () => {
    it("should create a new site with valid parameters", async () => {
      const tenant = "example_tenant";
      const req = {
        body: {
          name: "Example Site",
          latitude: 40.7128,
          longitude: -74.006,
          airqlouds: [],
          network: "example_network",
          approximate_distance_in_km: 10,
        },
        query: { tenant: "example_tenant" },
      };
      const generated_name = "site_1";

      // Stub the response from generateName function
      sinon.stub(createSite, "generateName").resolves({
        success: true,
        data: generated_name,
        status: 200,
      });

      // Stub the response from createApproximateCoordinates function
      sinon.stub(createSite, "createApproximateCoordinates").resolves({
        success: true,
        data: {
          approximate_latitude: 40.7128,
          approximate_longitude: -74.006,
          bearing_in_radians: 0,
          approximate_distance_in_km: 10,
        },
        status: 200,
      });

      // Stub the response from generateMetadata function
      sinon.stub(createSite, "generateMetadata").resolves({
        success: true,
        data: {
          // Your generated metadata here
        },
        status: 200,
      });

      const responseFromCreateSite = {
        success: true,
        data: stubValue,
        status: 201,
      };
      const siteStub = sinon.stub(siteSchema.statics, "register").returns(responseFromCreateSite);
      kafkaProducer = {
        connect: sinon.stub(),
        send: sinon.stub(),
        disconnect: sinon.stub()
      };
      sinon.stub(kafka, "producer").returns(kafkaProducer);

      const result = await createSite.create(tenant, req);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromCreateSite.data);
      expect(result.status).to.equal(201);

      createSite.generateName.restore();
      createSite.createApproximateCoordinates.restore();
      createSite.generateMetadata.restore();
      sinon.restore();
    });

    it("should handle errors when creating a site with invalid name", async () => {
      const tenant = "example_tenant";
      const req = {
        body: {
          name: "", // Invalid name
          latitude: 40.7128,
          longitude: -74.006,
          airqlouds: [],
          network: "example_network",
          approximate_distance_in_km: 10,
        },
        query: { tenant: "example_tenant" },
      };

      const result = await createSite.create(tenant, req);

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "site name is invalid, please check documentation"
      );

    });

    it('returns error message and errors on unsuccessful site creation', async () => {
      const siteStub = sinon.stub(siteSchema.statics, "register").returns({
        errors: '',
        message: '',
        success: false,
        status: '',
      });

      const tenant = 'testTenant';
      const req = {
        body: {
          name: 'testSite',
          latitude: '12.34',
          longitude: '56.78',
          airqlouds: [],
          network: 'testNetwork',
          approximate_distance_in_km: 10
        },
        query: {
          tenant: tenant
        }
      };
      const response = await createSite.create(tenant, req);
      expect(response.success).to.equal(false);
    });
  });

  describe("update", () => {
    it("should update a site with valid parameters", async () => {
      const tenant = stubValue.tenant;
      const filter = { _id: stubValue._id }; // Replace with the filter to select the specific site
      const update = stubValue;


      const responseFromModifySite = {
        success: true,
        data: stubValue,
        status: 200,
      };
      const siteStub = sinon.stub(siteSchema.statics, "modify").returns(responseFromModifySite);

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromModifySite.data);
      expect(result.status).to.equal(200);

      siteStub.restore();
    });

    it("should handle errors when updating a site", async () => {
      const tenant = "example_tenant";
      const filter = { _id: stubValue._id }; 
      const update = {

      };

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.false;
    });

    // Add more test cases based on other possible scenarios and error cases
  });
  describe("sanitiseName", () => {
    it("should remove white spaces and convert to lowercase when the name is longer than 15 characters", () => {
      const name = "  This is a Long Name  ";
      const result = createSite.sanitiseName(name);

      expect(result).to.equal("thisisalongname");
    });

    it("should remove white spaces and convert to lowercase when the name is shorter than 15 characters", () => {
      const name = "  ShortName  ";
      const result = createSite.sanitiseName(name);

      expect(result).to.equal("shortname");
    });

    it("should return an empty string when the name is empty", () => {
      const name = "";
      const result = createSite.sanitiseName(name);

      expect(result).to.equal("");
    });

    it("should handle errors when sanitising the name", () => {
      const name = null;
      const result = createSite.sanitiseName(name);

      // Add assertions for handling the error case

      // In this case, the function does not throw an error, but you might want to handle other error cases separately if needed
    });

    // Add more test cases based on other possible scenarios and error cases
  });
  describe("getRoadMetadata", () => {
    it("should successfully retrieve road metadata for valid latitude and longitude", async () => {
      const latitude = 40.7128;
      const longitude = -74.006;

      const axiosGetStub = sinon.stub(axios, "get").resolves({
        data: {
          data: stubValue.name,
        }
      });

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the road metadata"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({

        altitude: stubValue.name,
        aspect: stubValue.name,
        bearing_to_kampala_center: stubValue.name,
        distance_to_kampala_center: stubValue.name,
        distance_to_nearest_primary_road: stubValue.name,
        distance_to_nearest_residential_road: stubValue.name,
        distance_to_nearest_road: stubValue.name,
        distance_to_nearest_secondary_road: stubValue.name,
        distance_to_nearest_tertiary_road: stubValue.name,
        distance_to_nearest_unclassified_road: stubValue.name,
        greenness: stubValue.name,
        landform_270: stubValue.name,
        landform_90: stubValue.name,
        weather_stations: stubValue.name,

      });

      axiosGetStub.restore();
    });

    it("should return 'not found' status when no road metadata is retrieved", async () => {

      axios.get = async () => ({ data: {} });

      const latitude = 40.7128;
      const longitude = -74.006;

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("unable to retrieve any road metadata");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(result.errors).to.deep.equal({
        message: "unable to retrieve any road metadata",
      });
    });

    it("should handle errors and return 'internal server error' status", async () => {

      const latitude = 40.7128;
      const longitude = -74.006;

      const axiosGetStub = sinon.stub(axios, "get").throws(new Error("Mocked error"));
      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.false;
      expect(result.message).to.equal('Internal Server Error');
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.deep.equal({ message: "Mocked error" });

      axiosGetStub.restore();
    });
  });
  describe("generateMetadata", () => {
    it("should successfully generate metadata with altitude and reverse geocode data", async () => {
      // Mock the successful response for getAltitude and reverseGeoCode
      const getAltitudeResponse = { success: true, data: 1234 };
      const reverseGeoCodeResponse = {
        success: true,
        data: { site_tags: ["tag1", "tag2"], other_data: "other_data" },
        status: httpStatus.OK,
      };
      const getAltitudeStub = sinon.stub(createSite, "getAltitude").resolves(getAltitudeResponse);
      const reverseGeoCodeStub = sinon.stub(createSite, "reverseGeoCode").resolves(reverseGeoCodeResponse);

      const result = await createSite.generateMetadata(mockReq);

      expect(createSite.getAltitude.calledOnce).to.be.true;
      expect(createSite.reverseGeoCode.calledOnce).to.be.true;
      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully generated the metadata");
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({
        latitude: 40.7128,
        longitude: -74.006,
        site_tags: ["tag1", "tag2"],
        other_data: "other_data",
        altitude: 1234,
      });

      // Restore the stubs
      getAltitudeStub.restore();
      reverseGeoCodeStub.restore();
    });

    it("should handle errors and return 'internal server error' status", async () => {
      const getAltitudeStub = sinon.stub(createSite, "getAltitude").throws(new Error("Altitude error"));


      const result = await createSite.generateMetadata(mockReq);

      expect(createSite.getAltitude.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors).to.deep.equal({ message: "Altitude error" });

      // Restore the stubs
      getAltitudeStub.restore();
    });

    it("should handle 'not found' status when reverseGeoCode returns no data", async () => {
      // Mock a response for getAltitude and reverseGeoCode
      const getAltitudeResponse = { success: true, data: 1234 };
      const reverseGeoCodeResponse = { success: false, data: {}, status: httpStatus.NOT_FOUND };
      const getAltitudeStub = sinon.stub(createSite, "getAltitude").resolves(getAltitudeResponse);
      const reverseGeoCodeStub = sinon.stub(createSite, "reverseGeoCode").resolves(reverseGeoCodeResponse);

      const result = await createSite.generateMetadata(mockReq);

      expect(result.success).to.be.false;
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(result.data).to.deep.equal({});

      getAltitudeStub.restore();
      reverseGeoCodeStub.restore();
    });
  });
  describe("pickAvailableValue", () => {
    it("should return the available name from the valuesInObject", () => {
      const valuesInObject = {
        name1: null,
        name2: "Site 2",
        name3: null,
        name4: "Site 4",
      };

      const result = createSite.pickAvailableValue(valuesInObject);
      expect(result).to.equal("Site 2");
    });

    it("should return null if no available name in the valuesInObject", () => {
      const valuesInObject = {
        name1: null,
        name2: null,
        name3: null,
      };

      const result = createSite.pickAvailableValue(valuesInObject);
      expect(result).to.be.undefined;
    });

    it("should return undefined if the valuesInObject is empty", () => {
      const valuesInObject = {};

      const result = createSite.pickAvailableValue(valuesInObject);
      expect(result).to.be.undefined;
    });
  });
  describe("refresh", () => {
    afterEach(() => {
      sinon.reset(); // Reset the stub after each test case
    });

    it("should return the refreshed site details when successful", async () => {
      // Stub the necessary functions

      const generateFilterStub = sinon.stub(generateFilter, "sites").resolves(stubValue._id);

      const listStub = sinon.stub(siteSchema.statics, "list");
      listStub.returns({
        success: true,
        data: [stubValue],
      });

      const getAltitudeStub = sinon.stub(createSite, "getAltitude").resolves({
        success: true,
        data: 100, // Replace with the expected altitude value
      });

      const generateNameStub = sinon.stub(createSite, "generateName").resolves({
        success: true,
        data: stubValue.name, // Replace with the expected generated name
      });

      const findAirQloudsStub = sinon
        .stub(createSite, "findAirQlouds")
        .resolves({
          success: true,
          data: ["airqloud1", "airqloud2"], // Replace with the expected airqloud data
        });

      const findNearestWeatherStationStub = sinon
        .stub(createSite, "findNearestWeatherStation")
        .resolves({
          success: true,
          data: {
            latitude: 10.123,
            longitude: 20.456,
          }, // Replace with the expected nearest weather station data
        });

      const generateMetadataStub = sinon
        .stub(createSite, "generateMetadata")
        .resolves({
          success: true,
          data: {
            name: stubValue.name,
            latitude: stubValue.latitude,
            longitude: stubValue.longitude,
            // Add other metadata properties here
          }, // Replace with the expected metadata
        });

      const updateStub = sinon.stub(createSite, "update").resolves({
        success: true,
        data: stubValue,
      });

      // Prepare the request object
      const req = {
        query: {
          id: stubValue._id, 
        },
        // Add other required properties to the request body
      };

      // Call the refresh function
      const result = await createSite.refresh("testTenant", req);

      // Assert the result
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Site details successfully refreshed");
      // Add more assertions for the expected data in the result

      // Restore the stubbed functions
      getAltitudeStub.restore();
      generateNameStub.restore();
      findAirQloudsStub.restore();
      findNearestWeatherStationStub.restore();
      generateMetadataStub.restore();
      updateStub.restore();
      listStub.restore();
      generateFilterStub.restore();

    });

    it("should return the error response when refresh fails", async () => {

      const generateFilterStub = sinon.stub(generateFilter, "sites").throws(new Error("Mocked error"));

      // Prepare the request object
      const req = {
        query: {
          id: "123", // Replace with the site ID
        },
      };

      // Call the refresh function
      const result = await createSite.refresh("testTenant", req);

      // Assert the result
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.deep.equal({ message: "Mocked error" });
      generateFilterStub.restore();
    });

    // Add more test cases for other scenarios and error handling
  });
  describe("delete", () => {
    afterEach(() => {
      sinon.reset(); // Reset the stub after each test case
    });

    it("should return a response indicating that the feature is temporarily disabled", async () => {
      // Prepare the filter object
      const filter = {
        // Add filter conditions here
      };

      // Call the delete function
      const result = await createSite.delete("testTenant", filter);
      // Assert the result
      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "feature temporarity disabled --coming soon"
      );
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
      // Add more assertions for the expected error response data

      // No need to restore any stubbed functions in this case
    });

  });
  describe("list", () => {
    const listStub = sinon.stub(siteSchema.statics, "list");
    it("should return the response from the list function when successful", async () => {
      // Prepare the list options
      const options = {
        tenant: "testTenant",
        filter: {
          // Add filter conditions here
        },
        skip: 0,
        limit: 10,
      };
      listStub.resolves({
        success: true,
        data: [
          { lat_long: "1_1", name: "Site 1" },
          { lat_long: "2_2", name: "Site 2" },
          { lat_long: "4_4", name: "Site 3" },
          { lat_long: "3_3", name: "Site 4" },
        ],
      });

      const result = await createSite.list(options);

      // Assert the result
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([
        { lat_long: "1_1", name: "Site 1" },
        { lat_long: "2_2", name: "Site 2" },
        { lat_long: "3_3", name: "Site 4" },
      ],);
      listStub.restore();
    });

    it("should return the error response when list fails", async () => {
      listStub.throws(new Error("Mocked error"));
      // Prepare the list options
      const options = {
        tenant: "testTenant",
        filter: {
          // Add filter conditions here
        },
        skip: 0,
        limit: 10,
      };

      // Call the list function
      const result = await createSite.list(options);

      // Assert the result
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      listStub.restore();
    });
  });


    // Add more test cases for other scenarios and error handling
  describe("formatSiteName", () => {
    it("should format the site name by removing whitespace and converting to lowercase", () => {
      const siteName = "  My Test Site  ";
      const formattedName = createSite.formatSiteName(siteName);
      expect(formattedName).to.equal("mytestsite");
    });

    it("should return an empty string for an empty site name", () => {
      const siteName = "";
      const formattedName = createSite.formatSiteName(siteName);
      expect(formattedName).to.equal("");
    });

    it("should handle site names with special characters", () => {
      const siteName = "Site_with_!@#$%^&*()_-+={}[]|\\:;\"'<>,.?/";
      const formattedName = createSite.formatSiteName(siteName);
      expect(formattedName).to.equal(
        "site_with_!@#$%^&*()_-+={}[]|\\:;\"'<>,.?/"
      );
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("retrieveInformationFromAddress", () => {
    it("should retrieve the Google address details of the site", () => {
      const address = {
        results: [
          {
            address_components: [
              {
                long_name: "Town",
                types: ["locality", "administrative_area_level_3"],
              },
              {
                long_name: "District",
                types: ["administrative_area_level_2"],
              },
              {
                long_name: "Region",
                types: ["administrative_area_level_1"],
              },
              {
                long_name: "Street Name",
                types: ["route"],
              },
              {
                long_name: "Country",
                types: ["country"],
              },
              {
                long_name: "Parish Name",
                types: ["sublocality", "sublocality_level_1"],
              },
            ],
            formatted_address: "Formatted Address",
            geometry: { location: { lat: 12.345, lng: 67.89 } },
            place_id: "GooglePlaceID",
            types: ["site_tags"],
          },
        ],
      };

      const expectedData = {
        town: "Town",
        city: "Town",
        district: "District",
        county: "District",
        region: "Region",
        street: "Street Name",
        country: "Country",
        parish: "Parish Name",
        division: "Parish Name",
        village: "Parish Name",
        sub_county: "Parish Name",
        search_name: "Parish Name",
        formatted_name: "Formatted Address",
        geometry: { location: { lat: 12.345, lng: 67.89 } },
        site_tags: ["site_tags"],
        google_place_id: "GooglePlaceID",
        location_name: "Region, Country",
      };

      const result = createSite.retrieveInformationFromAddress(address);
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(expectedData);
    });

    it("should return an error message for invalid address data", () => {
      const address = {
        results: [], // Empty results array
      };

      const result = createSite.retrieveInformationFromAddress(address);
      expect(result.success).to.be.false;
      expect(result.message).to.equal("unable to transform the address");
      expect(result.errors).to.exist;
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("reverseGeoCode", () => {
    it("should retrieve the site address details", async () => {
      const latitude = 12.345;
      const longitude = 67.89;
      const url = "https://example.com/reverse-geo-code"; // Replace with the actual URL

      // Stub axios.get to return mock data
      const axiosGetStub = sinon.stub(axios, "get");
      axiosGetStub.resolves({
        data: {
          results: [
            {
              address_components: [
                {
                  long_name: "Town",
                  types: ["locality", "administrative_area_level_3"],
                },
                // Add more address component data as needed
              ],
              formatted_address: "Formatted Address",
              geometry: { location: { lat: latitude, lng: longitude } },
              place_id: "GooglePlaceID",
              types: ["site_tags"],
            },
          ],
        },
      });

      const retrieveInformationFromAddressStub = sinon.stub(createSite, "retrieveInformationFromAddress").resolves({
        success: true,
        data: {
          town: "Town",
        },
      });

      const expectedData = {
        town: "Town",
        // Add more expected data as needed
      };

      const result = await createSite.reverseGeoCode(latitude, longitude);
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(expectedData);

      // Restore the stub after the test
      axiosGetStub.restore();
      retrieveInformationFromAddressStub.restore();
    });

    it("should return an error message for invalid coordinates", async () => {
      const latitude = 0;
      const longitude = 0;
      const url = "https://example.com/reverse-geo-code"; // Replace with the actual URL

      // Stub axios.get to return an empty results array
      const axiosGetStub = sinon.stub(axios, "get");
      axiosGetStub.withArgs(url).resolves({
        data: {
          results: [],
        },
      });

      const result = await createSite.reverseGeoCode(latitude, longitude);
      expect(result.success).to.be.false;
      expect(result.message).to.equal("unable to get the address values");
      expect(result.errors).to.exist;

      // Restore the stub after the test
      axiosGetStub.restore();
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("getAltitude", () => {
    const elevationStub = sinon.stub(client, "elevation");
    it("should successfully retrieve the altitude details", async () => {
      const latitude = 12.345;
      const longitude = 67.89;
      const mockAltitude = -4225.99462890625; // Replace with the desired mock altitude

      // Stub Client.elevation to return mock data
      elevationStub.resolves({
        data: {
          results: [{ elevation: mockAltitude }],
          status: httpStatus.OK,
        },
      });

      const expectedData = mockAltitude;

      const result = await createSite.getAltitude(latitude, longitude);
      expect(result.success).to.be.true;
      expect(result.data).to.equal(expectedData);

      // Restore the stub after the test
      elevationStub.restore();
    }).timeout(5000);

    it("should return an error for a bad gateway response", async () => {
      const latitude = null;
      const longitude = 67.89;

      // Stub Client.elevation to return a bad gateway response
      elevationStub.rejects({
        response: {
          data: "Bad Gateway",
          status: httpStatus.BAD_GATEWAY,
        },
      });

      const result = await createSite.getAltitude(latitude, longitude);
      expect(result.success).to.be.false;
      expect(result.message).to.equal("get altitude server error");
      expect(result.errors).to.exist;

      // Restore the stub after the test
      elevationStub.restore();
    });

    it("should return an error for an internal server error", async () => {
      const latitude = null;
      const longitude = 67.89;

      // Stub Client.elevation to throw an internal server error
      elevationStub
        .throws(new Error("Internal Server Error"));

      const result = await createSite.getAltitude(latitude, longitude);
      expect(result.success).to.be.false;
      expect(result.message).to.equal("get altitude server error");
      expect(result.errors).to.exist;

      // Restore the stub after the test
      elevationStub.restore();
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("generateLatLong", () => {
    it("should generate the correct lat_long string", () => {
      const latitude = 12.345;
      const longitude = 67.89;

      const expectedLatLong = "12.345_67.89";

      const result = createSite.generateLatLong(latitude, longitude);
      expect(result).to.equal(expectedLatLong);
    });

    it("should handle negative coordinates", () => {
      const latitude = -12.345;
      const longitude = -67.89;

      const expectedLatLong = "-12.345_-67.89";

      const result = createSite.generateLatLong(latitude, longitude);
      expect(result).to.equal(expectedLatLong);
    });

    it("should handle zero coordinates", () => {
      const latitude = 0;
      const longitude = 0;

      const expectedLatLong = "0_0";

      const result = createSite.generateLatLong(latitude, longitude);
      expect(result).to.equal(expectedLatLong);
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("findNearestSitesByCoordinates", async () => {
    it("should find the nearest sites within the given radius", async () => {
      const radius = 5; // Consider sites within 5 km radius
      const latitude = 12.345; // Test latitude
      const longitude = 67.89; // Test longitude
      const tenant = "example_tenant"; // Your test tenant name

      // Mock the response from createSite.list function
      const mockListResponse = {
        success: true,
        data: [
          {
            id: 1,
            name: "Site 1",
            latitude: 12.546, // Slightly outside the radius
            longitude: 67.89,
          },
          {
            id: 2,
            name: "Site 2",
            latitude: 12.345, // Within the radius
            longitude: 67.891, // Slightly outside the radius
          },
          {
            id: 3,
            name: "Site 3",
            latitude: 12.345, // Within the radius
            longitude: 67.889, // Within the radius
          },
          {
            id: 4,
            name: "Site 4",
            latitude: 13.34, // Outside the radius
            longitude: 67.88, // Outside the radius
          },
        ],
        status: 200, // Status code (optional)
      };

      // Mock the distanceUtil.distanceBtnTwoPoints function
      const distanceUtil = {
        distanceBtnTwoPoints: (lat1, lon1, lat2, lon2) => {
          // Simple distance calculation (haversine formula, etc.) for testing purposes
          const dLat = lat2 - lat1;
          const dLon = lon2 - lon1;
          return Math.sqrt(dLat * dLat + dLon * dLon);
        },
      };

      // Overwrite the distanceUtil used in the createSite utility with the mock version
      // createSite.distanceUtil = distanceUtil;
      const distanceStub = sinon.replace
        (distanceUtil, "distanceBtnTwoPoints", sinon.fake(distanceUtil.distanceBtnTwoPoints));

      // Mock the createSite.list function to return the mock response
      createSite.list = async () => mockListResponse;

      // Call the findNearestSitesByCoordinates function
      const request = { radius, latitude, longitude, tenant };
      const result = await createSite.findNearestSitesByCoordinates(request);

      // Expected result based on the mock data
      const expectedResponse = {
        success: true,
        data: [
          {
            id: 2,
            name: "Site 2",
            latitude: 12.345,
            longitude: 67.891,
            distance: 0.10862387304028723, // Distance between (latitude, longitude) and (12.345, 67.891)
          },
          {
            id: 3,
            name: "Site 3",
            latitude: 12.345,
            longitude: 67.889,
            distance: 0.10862387304028723, // Distance between (latitude, longitude) and (12.345, 67.889)
          },
        ],
        message: "successfully retrieved the nearest sites",
        status: 200, // Status code from the mock response
      };

      // Assert the actual result against the expected result
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should handle errors from createSite.list function", async () => {
      const radius = 5; // Consider sites within 5 km radius
      const latitude = 12.345; // Test latitude
      const longitude = 67.89; // Test longitude
      const tenant = "example_tenant"; // Your test tenant name

      // Mock the response from createSite.list function
      const mockListErrorResponse = {
        success: false,
        message: "Error in createSite.list function",
        status: 500, // Status code (optional)
        errors: { message: "createSite.list function failed" },
      };

      // Mock the createSite.list function to return the error response
      createSite.list = async () => mockListErrorResponse;

      // Call the findNearestSitesByCoordinates function
      const request = { radius, latitude, longitude, tenant };
      const result = await createSite.findNearestSitesByCoordinates(request);

      // Expected result based on the mock error response
      const expectedErrorResponse = {
        success: false,
        message: "Error in createSite.list function",
        status: 500, // Status code from the mock error response
        errors: { message: "createSite.list function failed" },
      };

      // Assert the actual result against the expected error response
      expect(result).to.deep.equal(expectedErrorResponse);
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("createApproximateCoordinates", () => {
    it("should create approximate coordinates based on input parameters", () => {
      const latitude = 12.345; // Test latitude
      const longitude = 67.89; // Test longitude
      const approximate_distance_in_km = 1; // Test approximate distance in km
      const bearing = 45; // Test bearing in degrees

      // Mock the response from distanceUtil.createApproximateCoordinates function
      const mockResponse = {
        provided_latitude: 12.345,
        provided_longitude: 67.89,
        approximate_distance_in_km: 1, // Same as input approximate_distance_in_km
        approximate_latitude: 12.337025313531365,
        approximate_longitude: 67.88576668161961,
        bearing_in_radians: 3.62
      };

      const randomnumberStub = sinon.stub(distanceUtil, "generateRandomNumbers").returns(3.62);

      // Call the createApproximateCoordinates function
      const result = distanceUtil.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      });


      // Assert the actual result against the expected result
      expect(result).to.deep.equal(mockResponse);
      randomnumberStub.restore();
    });

    it("should handle errors from distanceUtil.createApproximateCoordinates function", () => {
      const latitude = 12.345; // Test latitude
      const longitude = 67.89; // Test longitude
      const approximate_distance_in_km = 1; // Test approximate distance in km
      const bearing = 45; // Test bearing in degrees

      const generateRandomNumbersStub = sinon.stub(distanceUtil, "degreesToRadians")
        .throws(new Error("Error in createApproximateCoordinates"));

      // Call the createApproximateCoordinates function
      const result = distanceUtil.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      });
      // Expected result for the error scenario
      const expectedErrorResponse = {
        success: false,
        message: "Internal Server Error",
        errors: {
          message: "Error in createApproximateCoordinates",
        },
      };

      // Assert the actual result against the expected error response
      expect(result).to.deep.equal(expectedErrorResponse);
      generateRandomNumbersStub.restore();
    });

    // Add more test cases for edge cases and specific scenarios
  });

  // Add more test cases for other functions in createSite if necessary
});
