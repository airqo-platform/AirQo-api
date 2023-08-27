require("module-alias/register");
const commonUtil = require("@utils/common");
const { expect } = require("chai");
const sinon = require("sinon");
const chai = require("chai");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);
const httpStatus = require("http-status");

const CohortModel = require("@models/Cohort");
const GridModel = require("@models/Grid");

describe("commonUtil", () => {
  describe("getSitesFromAirQloud", () => {
    it("should return the associated sites for a valid AirQloud ID", async () => {
      const mockResponse = {
        success: true,
        message: "Successfully retrieved the sites for this AirQloud",
        data: ["siteId1", "siteId2"],
        status: httpStatus.OK,
      };
      const airqloudsModel = {
        list: sinon.stub().resolves(mockResponse),
      };

      const result = await commonUtil.getSitesFromAirQloud({
        tenant: "airqo",
        airqloudId: "airqloudId1",
      });

      expect(result).to.deep.equal(mockResponse);
      expect(airqloudsModel.list.calledWith({ filter: { _id: "airqloudId1" } }))
        .to.be.true;
    });

    it("should return no sites for an invalid AirQloud ID", async () => {
      const mockResponse = {
        success: true,
        message: "No distinct AirQloud found in this search",
        data: [],
        status: httpStatus.OK,
      };
      const airqloudsModel = {
        list: sinon.stub().resolves(mockResponse),
      };

      const result = await commonUtil.getSitesFromAirQloud({
        tenant: "airqo",
        airqloudId: "invalid_airqloud_id",
      });

      expect(result).to.deep.equal(mockResponse);
      expect(
        airqloudsModel.list.calledWith({
          filter: { _id: "invalid_airqloud_id" },
        })
      ).to.be.true;
    });

    // Add more test cases to cover different scenarios
  });
  describe("getSitesFromLatitudeAndLongitude", () => {
    it("should return the nearest sites for valid latitude and longitude", async () => {
      const mockResponse = {
        success: true,
        message: "Successfully retrieved the nearest sites",
        data: ["siteId1", "siteId2"],
        status: httpStatus.OK,
      };
      const sitesModel = {
        list: sinon
          .stub()
          .resolves({ success: true, data: ["site1", "site2"] }),
      };
      sinon
        .stub(commonUtil, "getSitesFromLatitudeAndLongitude")
        .callsFake(() => [
          { _id: "siteId1", latitude: 1, longitude: 2 },
          { _id: "siteId2", latitude: 3, longitude: 4 },
        ]);

      const result = await commonUtil.getSitesFromLatitudeAndLongitude({
        tenant: "airqo",
        latitude: 1,
        longitude: 2,
        radius: 10,
      });

      expect(result).to.deep.equal(mockResponse);
      expect(sitesModel.list.calledOnce).to.be.true;
    });

    it("should return no sites for invalid latitude and longitude", async () => {
      const mockResponse = {
        success: true,
        message: "Successfully retrieved the nearest sites",
        data: [],
        status: httpStatus.OK,
      };
      const sitesModel = {
        list: sinon
          .stub()
          .resolves({ success: true, data: ["site1", "site2"] }),
      };
      sinon
        .stub(commonUtil, "getSitesFromLatitudeAndLongitude")
        .callsFake(() => []);

      const result = await commonUtil.getSitesFromLatitudeAndLongitude({
        tenant: "airqo",
        latitude: 1,
        longitude: 2,
        radius: 10,
      });

      expect(result).to.deep.equal(mockResponse);
      expect(sitesModel.list.calledOnce).to.be.true;
    });

    // Add more test cases to cover different scenarios
  });
  describe("listDevices", () => {
    it("should return the list of devices", async () => {
      const mockResponse = {
        success: true,
        data: ["device1", "device2"],
        status: httpStatus.OK,
      };
      const devicesModel = {
        list: sinon.stub().resolves(mockResponse),
      };

      const result = await commonUtil.listDevices({
        tenant: "airqo",
        filter: { isActive: true },
        skip: 0,
        limit: 10,
      });

      expect(result).to.deep.equal(mockResponse);
      expect(
        devicesModel.list.calledWith({
          filter: { isActive: true },
          limit: 10,
          skip: 0,
        })
      ).to.be.true;
    });

    // Add more test cases to cover different scenarios
  });
  describe("getDevicesCount", () => {
    it("should return the number of devices", async () => {
      const callback = sinon.stub();
      const devicesModel = {
        countDocuments: sinon.stub().yields(null, 5),
      };

      await commonUtil.getDevicesCount({ tenant: "airqo", callback });

      expect(
        callback.calledWith({
          success: true,
          message: "retrieved the number of devices",
          status: httpStatus.OK,
          data: 5,
        })
      ).to.be.true;
    });
    // Add more test cases to cover different scenarios
  });
  describe("decryptKey", () => {
    it("should successfully decrypt the key and return the original text", async () => {
      const encryptedKey = "encrypted-key";
      const decryptedText = "decrypted-text";
      const bytesStub = sinon
        .stub()
        .returns({ toString: sinon.stub().returns(decryptedText) });
      const decryptStub = sinon
        .stub(commonUtil.cryptoJS.AES, "decrypt")
        .returns({ bytes });

      const result = await commonUtil.decryptKey({ encryptedKey });

      expect(result.success).to.be.true;
      expect(result.message).to.equal("successfully decrypted the text");
      expect(result.data).to.equal(decryptedText);
      expect(result.status).to.equal(httpStatus.OK);

      decryptStub.restore();
    });

    it("should return an error message if the provided encrypted key is not recognizable", async () => {
      const encryptedKey = "invalid-encrypted-key";
      const bytesStub = sinon
        .stub()
        .returns({ toString: sinon.stub().returns("") });
      const decryptStub = sinon
        .stub(commonUtil.cryptoJS.AES, "decrypt")
        .returns({ bytes });

      const result = await commonUtil.decryptKey({ encryptedKey });

      expect(result.success).to.be.false;
      expect(result.message).to.equal(
        "the provided encrypted key is not recognizable"
      );
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);

      decryptStub.restore();
    });

    it("should return an error if an internal server error occurs during decryption", async () => {
      const encryptedKey = "encrypted-key";
      const errorMessage = "decryption error";
      const decryptStub = sinon
        .stub(commonUtil.cryptoJS.AES, "decrypt")
        .throws(new Error(errorMessage));

      const result = await commonUtil.decryptKey({ encryptedKey });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(errorMessage);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);

      decryptStub.restore();
    });
  });
  describe("generateGeoHashFromCoordinates", () => {
    it("should generate a GeoHash for a MultiPolygon shape", () => {
      const shape = {
        type: "MultiPolygon",
        coordinates: [
          [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]],
          [[[30, 30], [40, 30], [40, 40], [30, 40], [30, 30]]],
        ],
      };

      const centerPoint = { latitude: 15, longitude: 15 };
      const geoHash = "abc123";

      // Stub the required functions
      const getCenterStub = sinon
        .stub(geolib, "getCenter")
        .returns(centerPoint);
      const encodeStub = sinon.stub(geohash, "encode").returns(geoHash);

      const result = commonUtil.generateGeoHashFromCoordinates(shape);

      // Restore the stubs
      getCenterStub.restore();
      encodeStub.restore();

      // Assertions
      expect(result).to.equal(geoHash);
    });

    it("should generate a GeoHash for a Polygon shape", () => {
      const shape = {
        type: "Polygon",
        coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]],
      };

      const centerPoint = { latitude: 15, longitude: 15 };
      const geoHash = "xyz789";

      // Stub the required functions
      const getCenterStub = sinon
        .stub(geolib, "getCenter")
        .returns(centerPoint);
      const encodeStub = sinon.stub(geohash, "encode").returns(geoHash);

      const result = commonUtil.generateGeoHashFromCoordinates(shape);

      // Restore the stubs
      getCenterStub.restore();
      encodeStub.restore();

      // Assertions
      expect(result).to.equal(geoHash);
    });

    it("should return an error if an exception occurs", () => {
      const shape = {
        type: "InvalidType",
        coordinates: [[[10, 10], [20, 10], [20, 20], [10, 20], [10, 10]]],
      };

      const errorMessage = "Invalid shape type";
      const logErrorStub = sinon.stub(logger, "error");
      const result = commonUtil.generateGeoHashFromCoordinates(shape);

      // Restore the stub
      logErrorStub.restore();

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(errorMessage);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("getDocumentsByNetworkId", () => {
    it("should fetch documents with correct exclusion projection for summary category", async () => {
      const tenantId = "yourTenantId";
      const network = "yourNetwork";
      const category = "summary";

      // Stub your models and aggregation results here
      const CohortModel = {
        aggregate: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([]), // Mock the result
      };
      const GridModel = {
        aggregate: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves([]), // Mock the result
      };

      // Call the function
      const result = await commonUtil.getDocumentsByNetworkId(
        tenantId,
        network,
        category
      );

      // Assertions or expectations here
      expect(result).to.have.property("cohorts");
      expect(result).to.have.property("grids");
      expect(CohortModel.aggregate.calledOnce).to.be.true;
      expect(GridModel.aggregate.calledOnce).to.be.true;
      // Add more assertions as needed
    });

    it("should fetch documents with correct exclusion projection for dashboard category", async () => {
      // Similar structure to the first test, but with different category
    });

    it("should handle errors and return error response", async () => {
      // Stub models to throw an error
      const CohortModel = {
        aggregate: sinon.stub().throws(new Error("Mocked error")),
      };
      const GridModel = {
        aggregate: sinon.stub().throws(new Error("Mocked error")),
      };

      // Call the function
      const result = await commonUtil.getDocumentsByNetworkId(
        "tenantId",
        "network",
        "summary"
      );

      // Assertions for error response
      expect(result).to.have.property("success", false);
      expect(result).to.have.property(
        "status",
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(result).to.have.nested.property("errors.message", "Mocked error");
    });
  });

  // Add test cases for other functions in the commonUtil object
});
