require("module-alias/register");
const sinon = require("sinon");
const chai = require("chai");
const expect = chai.expect;
const moment = require("moment-timezone");
const log4js = require("log4js");
const {
  fetchAndStoreDataIntoReadingsModel,
  processDocument,
  updateEntityStatus,
  fetchAllData,
} = require("@bin/jobs/v3-store-readings-job");
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");

describe("Fetch and Store Readings Model", () => {
  let loggerStub;

  beforeEach(() => {
    loggerStub = sinon.stub(log4js.getLogger(), "warn");
    sinon.stub(log4js.getLogger(), "error");
    sinon.stub(log4js.getLogger(), "info");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("fetchAndStoreDataIntoReadingsModel", () => {
    it("should fetch events and process them", async () => {
      const mockEvents = [
        { device_id: "device1", site_id: "site1", time: new Date() },
        { device_id: "device2", site_id: "site2", time: new Date() },
      ];

      const fetchStub = sinon.stub(EventModel, "fetch").returns(
        Promise.resolve({
          success: true,
          data: [{ data: mockEvents }],
        })
      );

      const fetchAllDataStub = sinon
        .stub()
        .returns(Promise.resolve(mockEvents));
      sinon.replace(global, "fetchAllData", fetchAllDataStub);

      const processDocumentStub = sinon.stub().returns(Promise.resolve());
      sinon.replace(global, "processDocument", processDocumentStub);

      await fetchAndStoreDataIntoReadingsModel();

      expect(fetchStub.calledOnce).to.be.true;
      expect(processDocumentStub.callCount).to.equal(mockEvents.length);
    });

    it("should log a warning if no events are found", async () => {
      const fetchStub = sinon.stub(EventModel, "fetch").returns(
        Promise.resolve({
          success: true,
          data: [{ data: [] }],
        })
      );

      await fetchAndStoreDataIntoReadingsModel();

      expect(loggerStub.calledWith(sinon.match(/No Events found/))).to.be.true;
    });

    it("should handle errors during processing", async () => {
      const mockEvents = [
        { device_id: "device1", site_id: "site1", time: new Date() },
      ];

      const fetchStub = sinon.stub(EventModel, "fetch").returns(
        Promise.resolve({
          success: true,
          data: [{ data: mockEvents }],
        })
      );

      const processDocumentStub = sinon
        .stub()
        .throws(new Error("Processing error"));
      sinon.replace(global, "processDocument", processDocumentStub);

      await fetchAndStoreDataIntoReadingsModel();

      expect(loggerStub.calledWith(sinon.match(/Error processing document/))).to
        .be.true;
    });
  });

  describe("processDocument", () => {
    it("should update entity status and reading document correctly", async () => {
      const mockDoc = {
        device_id: "device1",
        site_id: "site1",
        time: new Date(),
      };

      const findOneStubDevice = sinon
        .stub(DeviceModel, "findOne")
        .returns(Promise.resolve({ lastActive: new Date() }));
      const findOneStubSite = sinon
        .stub(SiteModel, "findOne")
        .returns(Promise.resolve({ lastActive: new Date() }));

      const updateOneDeviceStub = sinon
        .stub(DeviceModel, "updateOne")
        .returns(Promise.resolve());
      const updateOneSiteStub = sinon
        .stub(SiteModel, "updateOne")
        .returns(Promise.resolve());

      await processDocument(mockDoc);

      expect(findOneStubDevice.calledOnce).to.be.true;
      expect(findOneStubSite.calledOnce).to.be.true;
      expect(updateOneDeviceStub.calledOnce).to.be.true;
      expect(updateOneSiteStub.calledOnce).to.be.true;

      // Check if ReadingModel.updateOne is called with correct parameters
      expect(ReadingModel.updateOne.calledOnce).to.be.true;
    });

    it("should log details for missing device or site IDs", async () => {
      const mockDoc = { time: new Date() }; // No device_id or site_id

      await processDocument(mockDoc);

      expect(
        loggerStub.calledWith(
          sinon.match(/Measurement missing some key details/)
        )
      ).to.be.true;
    });
  });

  describe("updateEntityStatus", () => {
    it("should update the entity status correctly when found", async () => {
      const mockEntity = { lastActive: new Date() };

      const findOneStub = sinon
        .stub(DeviceModel, "findOne")
        .returns(Promise.resolve(mockEntity));

      const updateOneStub = sinon
        .stub(DeviceModel, "updateOne")
        .returns(Promise.resolve());

      await updateEntityStatus(
        DeviceModel,
        { _id: "device1" },
        new Date(),
        "Device"
      );

      expect(findOneStub.calledOnce).to.be.true;
      expect(updateOneStub.calledOnce).to.be.true;
    });

    it("should log a warning if entity is not found", async () => {
      const findOneStub = sinon
        .stub(DeviceModel, "findOne")
        .returns(Promise.resolve(null));

      await updateEntityStatus(
        DeviceModel,
        { _id: "device1" },
        new Date(),
        "Device"
      );

      expect(loggerStub.calledWith(sinon.match(/not found with filter/))).to.be
        .true;
    });

    it("should handle errors during update gracefully", async () => {
      const findOneStub = sinon
        .stub(DeviceModel, "findOne")
        .returns(Promise.reject(new Error("Database error")));

      await updateEntityStatus(
        DeviceModel,
        { _id: "device1" },
        new Date(),
        "Device"
      );

      expect(
        loggerStub.calledWith(sinon.match(/Error updating Device's status/))
      ).to.be.true;
    });
  });

  describe("fetchAllData", () => {
    it("should return all data from the model with pagination", async () => {
      const mockEntities = [{ _id: "entity1" }, { _id: "entity2" }];
      const fetchEntitiesStub = sinon.stub(DeviceModel, "find").returns({
        limit: () => ({
          skip: () => Promise.resolve(mockEntities),
        }),
      });

      const result = await fetchAllData(DeviceModel);

      expect(fetchEntitiesStub.called).to.be.true;
      expect(result).to.deep.equal(mockEntities);
    });

    it("should handle errors during fetching data gracefully", async () => {
      const fetchEntitiesStub = sinon
        .stub(DeviceModel, "find")
        .throws(new Error("Fetch error"));

      await fetchAllData(DeviceModel);

      expect(loggerStub.calledWith(sinon.match(/Internal Server Error/))).to.be
        .true;
    });
  });
});
