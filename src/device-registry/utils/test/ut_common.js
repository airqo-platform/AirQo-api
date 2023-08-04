require("module-alias/register");
const commonUtil = require("@utils/common");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");

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
    it("should return cohorts and grids for a valid networkId", async () => {
      const tenantId = "airqo";
      const networkId = "validNetworkId";
      const category = undefined;

      // Mock data for cohorts and grids
      const cohortsData = [{ name: "Cohort 1", description: "Description 1" }];
      const gridsData = [
        { name: "Grid 1", shape: { type: "Polygon", coordinates: [] } },
      ];

      // Stub the CohortModel and GridModel functions
      const cohortFindStub = sinon.stub(CohortModel(tenantId), "find").returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(cohortsData),
      });

      const gridFindStub = sinon.stub(GridModel(tenantId), "find").returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(gridsData),
      });

      const result = await commonUtil.getDocumentsByNetworkId(
        tenantId,
        networkId,
        category
      );

      // Restore the stubs
      cohortFindStub.restore();
      gridFindStub.restore();

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        `Successfully returned the AirQlouds for network ${networkId}`
      );
      expect(result.data.cohorts).to.deep.equal(cohortsData);
      expect(result.data.grids).to.deep.equal(gridsData);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return summaries of cohorts and grids for a valid networkId and category 'summary'", async () => {
      const tenantId = "airqo";
      const networkId = "validNetworkId";
      const category = "summary";

      // Mock data for cohorts and grids summaries
      const cohortsData = [{ name: "Cohort 1", description: "Description 1" }];
      const gridsData = [{ name: "Grid 1", shape: { type: "Polygon" } }];

      // Stub the CohortModel and GridModel functions
      const cohortFindStub = sinon.stub(CohortModel(tenantId), "find").returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(cohortsData),
      });

      const gridFindStub = sinon.stub(GridModel(tenantId), "find").returns({
        select: sinon.stub().returnsThis(),
        exec: sinon.stub().resolves(gridsData),
      });

      const result = await commonUtil.getDocumentsByNetworkId(
        tenantId,
        networkId,
        category
      );

      // Restore the stubs
      cohortFindStub.restore();
      gridFindStub.restore();

      // Assertions
      expect(result.success).to.be.true;
      expect(result.message).to.equal(
        `Successfully returned the AirQlouds for network ${networkId}`
      );
      expect(result.data.cohorts).to.deep.equal([
        { name: "Cohort 1", description: "Description 1" },
      ]);
      expect(result.data.grids).to.deep.equal([
        { name: "Grid 1", shape: { type: "Polygon" } },
      ]);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return an error for an invalid networkId", async () => {
      const tenantId = "airqo";
      const networkId = "invalidNetworkId";
      const category = undefined;

      // Stub the CohortModel and GridModel functions to simulate an error
      const cohortFindStub = sinon
        .stub(CohortModel(tenantId), "find")
        .returns({ select: sinon.stub().returnsThis(), exec: sinon.stub() });

      const gridFindStub = sinon
        .stub(GridModel(tenantId), "find")
        .returns({ select: sinon.stub().returnsThis(), exec: sinon.stub() });

      const errorMessage = "Network not found";
      const logErrorStub = sinon.stub(logger, "error");

      const result = await commonUtil.getDocumentsByNetworkId(
        tenantId,
        networkId,
        category
      );

      // Restore the stubs
      cohortFindStub.restore();
      gridFindStub.restore();
      logErrorStub.restore();

      // Assertions
      expect(result.success).to.be.false;
      expect(result.message).to.equal("Internal Server Error");
      expect(result.errors.message).to.equal(errorMessage);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  // Add test cases for other functions in the commonUtil object
});
