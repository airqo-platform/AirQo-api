require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chaiAsPromised = require("chai-as-promised");
const moment = require("moment-timezone");
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const { generateFilter } = require("@utils/common");
const {
  fetchAndStoreDataIntoReadingsModel,
  isEntityActive,
  updateEntityStatus,
  processDocument,
} = require("@bin/jobs/v2-store-readings-job");

chai.use(sinonChai);
chai.use(chaiAsPromised);
const expect = chai.expect;

describe("new-store-readings-job", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("isEntityActive", () => {
    it("should return false if entity or lastActive is missing", () => {
      expect(isEntityActive(null, new Date())).to.be.false;
      expect(isEntityActive({}, new Date())).to.be.false;
    });

    it("should return true if entity is active", () => {
      const entity = { lastActive: new Date() };
      const time = new Date();
      sandbox.stub(moment, "tz").returns({ toDate: () => time });
      expect(isEntityActive(entity, time)).to.be.true;
    });

    it("should return false if entity is inactive", () => {
      const entity = { lastActive: new Date(Date.now() - 6 * 60 * 60 * 1000) };
      const time = new Date();
      sandbox.stub(moment, "tz").returns({ toDate: () => time });
      expect(isEntityActive(entity, time)).to.be.false;
    });
  });

  describe("updateEntityStatus", () => {
    it("should update entity status if entity exists", async () => {
      const mockModel = {
        findOne: sinon.stub().resolves({ _id: "123", lastActive: new Date() }),
        updateOne: sinon.stub().resolves({ nModified: 1 }),
      };
      const filter = { _id: "123" };
      const time = new Date();

      await updateEntityStatus(mockModel, filter, time, "TestEntity");

      expect(mockModel.findOne).to.have.been.calledWith(filter);
      expect(mockModel.updateOne).to.have.been.called;
    });

    it("should log a warning if entity is not found", async () => {
      const mockModel = {
        findOne: sinon.stub().resolves(null),
      };
      const filter = { _id: "123" };
      const time = new Date();
      const loggerWarnStub = sinon.stub(console, "warn");

      await updateEntityStatus(mockModel, filter, time, "TestEntity");

      expect(mockModel.findOne).to.have.been.calledWith(filter);
      expect(loggerWarnStub).to.have.been.called;
      loggerWarnStub.restore();
    });
  });

  describe("processDocument", () => {
    it("should process document with both site_id and device_id", async () => {
      const doc = {
        site_id: "123",
        device_id: "456",
        time: new Date(),
      };

      const siteUpdateStub = sinon.stub().resolves({});
      const deviceUpdateStub = sinon.stub().resolves({});
      const readingUpdateStub = sinon.stub().resolves({});

      sandbox.stub(SiteModel, "airqo").returns({ updateOne: siteUpdateStub });
      sandbox
        .stub(DeviceModel, "airqo")
        .returns({ updateOne: deviceUpdateStub });
      sandbox
        .stub(ReadingModel, "airqo")
        .returns({ updateOne: readingUpdateStub });

      await processDocument(doc);

      expect(siteUpdateStub).to.have.been.called;
      expect(deviceUpdateStub).to.have.been.called;
      expect(readingUpdateStub).to.have.been.called;
    });

    it("should handle missing site_id or device_id", async () => {
      const doc = {
        time: new Date(),
      };

      const readingUpdateStub = sinon.stub().resolves({});
      sandbox
        .stub(ReadingModel, "airqo")
        .returns({ updateOne: readingUpdateStub });
      const loggerWarnStub = sinon.stub(console, "warn");

      await processDocument(doc);

      expect(readingUpdateStub).to.have.been.called;
      expect(loggerWarnStub).to.have.been.calledTwice;
      loggerWarnStub.restore();
    });
  });

  describe("fetchAndStoreDataIntoReadingsModel", () => {
    it("should fetch and store data successfully", async () => {
      const mockData = [
        { data: [{ site_id: "123", device_id: "456", time: new Date() }] },
      ];

      // Stubs for Event and Device Models
      const fetchStub = sinon
        .stub()
        .resolves({ success: true, data: mockData });

      sandbox.stub(EventModel, "airqo").returns({ fetch: fetchStub });

      // Stubbing Device Model for offline updates
      const deviceUpdateManyStub = sinon.stub().resolves({});

      sandbox
        .stub(DeviceModel, "airqo")
        .returns({ updateMany: deviceUpdateManyStub });

      // Stubbing generateFilter
      sandbox.stub(generateFilter, "fetch").returns({});

      await fetchAndStoreDataIntoReadingsModel();

      expect(fetchStub).to.have.been.called;
      expect(deviceUpdateManyStub).to.have.been.calledWith(
        { _id: { $nin: ["456"] } }, // Assuming '456' is the only active device ID
        { isOnline: false }
      );
      // Add more specific expectations based on the function's behavior
    });

    it("should handle errors during data fetching", async () => {
      const fetchStub = sinon.stub().rejects(new Error("Fetch error"));
      sandbox.stub(EventModel, "airqo").returns({ fetch: fetchStub });
      sandbox.stub(generateFilter, "fetch").returns({});
      const loggerErrorStub = sinon.stub(console, "error");

      await fetchAndStoreDataIntoReadingsModel();

      expect(fetchStub).to.have.been.called;
      expect(loggerErrorStub).to.have.been.called;
      loggerErrorStub.restore();
    });

    it("should handle empty data response", async () => {
      const fetchStub = sinon.stub().resolves({ success: true, data: [] });
      sandbox.stub(EventModel, "airqo").returns({ fetch: fetchStub });
      sandbox.stub(generateFilter, "fetch").returns({});
      const logTextStub = sinon.stub(console, "log");

      await fetchAndStoreDataIntoReadingsModel();

      expect(fetchStub).to.have.been.called;
      expect(logTextStub).to.have.been.calledWith(
        "No data found in the response"
      );
      logTextStub.restore();
    });

    it("should mark devices as offline if not in fetched measurements and lastActive is older than threshold", async () => {
      // Mock data with one active device ID and its lastActive time
      const mockData = [
        { data: [{ site_id: "123", device_id: "456", time: new Date() }] },
      ];

      // Setting up a device that should be marked offline
      const inactiveDeviceId = "789";
      const inactiveDeviceLastActive = moment()
        .subtract(INACTIVE_THRESHOLD + 1000, "milliseconds") // Older than threshold
        .toDate();

      // Stubbing DeviceModel to return an inactive device
      const findStub = sinon.stub(DeviceModel, "airqo").returns({
        find: sinon
          .stub()
          .resolves([
            { _id: inactiveDeviceId, lastActive: inactiveDeviceLastActive },
          ]),
      });

      // Stubbing EventModel for fetching events
      const fetchStub = sinon
        .stub()
        .resolves({ success: true, data: mockData });

      sandbox.stub(EventModel, "airqo").returns({ fetch: fetchStub });

      // Stubbing Device Model for offline updates
      const deviceUpdateManyStub = sinon.stub().resolves({});
      sandbox
        .stub(DeviceModel, "airqo")
        .returns({ updateMany: deviceUpdateManyStub });

      // Stubbing generateFilter
      sandbox.stub(generateFilter, "fetch").returns({});

      await fetchAndStoreDataIntoReadingsModel();

      // Expectation for devices not in fetched measurements and older than threshold to be marked offline
      expect(deviceUpdateManyStub).to.have.been.calledWith(
        {
          _id: { $nin: ["456"] }, // Assuming '456' is the only active device ID
          lastActive: {
            $lt: moment()
              .subtract(INACTIVE_THRESHOLD, "milliseconds")
              .toDate(),
          }, // Check lastActive condition
        },
        { isOnline: false }
      );
    });
  });
});
