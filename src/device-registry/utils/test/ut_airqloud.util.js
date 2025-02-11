require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const sinon = require("sinon");
const faker = require("faker");
const geolib = require("geolib");
const { Kafka } = require("kafkajs");
const createAirqloud = require("@utils/create-airqloud");

const expect = chai.expect;
chai.use(chaiHttp);

describe("createAirqloud", () => {
  describe("initialIsCapital", () => {
    it("should return true if the first character of the word is capitalized", () => {
      const result = createAirqloud.initialIsCapital("Word");
      expect(result).to.be.true;
    });

    it("should return false if the first character of the word is not capitalized", () => {
      const result = createAirqloud.initialIsCapital("word");
      expect(result).to.be.false;
    });
  });
  describe("hasNoWhiteSpace", () => {
    it("should return true if the word does not contain any whitespace", () => {
      const result = createAirqloud.hasNoWhiteSpace("word");
      expect(result).to.be.true;
    });

    it("should return false if the word contains whitespace", () => {
      const result = createAirqloud.hasNoWhiteSpace("word with space");
      expect(result).to.be.false;
    });
  });
  describe("retrieveCoordinates", () => {
    it("should return location data if the response from list is successful and data is not empty", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [
          {
            location: {
              /* location data */
            },
          },
        ],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: true,
        data: responseFromListAirQloud.data[0].location,
        message: "retrieved the location",
        status: 200,
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list is successful but data is empty", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve location details",
        status: 404,
        errors: {
          message: "no record exists for this location_id",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list has more than one data", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: true,
        data: [
          {
            /* location data 1 */
          },
          {
            /* location data 2 */
          },
        ],
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve location details",
        status: 500,
        errors: {
          message: "requested for one record but received many",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if the response from list is unsuccessful", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";
      const responseFromListAirQloud = {
        success: false,
        errors: {
          /* error object */
        },
      };

      const entityInstance = {
        list: sinon.stub().resolves(responseFromListAirQloud),
      };

      const expectedResponse = {
        success: false,
        message: "unable to retrieve details from the provided location_id",
        status: 500,
        errors: responseFromListAirQloud.errors,
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });

    it("should return an error message if an error occurs during execution", async () => {
      const request = {
        /* mock request object */
      };
      const entity = "location";

      const entityInstance = {
        list: sinon.stub().throws(new Error("Internal Server Error")),
      };

      const expectedResponse = {
        success: false,
        message: "Internal Server Error",
        status: 500,
        errors: {
          message: "Internal Server Error",
        },
      };

      const result = await createAirqloud.retrieveCoordinates(
        request,
        entityInstance,
        entity
      );
      expect(result).to.deep.equal(expectedResponse);
    });
  });
  describe("create", () => {
    it("should create a new airqloud with modified body and return the response", async () => {
      const request = {
        /* mock request object */
      };
      const body = {
        /* mock request body */
      };
      const query = {
        /* mock request query */
      };
      request.body = body;
      request.query = query;

      const location_id = faker.random.uuid();
      body.location_id = location_id;

      const responseFromRetrieveCoordinates = {
        success: true,
        data: {
          /* location data */
        },
      };

      const responseFromCalculateGeographicalCenter = {
        success: true,
        data: {
          /* center point data */
        },
      };

      const responseFromRegisterAirQloud = {
        success: true,
        data: {
          /* created airqloud data */
        },
      };

      sinon
        .stub(createAirqloud, "retrieveCoordinates")
        .resolves(responseFromRetrieveCoordinates);
      sinon
        .stub(createAirqloud, "calculateGeographicalCenter")
        .resolves(responseFromCalculateGeographicalCenter);
      sinon.stub(createAirqloud, "getModelByTenant").resolves({
        register: sinon.stub().resolves(responseFromRegisterAirQloud),
      });

      const kafkaProducerStub = {
        connect: sinon.stub().resolves(),
        send: sinon.stub().resolves(),
        disconnect: sinon.stub().resolves(),
      };

      const kafkaStub = {
        producer: sinon.stub().returns(kafkaProducerStub),
      };

      sinon.stub(createAirqloud, "Kafka").returns(kafkaStub);

      const expectedResponse = responseFromRegisterAirQloud;

      const result = await createAirqloud.create(request);
      expect(result).to.deep.equal(expectedResponse);

      createAirqloud.retrieveCoordinates.restore();
      createAirqloud.calculateGeographicalCenter.restore();
      createAirqloud.getModelByTenant.restore();
      createAirqloud.Kafka.restore();
    });
  });
  describe("update", () => {
    it("should update an AirQloud and return the update result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        body: {
          // Provide the update object with the desired changes
          // Example: { name: "New AirQloud Name", location: "New Location", ... }
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeUpdateResponse = {
        success: true,
        data: {
          /* Sample updated AirQloud data */
        },
      };

      // Stub the required functions to return the fake responses
      const modifyStub = sinon.stub().resolves(fakeUpdateResponse);

      // Stub the getModelByTenant function to return fake model methods
      const getModelByTenantStub = sinon.stub();
      getModelByTenantStub
        .withArgs("example_tenant", "airqloud")
        .returns({ modify: modifyStub });

      // Replace the real functions with the stubs in the createAirqloud module
      createAirqloud.getModelByTenant = getModelByTenantStub;

      // Call the update function with the fake request
      const result = await createAirqloud.update(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(modifyStub.calledWithExactly(sinon.match.any, sinon.match.any)).to
        .be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("delete", () => {
    it("should delete an AirQloud and return the delete result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          // Add other required properties for the query object as needed
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeRemoveResponse = {
        success: true,
        data: {
          /* Sample delete result data */
        },
      };

      // Stub the required functions to return the fake responses
      const removeStub = sinon.stub().resolves(fakeRemoveResponse);

      // Stub the getModelByTenant function to return fake model methods
      const getModelByTenantStub = sinon.stub();
      getModelByTenantStub
        .withArgs("example_tenant", "airqloud")
        .returns({ remove: removeStub });

      // Replace the real functions with the stubs in the createAirqloud module
      createAirqloud.getModelByTenant = getModelByTenantStub;

      // Call the delete function with the fake request
      const result = await createAirqloud.delete(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(removeStub.calledWithExactly(sinon.match.any)).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("refresh", () => {
    it("should refresh an AirQloud and return the refresh result for a valid request", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          id: "example_id",
          name: "example_name",
          admin_level: "example_admin_level",
          // Add other required properties for the query object as needed
        },
        // Add properties for the request object as needed
      };

      // Sample fake responses from the database
      const fakeRetrieveCoordinatesResponse = {
        success: true,
        data: {
          coordinates: [
            /* Sample coordinates data */
          ],
        },
      };

      const fakeFindSitesResponse = {
        success: true,
        data: [
          /* Sample sites data */
        ],
      };

      const fakeCalculateGeographicalCenterResponse = {
        success: true,
        data: {
          /* Sample center_point data */
        },
      };

      const fakeUpdateResponse = {
        success: true,
        data: {
          /* Sample update result data */
        },
      };

      // Stub the required functions to return the fake responses
      const retrieveCoordinatesStub = sinon
        .stub()
        .resolves(fakeRetrieveCoordinatesResponse);
      const findSitesStub = sinon.stub().resolves(fakeFindSitesResponse);
      const calculateGeographicalCenterStub = sinon
        .stub()
        .resolves(fakeCalculateGeographicalCenterResponse);
      const updateStub = sinon.stub().resolves(fakeUpdateResponse);

      // Stub the required functions in createAirqloud module to return fake model methods
      createAirqloud.retrieveCoordinates = retrieveCoordinatesStub;
      createAirqloud.findSites = findSitesStub;
      createAirqloud.calculateGeographicalCenter = calculateGeographicalCenterStub;
      createAirqloud.update = updateStub;

      // Call the refresh function with the fake request
      const result = await createAirqloud.refresh(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.exist;

      // Check if the stubbed functions were called with the correct arguments
      expect(
        retrieveCoordinatesStub.calledWithExactly(sinon.match.any, "airqloud")
      ).to.be.true;
      expect(findSitesStub.calledWithExactly(sinon.match.any)).to.be.true;
      expect(calculateGeographicalCenterStub.calledWithExactly(sinon.match.any))
        .to.be.true;
      expect(updateStub.calledWithExactly(sinon.match.any)).to.be.true;
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("calculateGeographicalCenter", () => {
    it("should calculate the geographical center and return the center point for a valid request with coordinates", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          id: "example_id",
          // Add other required properties for the query object as needed
        },
        body: {
          coordinates: [
            /* Sample coordinates data */
          ],
        },
        // Add properties for the request object as needed
      };

      // Stub the geolib.getCenter function to return a fake center point
      const fakeCenterPoint = {
        latitude: 12 /* Sample latitude */,
        longitude: 23423 /* Sample longitude */,
      };
      const getCenterStub = sinon
        .stub(geolib, "getCenter")
        .returns(fakeCenterPoint);

      // Call the calculateGeographicalCenter function with the fake request
      const result = await createAirqloud.calculateGeographicalCenter(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.data).to.exist;
      expect(result.data).to.deep.equal(fakeCenterPoint);

      // Check if the geolib.getCenter function was called with the correct arguments
      expect(getCenterStub.calledWithExactly(request.body.coordinates)).to.be
        .true;

      // Restore the stub to its original implementation after the test
      getCenterStub.restore();
    });

    it("should calculate the geographical center and return the center point for a valid request with an ID", async () => {
      // ... Implement the test for the case when an ID is provided in the request
    });

    it("should handle the case when the provided ID does not exist and return an error response", async () => {
      // ... Implement the test for the case when the provided ID does not exist
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("findSites", () => {
    it("should find associated sites and return an array of site IDs within the airqloud", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          id: "example_id",
          tenant: "example_tenant",
          name: "example_name",
          admin_level: "example_admin_level",
          // Add other required properties for the query object as needed
        },
        body: {
          /* Sample request body */
        },
        // Add properties for the request object as needed
      };

      // Stub the getModelByTenant.list function to return a fake list of sites
      const fakeSiteList = [
        {
          _id: "site_id_1",
          latitude: 12 /* Sample latitude */,
          longitude: 121 /* Sample longitude */,
          description: "Site 1",
        },
        {
          _id: "site_id_2",
          latitude: 12 /* Sample latitude */,
          longitude: 24 /* Sample longitude */,
          description: "Site 2",
        },
        // Add more sample sites as needed
      ];
      const listStub = sinon
        .stub(getModelByTenant, "list")
        .resolves({ success: true, data: fakeSiteList });

      // Stub the geolib.isPointInPolygon function to return a fake result
      const isPointInPolygonStub = sinon
        .stub(geolib, "isPointInPolygon")
        .returns(true);

      // Call the findSites function with the fake request
      const result = await createAirqloud.findSites(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        "successfully searched for the associated Sites"
      );
      expect(result.data)
        .to.be.an("array")
        .that.includes("site_id_1", "site_id_2");
      expect(result.status).to.equal(httpStatus.OK);

      // Check if the getModelByTenant.list function was called with the correct arguments
      expect(
        listStub.calledWithExactly({
          filter: {},
        })
      ).to.be.true;

      // Check if the geolib.isPointInPolygon function was called with the correct arguments
      const airqloudPolygon = {}; /* Compute the airqloudPolygon based on the input data */
      for (const site of fakeSiteList) {
        expect(
          isPointInPolygonStub.calledWithExactly(
            { latitude: site.latitude, longitude: site.longitude },
            airqloudPolygon
          )
        ).to.be.true;
      }

      // Restore the stubs to their original implementations after the test
      listStub.restore();
      isPointInPolygonStub.restore();
    });

    it("should handle the case when no associated sites are found within the airqloud and return an empty array", async () => {
      // ... Implement the test for the case when no associated sites are found
    });

    it("should handle the case when there is a missing GPS coordinate for a site and log an error", async () => {
      // ... Implement the test for the case when a site has a missing GPS coordinate
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("list", () => {
    it("should list airqlouds based on the provided filter, limit, and skip values", async () => {
      // Create a fake request object for testing
      const request = {
        query: {
          tenant: "example_tenant",
          skip: 10,
          // Add other required properties for the query object as needed
        },
        body: {
          /* Sample request body */
        },
        // Add properties for the request object as needed
      };

      // Stub the getModelByTenant.list function to return a fake list of airqlouds
      const fakeAirqloudList = [
        {
          _id: "airqloud_id_1",
          name: "AirQloud 1",
          // Add other properties of the airqloud object as needed
        },
        {
          _id: "airqloud_id_2",
          name: "AirQloud 2",
          // Add other properties of the airqloud object as needed
        },
        // Add more sample airqlouds as needed
      ];
      const listStub = sinon
        .stub(getModelByTenant, "list")
        .resolves({ success: true, data: fakeAirqloudList });

      // Call the list function with the fake request
      const result = await createAirqloud.list(request);

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal("Successfully listed airqlouds");
      expect(result.data)
        .to.be.an("array")
        .that.includes("airqloud_id_1", "airqloud_id_2");
      expect(result.status).to.equal(httpStatus.OK);

      // Check if the getModelByTenant.list function was called with the correct arguments
      expect(
        listStub.calledWithExactly({
          filter: {} /* Compute the expected filter based on the input data */,
          limit: 1000,
          skip: 10,
        })
      ).to.be.true;

      // Restore the stub to its original implementation after the test
      listStub.restore();
    });

    it("should handle internal server error and return an error response", async () => {
      // ... Implement the test for the case when an internal server error occurs
    });

    // Add more test cases as needed to cover different scenarios
  });
  describe("listCohortsAndGrids()", () => {
    it("should return success and data for valid groupId", async () => {
      const request = {
        params: { group_id: "validGroupId" },
        query: { tenant: "validTenant", category: "summary" },
      };

      // Stub isValidGroupId to return true
      const isValidGroupIdStub = sinon.stub().resolves(true);

      // Stub getDocumentsByGroupId to return data
      const getDocumentsByGroupIdStub = sinon.stub().resolves({
        cohorts: [{ name: "Cohort 1" }],
        grids: [{ name: "Grid 1" }],
      });

      const response = await createAirqloud.listCohortsAndGrids(
        request,
        isValidGroupIdStub,
        getDocumentsByGroupIdStub
      );

      expect(response.success).to.be.true;
      expect(response.status).to.equal(httpStatus.OK);
      expect(response.data.cohorts).to.have.lengthOf(1);
      expect(response.data.grids).to.have.lengthOf(1);

      sinon.assert.calledOnceWithExactly(
        isValidGroupIdStub,
        "validTenant",
        "validGroupId"
      );
      sinon.assert.calledOnceWithExactly(
        getDocumentsByGroupIdStub,
        "validTenant",
        "validGroupId",
        "summary"
      );
    });

    it("should return error for invalid groupId", async () => {
      const request = {
        params: { group_id: "invalidGroupId" },
        query: { tenant: "validTenant", category: "summary" },
      };

      // Stub isValidGroupId to return false
      const isValidGroupIdStub = sinon.stub().resolves(false);

      const response = await createAirqloud.listCohortsAndGrids(
        request,
        isValidGroupIdStub
      );

      expect(response.success).to.be.false;
      expect(response.status).to.equal(httpStatus.BAD_REQUEST);
      expect(response.errors.message).to.include("Invalid groupId");

      sinon.assert.calledOnceWithExactly(
        isValidGroupIdStub,
        "validTenant",
        "invalidGroupId"
      );
    });

    // Add similar test cases for networkId, bad request, and internal server error scenarios
  });
});
