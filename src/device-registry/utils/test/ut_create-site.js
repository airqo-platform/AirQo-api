require("module-alias/register");
process.env.NODE_ENV = "development";
const chai = require("chai");
const sinon = require("sinon");
const createSite = require("@utils/create-site");
const httpStatus = require("http-status");
const expect = chai.expect;

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
          },
          {
            _id: "airqloud_id2",
            location: {
              coordinates: [[[3, 3], [3, 4], [4, 4], [4, 3], [3, 3]]],
            },
          },
        ],
      };

      // Stub the list function in createSite to return the mock response
      const listStub = sinon.stub(createSite, "list");
      listStub.resolves(listResponse);

      // Call the function and assert
      const result = await createSite.findAirQlouds(request);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(["airqloud_id1"]);
      // Add more assertions based on the expected results for successful case

      // Restore the stub to its original function
      listStub.restore();
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
      // Mock the axios.get function to return a successful response
      const axiosGetStub = sinon.stub(createSite.axiosInstance(), "get");
      const mockResponse = {
        data: {
          data: [
            {
              id: "station_id_1",
              code: "station_code_1",
              location: {
                latitude: 1.111,
                longitude: 5.555,
                elevationmsl: 100,
                countrycode: "US",
                timezone: "America/New_York",
                timezoneoffset: -4,
                name: "Station 1",
                type: "Weather Station",
              },
            },
            {
              id: "station_id_2",
              code: "station_code_2",
              location: {
                latitude: 2.222,
                longitude: 6.666,
                elevationmsl: 150,
                countrycode: "CA",
                timezone: "America/Toronto",
                timezoneoffset: -5,
                name: "Station 2",
                type: "Weather Station",
              },
            },
          ],
        },
      };
      axiosGetStub.resolves(mockResponse);

      // Call the function and assert
      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(2);
      expect(result.data[0].id).to.equal("station_id_1");
      // Add more assertions based on the expected results for a successful case

      // Restore the stub to its original function
      axiosGetStub.restore();
    });

    it("should return an error response when the API call fails", async () => {
      // Mock the axios.get function to return an error response
      const axiosGetStub = sinon.stub(createSite.axiosInstance(), "get");
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
      const axiosGetStub = sinon.stub(createSite.axiosInstance(), "get");
      const mockResponse = {
        data: {},
      };
      axiosGetStub.resolves(mockResponse);

      // Call the function and assert
      const result = await createSite.listWeatherStations();

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      // Add more assertions based on the expected results when the API response has no data

      // Restore the stub to its original function
      axiosGetStub.restore();
    });

    // Add more test cases for different scenarios if necessary
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
      sinon
        .stub(getModelByTenant, "modify")
        .returns(responseFromModifyUniqueIdentifierCounter);

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.true;
      expect(result.message).to.equal("unique name generated for this site");
      expect(result.data).to.equal(expectedName);
      expect(result.status).to.equal(200);

      getModelByTenant.modify.restore();
    });

    it("should handle errors when unable to find the counter document", async () => {
      const tenant = "example_tenant";

      const responseFromModifyUniqueIdentifierCounter = {
        success: false,
        errors: { message: "Unable to find the counter document" },
        status: 404,
      };
      sinon
        .stub(getModelByTenant, "modify")
        .returns(responseFromModifyUniqueIdentifierCounter);

      const result = await createSite.generateName(tenant);

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "unable to generate unique name for this site, contact support"
      );
      expect(result.errors).to.deep.equal({
        message: "Unable to find the counter document",
      });
      expect(result.status).to.equal(404);

      getModelByTenant.modify.restore();
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
      const generated_name = "site_1"; // Assuming the initial count is 0 and it increments for each generation

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
        data: {
          // Your created site data here
        },
        status: 201,
      };
      sinon.stub(getModelByTenant, "register").resolves(responseFromCreateSite);

      const result = await createSite.create(tenant, req);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromCreateSite.data);
      expect(result.status).to.equal(201);

      createSite.generateName.restore();
      createSite.createApproximateCoordinates.restore();
      createSite.generateMetadata.restore();
      getModelByTenant.register.restore();
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
      // Add more assertions for the specific error handling

      // No need to restore the stubs since we're not using them in this case
    });

    // Add more test cases based on other possible scenarios and error cases
  });
  describe("update", () => {
    it("should update a site with valid parameters", async () => {
      const tenant = "example_tenant";
      const filter = { _id: "site_id" }; // Replace with the filter to select the specific site
      const update = {
        name: "Updated Site Name",
        latitude: 40.7128,
        longitude: -74.006,
        airqlouds: [],
        network: "example_network",
        approximate_distance_in_km: 10,
      };

      const responseFromModifySite = {
        success: true,
        data: {
          // Your updated site data here
        },
        status: 200,
      };
      sinon.stub(getModelByTenant, "modify").resolves(responseFromModifySite);

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(responseFromModifySite.data);
      expect(result.status).to.equal(200);

      getModelByTenant.modify.restore();
    });

    it("should handle errors when updating a site", async () => {
      const tenant = "example_tenant";
      const filter = { _id: "site_id" }; // Replace with the filter to select the specific site
      const update = {
        // Invalid update data
      };

      const result = await createSite.update(tenant, filter, update);

      expect(result.success).to.be.false;
      // Add more assertions for the specific error handling

      // No need to restore the stub since we're not using it in this case
    });

    // Add more test cases based on other possible scenarios and error cases
  });
  describe("sanitiseName", () => {
    it("should remove white spaces and convert to lowercase when the name is longer than 15 characters", () => {
      const name = "  This is a Long Name  ";
      const result = createSite.sanitiseName(name);

      expect(result).to.equal("thisisalongna");
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

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully retrieved the road metadata"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(result.data).to.deep.equal({
        key1_data: "Your mocked response for key1",
        key2_data: "Your mocked response for key2",
      });
    });

    it("should return 'not found' status when no road metadata is retrieved", async () => {
      // Mock an empty response for both keys
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
      // Mock an error response
      axios.get = async () => {
        throw new Error("Mocked error");
      };

      const latitude = 40.7128;
      const longitude = -74.006;

      const result = await createSite.getRoadMetadata(latitude, longitude);

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.deep.equal({ message: "Mocked error" });
    });
  });
  describe("generateMetadata", () => {
    it("should successfully generate metadata with altitude and reverse geocode data", async () => {
      // Mock the successful response for getAltitude and reverseGeoCode
      const getAltitudeResponse = { success: true, data: 1234 };
      const reverseGeoCodeResponse = {
        success: true,
        data: { site_tags: ["tag1", "tag2"], other_data: "other_data" },
      };
      sinon.stub(createSite, "getAltitude").resolves(getAltitudeResponse);
      sinon.stub(createSite, "reverseGeoCode").resolves(reverseGeoCodeResponse);

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
      createSite.getAltitude.restore();
      createSite.reverseGeoCode.restore();
    });

    it("should handle errors and return 'internal server error' status", async () => {
      // Mock an error response for getAltitude
      const getAltitudeResponse = {
        success: false,
        errors: { message: "Altitude error" },
      };
      sinon.stub(createSite, "getAltitude").resolves(getAltitudeResponse);

      const result = await createSite.generateMetadata(mockReq);

      expect(createSite.getAltitude.calledOnce).to.be.true;
      expect(createSite.reverseGeoCode.called).to.be.false; // Should not call reverseGeoCode if getAltitude fails
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.deep.equal({ message: "Altitude error" });

      // Restore the stubs
      createSite.getAltitude.restore();
    });

    it("should handle 'not found' status when reverseGeoCode returns no data", async () => {
      // Mock a response for getAltitude and reverseGeoCode
      const getAltitudeResponse = { success: true, data: 1234 };
      const reverseGeoCodeResponse = { success: false };
      sinon.stub(createSite, "getAltitude").resolves(getAltitudeResponse);
      sinon.stub(createSite, "reverseGeoCode").resolves(reverseGeoCodeResponse);

      const result = await createSite.generateMetadata(mockReq);

      expect(createSite.getAltitude.calledOnce).to.be.true;
      expect(createSite.reverseGeoCode.calledOnce).to.be.true;
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(result.errors).to.deep.equal({ message: "" });

      // Restore the stubs
      createSite.getAltitude.restore();
      createSite.reverseGeoCode.restore();
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
      expect(result).to.be.null;
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
      const getAltitudeStub = sinon.stub(createSite, "getAltitude").resolves({
        success: true,
        data: 100, // Replace with the expected altitude value
      });

      const generateNameStub = sinon.stub(createSite, "generateName").resolves({
        success: true,
        data: "site_1", // Replace with the expected generated name
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
            name: "Site 1",
            latitude: 10.123,
            longitude: 20.456,
            // Add other metadata properties here
          }, // Replace with the expected metadata
        });

      const updateStub = sinon.stub().resolves({
        success: true,
        data: {
          // Replace with the updated site data
        },
      });

      // Stub the getModelByTenant function to return the stubbed update function
      getModelByTenantStub.returns({ modify: updateStub });

      // Prepare the request object
      const req = {
        query: {
          id: "123", // Replace with the site ID
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
    });

    it("should return the error response when getModelByTenant fails", async () => {
      // Stub the getModelByTenant function to throw an error
      getModelByTenantStub.throws(new Error("Database connection error"));

      // Prepare the request object
      const req = {
        query: {
          id: "123", // Replace with the site ID
        },
        // Add other required properties to the request body
      };

      // Call the refresh function
      const result = await createSite.refresh("testTenant", req);

      // Assert the result
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      // Add more assertions for the error response data

      // Restore the stubbed functions
      getModelByTenantStub.restore();
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

    it("should return the error response when getModelByTenant fails", async () => {
      // Stub the getModelByTenant function to throw an error
      getModelByTenantStub.throws(new Error("Database connection error"));

      // Prepare the filter object
      const filter = {
        // Add filter conditions here
      };

      // Call the delete function
      const result = await createSite.delete("testTenant", filter);

      // Assert the result
      expect(result.success).to.be.false;
      expect(result.message).to.equal("delete Site util server error");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      // Add more assertions for the error response data

      // Restore the stubbed functions
      getModelByTenantStub.restore();
    });

    it("should return the response from the remove function when successful", async () => {
      // Stub the necessary functions
      const removeStub = sinon.stub().resolves({
        success: true,
        data: {
          // Replace with the removed site data
        },
      });

      // Stub the getModelByTenant function to return the stubbed remove function
      getModelByTenantStub.returns({ remove: removeStub });

      // Prepare the filter object
      const filter = {
        // Add filter conditions here
      };

      // Call the delete function
      const result = await createSite.delete("testTenant", filter);

      // Assert the result
      expect(result.success).to.be.true;
      // Add more assertions for the expected data in the result

      // Restore the stubbed functions
      getModelByTenantStub.restore();
      removeStub.restore();
    });

    // Add more test cases for other scenarios and error handling
  });
  describe("list", () => {
    afterEach(() => {
      sinon.reset(); // Reset the stub after each test case
    });

    it("should return the error response when getModelByTenant fails", async () => {
      // Stub the getModelByTenant function to throw an error
      getModelByTenantStub.throws(new Error("Database connection error"));

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
      // Add more assertions for the error response data

      // Restore the stubbed functions
      getModelByTenantStub.restore();
    });

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

      // Stub the necessary functions
      const listStub = sinon.stub().resolves({
        success: true,
        data: [
          // Replace with site data objects
        ],
      });

      // Stub the getModelByTenant function to return the stubbed list function
      getModelByTenantStub.returns({ list: listStub });

      // Call the list function
      const result = await createSite.list(options);

      // Assert the result
      expect(result.success).to.be.true;
      // Add more assertions for the expected data in the result

      // Restore the stubbed functions
      getModelByTenantStub.restore();
      listStub.restore();
    });

    it("should filter out objects with 'lat_long' value equal to '4_4'", async () => {
      // Prepare the list options
      const options = {
        tenant: "testTenant",
        filter: {
          // Add filter conditions here
        },
        skip: 0,
        limit: 10,
      };

      // Stub the necessary functions
      const listStub = sinon.stub().resolves({
        success: true,
        data: [
          { lat_long: "1_1", name: "Site 1" },
          { lat_long: "2_2", name: "Site 2" },
          { lat_long: "4_4", name: "Site 3" },
          { lat_long: "3_3", name: "Site 4" },
        ],
      });

      // Stub the getModelByTenant function to return the stubbed list function
      getModelByTenantStub.returns({ list: listStub });

      // Call the list function
      const result = await createSite.list(options);

      // Assert the result
      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(3);
      // Add more assertions for the expected filtered data in the result

      // Restore the stubbed functions
      getModelByTenantStub.restore();
      listStub.restore();
    });

    // Add more test cases for other scenarios and error handling
  });
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
        search_name: "Town",
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
      axiosGetStub.withArgs(url).resolves({
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

      const expectedData = {
        town: "Town",
        // Add more expected data as needed
      };

      const result = await createSite.reverseGeoCode(latitude, longitude);
      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(expectedData);

      // Restore the stub after the test
      axiosGetStub.restore();
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
      expect(result.message).to.equal("unable to get the site address details");
      expect(result.errors).to.exist;

      // Restore the stub after the test
      axiosGetStub.restore();
    });

    // Add more test cases for edge cases and specific scenarios
  });
  describe("getAltitude", () => {
    it("should successfully retrieve the altitude details", async () => {
      const latitude = 12.345;
      const longitude = 67.89;
      const mockAltitude = 100.0; // Replace with the desired mock altitude

      // Stub Client.elevation to return mock data
      const elevationStub = sinon.stub(Client, "elevation").resolves({
        data: {
          results: [{ elevation: mockAltitude }],
          status: StatusCodes.OK,
        },
      });

      const expectedData = mockAltitude;

      const result = await createSite.getAltitude(latitude, longitude);
      expect(result.success).to.be.true;
      expect(result.data).to.equal(expectedData);

      // Restore the stub after the test
      elevationStub.restore();
    });

    it("should return an error for a bad gateway response", async () => {
      const latitude = 12.345;
      const longitude = 67.89;

      // Stub Client.elevation to return a bad gateway response
      const elevationStub = sinon.stub(Client, "elevation").rejects({
        response: {
          data: "Bad Gateway",
          status: StatusCodes.BAD_GATEWAY,
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
      const latitude = 12.345;
      const longitude = 67.89;

      // Stub Client.elevation to throw an internal server error
      const elevationStub = sinon
        .stub(Client, "elevation")
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

      const expectedLatLong = "12.345_67.890";

      const result = createSite.generateLatLong(latitude, longitude);
      expect(result).to.equal(expectedLatLong);
    });

    it("should handle negative coordinates", () => {
      const latitude = -12.345;
      const longitude = -67.89;

      const expectedLatLong = "-12.345_-67.890";

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
            latitude: 12.346, // Slightly outside the radius
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
            latitude: 12.34, // Outside the radius
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
      createSite.distanceUtil = distanceUtil;

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
            distance: 0.001, // Distance between (latitude, longitude) and (12.345, 67.891)
          },
          {
            id: 3,
            name: "Site 3",
            latitude: 12.345,
            longitude: 67.889,
            distance: 0.001, // Distance between (latitude, longitude) and (12.345, 67.889)
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
        latitude: 12.346, // Approximate latitude
        longitude: 67.891, // Approximate longitude
        bearing_in_radians: 0.7853981633974483, // Approximate bearing in radians
        approximate_distance_in_km: 1, // Same as input approximate_distance_in_km
      };

      // Mock the distanceUtil.createApproximateCoordinates function to return the mock response
      distanceUtil.createApproximateCoordinates = ({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      }) => mockResponse;

      // Call the createApproximateCoordinates function
      const result = distanceUtil.createApproximateCoordinates({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      });

      // Expected result based on the mock data
      const expectedResponse = {
        success: true,
        data: mockResponse,
        message: "successfully approximated the GPS coordinates",
      };

      // Assert the actual result against the expected result
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should handle errors from distanceUtil.createApproximateCoordinates function", () => {
      const latitude = 12.345; // Test latitude
      const longitude = 67.89; // Test longitude
      const approximate_distance_in_km = 1; // Test approximate distance in km
      const bearing = 45; // Test bearing in degrees

      // Mock the distanceUtil.createApproximateCoordinates function to throw an error
      distanceUtil.createApproximateCoordinates = ({
        latitude,
        longitude,
        approximate_distance_in_km,
        bearing,
      }) => {
        throw new Error("Error in createApproximateCoordinates");
      };

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
    });

    // Add more test cases for edge cases and specific scenarios
  });

  // Add more test cases for other functions in createSite if necessary
});
