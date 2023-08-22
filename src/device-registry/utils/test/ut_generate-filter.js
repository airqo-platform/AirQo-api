require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const generateFilter = require("@utils/generate-filter"); // Update the path if needed

describe("generateFilter", () => {
  describe("events", () => {
    it("should generate the filter for events with valid query parameters", () => {
      const request = {
        query: {
          device: "device_1",
          site: "site_1",
          frequency: "hourly",
          startTime: "2023-07-01T00:00:00.000Z",
          endTime: "2023-07-02T00:00:00.000Z",
          index: "good",
          metadata: "meta_1",
        },
      };

      const result = generateFilter.events(request);

      // Add your assertions based on the expected output of the filter
      expect(result).to.be.an("object");
      expect(result.success).to.be.true;
      expect(result.data).to.be.an("object");
      // Add more assertions as needed
    });

    it("should handle errors and return a failure response", () => {
      const request = {
        query: {
          // Add invalid query parameters to trigger an error
        },
      };

      const result = generateFilter.events(request);

      // Add your assertions for the error response
      expect(result).to.be.an("object");
      expect(result.success).to.be.false;
      expect(result.message).to.equal("unable to generate the filter");
      expect(result.errors).to.be.an("object");
      // Add more assertions as needed
    });

    // Add more test cases for different scenarios
  });
  describe("generateRegexExpressionFromStringElement", () => {
    it("should return a regex expression with the given element as a string", () => {
      const element = "example";
      const result = generateFilter.generateRegexExpressionFromStringElement(
        element
      );

      // Assert that the result is a string containing the given element
      expect(result)
        .to.be.a("string")
        .that.includes(element);
      // Add more specific assertions for the expected regex behavior if needed
    });

    it("should return an empty string for an empty element", () => {
      const element = "";
      const result = generateFilter.generateRegexExpressionFromStringElement(
        element
      );

      // Assert that the result is an empty string
      expect(result).to.be.a("string").that.is.empty;
    });

    // Add more test cases for different scenarios
  });
  describe("devices", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          name: "device1,device2",
          channel: "1",
          category: "category1",
          network: "network1",
          device_number: "10",
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          device_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          device_codes: "code1,code2",
          chid: "2",
          location: "location1",
          loc: "location2",
          site: "site1",
          site_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          siteName: "Site A",
          mapAddress: "Address A",
          map: "Map B",
          primary: "Yes",
          active: "yes",
          visibility: "No",
        },
      };

      const expectedResult = {
        name: {
          $in: ["DEVICE1", "device1", "DEVICE2", "device2"],
        },
        device_number: 1,
        category: "category1",
        network: "network1",
        _id: "617a8a7c8f7a912abc456def",
        device_codes: {
          $in: ["code1", "code2"],
        },
        locationID: "location1",
        site_id: "site1",
        siteName: "Site A",
        locationName: "Address A",
        isPrimaryInLocation: true,
        isActive: true,
        visibility: false,
      };

      const result = generateFilter.devices(req);

      expect(result).to.deep.equal({
        success: true,
        message: "successfully generated the filter",
        data: expectedResult,
      });
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.devices(req);

      expect(result).to.deep.equal({
        success: true,
        message: "successfully generated the filter",
        data: {},
      });
    });

    // Add more test cases for different scenarios
  });
  describe("sites", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          lat_long: "latitude,longitude",
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          generated_name: "Site A",
          district: "District A",
          region: "Region A",
          city: "City A",
          street: "Street A",
          country: "Country A",
          county: "County A",
          parish: "Parish A",
          name: "Site Name",
          site_codes: "code1,code2",
          _id: "617a8a7c8f7a912abc456def", // Example ObjectId
          network: "Network A",
          google_place_id: "google-place-id",
        },
      };

      const expectedResult = {
        lat_long: "latitude,longitude",
        _id: "617a8a7c8f7a912abc456def",
        site_codes: {
          $in: ["code1", "code2"],
        },
        google_place_id: "google-place-id",
        generated_name: "Site A",
        district: "District A",
        region: "Region A",
        city: "City A",
        street: "Street A",
        country: "Country A",
        county: "County A",
        parish: "Parish A",
        name: "Site Name",
        network: "Network A",
      };

      const result = generateFilter.sites(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.sites(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("airqlouds", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "AirQloud Name",
          admin_level: "Admin Level A",
          summary: "yes",
          dashboard: "yes",
          airqloud_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          network: "Network A",
          airqloud: "AirQloud Name",
          airqloud_codes: "code1,code2",
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "AirQloud Name",
        admin_level: "Admin Level A",
        summary: "yes",
        dashboard: "yes",
        airqloud_codes: {
          $in: ["code1", "code2"],
        },
        network: "Network A",
      };

      const result = generateFilter.airqlouds(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'name' field if 'name' parameter is provided and 'airqloud' parameter is not provided", () => {
      const req = {
        query: {
          name: "AirQloud Name",
        },
      };

      const expectedResult = {
        name: "AirQloud Name",
      };

      const result = generateFilter.airqlouds(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'name' field if 'airqloud' parameter is provided and 'name' parameter is not provided", () => {
      const req = {
        query: {
          airqloud: "AirQloud Name",
        },
      };

      const expectedResult = {
        name: "AirQloud Name",
      };

      const result = generateFilter.airqlouds(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.airqlouds(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("grids", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "Grid Name",
          admin_level: "Admin Level A",
          grid_codes: "code1,code2",
        },
        params: {
          grid_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "Grid Name",
        admin_level: "Admin Level A",
        grid_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'grid_codes' field if 'grid_codes' parameter is provided", () => {
      const req = {
        query: {
          grid_codes: "code1,code2",
        },
        params: {},
      };

      const expectedResult = {
        grid_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'grid_id' parameter if 'grid_id' parameter is provided", () => {
      const req = {
        query: {},
        params: {
          grid_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'admin_level' field if 'admin_level' parameter is provided", () => {
      const req = {
        query: {
          admin_level: "Admin Level A",
        },
        params: {},
      };

      const expectedResult = {
        admin_level: "Admin Level A",
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.grids(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("cohorts", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "Cohort Name",
          cohort_codes: "code1,code2",
          network_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {
          cohort_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "Cohort Name",
        cohort_codes: {
          $in: ["code1", "code2"],
        },
        network_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'cohort_codes' field if 'cohort_codes' parameter is provided", () => {
      const req = {
        query: {
          cohort_codes: "code1,code2",
        },
        params: {},
      };

      const expectedResult = {
        cohort_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'network_id' field if 'network_id' parameter is provided", () => {
      const req = {
        query: {
          network_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        network_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'cohort_id' parameter if 'cohort_id' parameter is provided", () => {
      const req = {
        query: {},
        params: {
          cohort_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.cohorts(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("networks", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "Network Name",
          network_codes: "code1,code2",
        },
        params: {
          net_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "Network Name",
        network_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'network_codes' field if 'network_codes' parameter is provided", () => {
      const req = {
        query: {
          network_codes: "code1,code2",
        },
        params: {},
      };

      const expectedResult = {
        network_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'net_id' parameter if 'net_id' parameter is provided", () => {
      const req = {
        query: {},
        params: {
          net_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.networks(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("admin_levels", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "Admin Level",
          admin_level_codes: "code1,code2",
        },
        params: {
          level_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "Admin Level",
        admin_level_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.admin_levels(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'admin_level_codes' field if 'admin_level_codes' parameter is provided", () => {
      const req = {
        query: {
          admin_level_codes: "code1,code2",
        },
        params: {},
      };

      const expectedResult = {
        admin_level_codes: {
          $in: ["code1", "code2"],
        },
      };

      const result = generateFilter.admin_levels(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'level_id' parameter if 'level_id' parameter is provided", () => {
      const req = {
        query: {},
        params: {
          level_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.admin_levels(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.admin_levels(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.admin_levels(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("locations", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          name: "Location Name",
          admin_level: "Level 1",
          summary: "yes",
          network: "Network Name",
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        name: "Location Name",
        admin_level: "Level 1",
        summary: "yes",
        network: "Network Name",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'summary' field if 'summary' parameter is provided", () => {
      const req = {
        query: {
          summary: "yes",
        },
      };

      const expectedResult = {
        summary: "yes",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'name' field if 'name' parameter is provided", () => {
      const req = {
        query: {
          name: "Location Name",
        },
      };

      const expectedResult = {
        name: "Location Name",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'network' field if 'network' parameter is provided", () => {
      const req = {
        query: {
          network: "Network Name",
        },
      };

      const expectedResult = {
        network: "Network Name",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'admin_level' field if 'admin_level' parameter is provided", () => {
      const req = {
        query: {
          admin_level: "Level 1",
        },
      };

      const expectedResult = {
        admin_level: "Level 1",
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.locations(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("activities", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          device: "Device Name",
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          activity_type: "Type",
          activity_tags: "Tag1,Tag2",
          maintenance_type: "Maintenance",
          recall_type: "Recall",
          site_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          network: "Network Name",
          activity_codes: "Code1,Code2",
        },
      };

      const expectedResult = {
        device: "Device Name",
        _id: "617a8a7c8f7a912abc456def",
        activityType: "Type",
        tags: { $in: ["Tag1", "Tag2"] },
        maintenanceType: "Maintenance",
        recallType: "Recall",
        site_id: "617a8a7c8f7a912abc456def",
        network: "Network Name",
        activity_codes: { $in: ["Code1", "Code2"] },
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'activityType' field if 'activity_type' parameter is provided", () => {
      const req = {
        query: {
          activity_type: "Type",
        },
      };

      const expectedResult = {
        activityType: "Type",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'maintenanceType' field if 'maintenance_type' parameter is provided", () => {
      const req = {
        query: {
          maintenance_type: "Maintenance",
        },
      };

      const expectedResult = {
        maintenanceType: "Maintenance",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'recallType' field if 'recall_type' parameter is provided", () => {
      const req = {
        query: {
          recall_type: "Recall",
        },
      };

      const expectedResult = {
        recallType: "Recall",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'site_id' field from 'site_id' parameter if 'site_id' parameter is provided", () => {
      const req = {
        query: {
          site_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        site_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'network' field if 'network' parameter is provided", () => {
      const req = {
        query: {
          network: "Network Name",
        },
      };

      const expectedResult = {
        network: "Network Name",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'activity_codes' field if 'activity_codes' parameter is provided", () => {
      const req = {
        query: {
          activity_codes: "Code1,Code2",
        },
      };

      const expectedResult = {
        activity_codes: { $in: ["Code1", "Code2"] },
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'tags' field if 'activity_tags' parameter is provided", () => {
      const req = {
        query: {
          activity_tags: "Tag1,Tag2",
        },
      };

      const expectedResult = {
        tags: { $in: ["Tag1", "Tag2"] },
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'device' field if 'device' parameter is provided", () => {
      const req = {
        query: {
          device: "Device Name",
        },
      };

      const expectedResult = {
        device: "Device Name",
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.activities(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("photos", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          device_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          airqloud_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          site_id: "617a8a7c8f7a912abc456def", // Example ObjectId
          device_number: "123",
          device_name: "Device Name",
          network: "Network Name",
          tags: "Tag1,Tag2",
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        device_id: "617a8a7c8f7a912abc456def",
        airqloud_id: "617a8a7c8f7a912abc456def",
        site_id: "617a8a7c8f7a912abc456def",
        device_number: "123",
        device_name: "Device Name",
        network: "Network Name",
        tags: { $in: ["Tag1", "Tag2"] },
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'device_id' field from 'device_id' parameter if 'device_id' parameter is provided", () => {
      const req = {
        query: {
          device_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        device_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'airqloud_id' field from 'airqloud_id' parameter if 'airqloud_id' parameter is provided", () => {
      const req = {
        query: {
          airqloud_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        airqloud_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'site_id' field from 'site_id' parameter if 'site_id' parameter is provided", () => {
      const req = {
        query: {
          site_id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        site_id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'tags' field if 'tags' parameter is provided", () => {
      const req = {
        query: {
          tags: "Tag1,Tag2",
        },
      };

      const expectedResult = {
        tags: { $in: ["Tag1", "Tag2"] },
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'device_number' field if 'device_number' parameter is provided", () => {
      const req = {
        query: {
          device_number: "123",
        },
      };

      const expectedResult = {
        device_number: "123",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'device_name' field if 'device_name' parameter is provided", () => {
      const req = {
        query: {
          device_name: "Device Name",
        },
      };

      const expectedResult = {
        device_name: "Device Name",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'network' field if 'network' parameter is provided", () => {
      const req = {
        query: {
          network: "Network Name",
        },
      };

      const expectedResult = {
        network: "Network Name",
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.photos(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("tips", () => {
    it("should generate the filter object with the given query parameters", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
          pm25: "50",
          pm10: "20",
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
        $and: [
          { "aqi_category.min": { $lte: 50 } },
          { "aqi_category.max": { $gte: 50 } },
        ],
      };

      const result = generateFilter.tips(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.tips(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '$and' field from 'pm25' parameter if 'pm25' parameter is provided", () => {
      const req = {
        query: {
          pm25: "50",
        },
      };

      const expectedResult = {
        $and: [
          { "aqi_category.min": { $lte: 50 } },
          { "aqi_category.max": { $gte: 50 } },
        ],
      };

      const result = generateFilter.tips(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '$and' field from 'pm10' parameter if 'pm10' parameter is provided", () => {
      const req = {
        query: {
          pm10: "20",
        },
      };

      const expectedResult = {
        $and: [
          { "aqi_category.min": { $lte: 20 } },
          { "aqi_category.max": { $gte: 20 } },
        ],
      };

      const result = generateFilter.tips(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with default values if no query parameters provided", () => {
      const req = {
        query: {},
      };

      const result = generateFilter.tips(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("kyalessons", () => {
    it("should generate the filter object with the given query parameters (id and lesson_id)", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {
          lesson_id: "617a8a7c8f7a912abc123xyz", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc123xyz", // lesson_id takes precedence over id
      };

      const result = generateFilter.kyalessons(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided but 'lesson_id' parameter is not provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.kyalessons(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'lesson_id' parameter if 'lesson_id' parameter is provided but 'id' parameter is not provided", () => {
      const req = {
        query: {},
        params: {
          lesson_id: "617a8a7c8f7a912abc123xyz", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc123xyz",
      };

      const result = generateFilter.kyalessons(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate an empty filter object if both 'id' and 'lesson_id' parameters are not provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.kyalessons(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("kyatasks", () => {
    it("should generate the filter object with the given query parameters (id, task_id, and lesson_id)", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {
          task_id: "617a8a7c8f7a912abc123xyz", // Example ObjectId
          lesson_id: "617a8a7c8f7a912abc789abc", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc123xyz", // task_id takes precedence over id
        kya_lesson: "617a8a7c8f7a912abc789abc",
      };

      const result = generateFilter.kyatasks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided but 'task_id' and 'lesson_id' parameters are not provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.kyatasks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'task_id' parameter if 'task_id' parameter is provided but 'id' and 'lesson_id' parameters are not provided", () => {
      const req = {
        query: {},
        params: {
          task_id: "617a8a7c8f7a912abc123xyz", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc123xyz",
      };

      const result = generateFilter.kyatasks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'kya_lesson' field from 'lesson_id' parameter if 'lesson_id' parameter is provided but 'id' and 'task_id' parameters are not provided", () => {
      const req = {
        query: {},
        params: {
          lesson_id: "617a8a7c8f7a912abc789abc", // Example ObjectId
        },
      };

      const expectedResult = {
        kya_lesson: "617a8a7c8f7a912abc789abc",
      };

      const result = generateFilter.kyatasks(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate an empty filter object if none of 'id', 'task_id', and 'lesson_id' parameters are provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.kyatasks(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
  describe("kyaprogress", () => {
    it("should generate the filter object with the given query parameters (id) and route parameters (user_id, lesson_id, and progress_id)", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {
          user_id: "617a8a7c8f7a912abc123xyz", // Example string
          lesson_id: "617a8a7c8f7a912abc789abc", // Example ObjectId
          progress_id: "617a8a7c8f7a912abcxyz123", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abcxyz123", // progress_id takes precedence over id
        user_id: "617a8a7c8f7a912abc123xyz",
        lesson_id: "617a8a7c8f7a912abc789abc",
      };

      const result = generateFilter.kyaprogress(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'id' parameter if 'id' parameter is provided but 'progress_id', 'user_id', and 'lesson_id' parameters are not provided", () => {
      const req = {
        query: {
          id: "617a8a7c8f7a912abc456def", // Example ObjectId
        },
        params: {},
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abc456def",
      };

      const result = generateFilter.kyaprogress(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with '_id' field from 'progress_id' parameter if 'progress_id' parameter is provided but 'id', 'user_id', and 'lesson_id' parameters are not provided", () => {
      const req = {
        query: {},
        params: {
          progress_id: "617a8a7c8f7a912abcxyz123", // Example ObjectId
        },
      };

      const expectedResult = {
        _id: "617a8a7c8f7a912abcxyz123",
      };

      const result = generateFilter.kyaprogress(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate the filter object with 'user_id' and 'lesson_id' fields from 'user_id' and 'lesson_id' parameters respectively if 'user_id' and 'lesson_id' parameters are provided but 'id' and 'progress_id' parameters are not provided", () => {
      const req = {
        query: {},
        params: {
          user_id: "617a8a7c8f7a912abc123xyz", // Example string
          lesson_id: "617a8a7c8f7a912abc789abc", // Example ObjectId
        },
      };

      const expectedResult = {
        user_id: "617a8a7c8f7a912abc123xyz",
        lesson_id: "617a8a7c8f7a912abc789abc",
      };

      const result = generateFilter.kyaprogress(req);

      expect(result).to.deep.equal(expectedResult);
    });

    it("should generate an empty filter object if none of 'id', 'user_id', 'lesson_id', and 'progress_id' parameters are provided", () => {
      const req = {
        query: {},
        params: {},
      };

      const result = generateFilter.kyaprogress(req);

      expect(result).to.deep.equal({});
    });

    // Add more test cases for different scenarios
  });
});
