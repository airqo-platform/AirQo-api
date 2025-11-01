require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const { updateRawOnlineStatus } = require("@jobs/update-raw-online-status-job");
const constants = require("@config/constants");
const DeviceModel = require("@models/Device");
const createDeviceUtil = require("@utils/device.util");
const createFeedUtil = require("@utils/feed.util");
const { getUptimeAccuracyUpdateObject } = require("@utils/common");

describe("updateRawOnlineStatusJob", () => {
  let deviceModelStub;
  let decryptKeyStub;
  let fetchThingspeakDataStub;

  beforeEach(() => {
    // Stub external dependencies
    deviceModelStub = sinon.stub(DeviceModel("airqo"), "bulkWrite");
    decryptKeyStub = sinon.stub(createDeviceUtil, "decryptKey");
    fetchThingspeakDataStub = sinon.stub(createFeedUtil, "fetchThingspeakData");
    sinon.stub(DeviceModel("airqo"), "estimatedDocumentCount").resolves(1);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("STATUSES_FOR_PRIMARY_UPDATE constant", () => {
    it("should include all valid statuses except 'deployed'", () => {
      const STATUSES_FOR_PRIMARY_UPDATE = constants.VALID_DEVICE_STATUSES.filter(
        (status) => status !== "deployed"
      );

      const expectedStatuses = [
        "recalled",
        "ready",
        "undeployed",
        "decommissioned",
        "assembly",
        "testing",
        "not deployed",
      ];

      expect(STATUSES_FOR_PRIMARY_UPDATE).to.have.members(expectedStatuses);
      expect(STATUSES_FOR_PRIMARY_UPDATE).to.not.include("deployed");
      expect(STATUSES_FOR_PRIMARY_UPDATE.length).to.equal(
        constants.VALID_DEVICE_STATUSES.length - 1
      );
    });
  });

  describe("processIndividualDevice logic", () => {
    const mockDevice = (status, overrides = {}) => ({
      _id: "mock_id",
      name: "mock_device",
      device_number: 12345,
      status,
      rawOnlineStatus: false,
      onlineStatusAccuracy: {},
      ...overrides,
    });

    const mockDeviceDetailsMap = new Map([
      [12345, { device_number: 12345, readKey: "encrypted_key" }],
    ]);

    beforeEach(() => {
      decryptKeyStub.resolves({ success: true, data: "decrypted_key" });
      fetchThingspeakDataStub.resolves({
        feeds: [{ created_at: new Date().toISOString() }],
      });
    });

    it("should update primary 'isOnline' for a 'ready' device", async () => {
      const device = mockDevice("ready");
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield device;
        },
        close: sinon.stub(),
      };
      sinon.stub(DeviceModel("airqo"), "find").returns({
        select: () => ({
          lean: () => ({
            batchSize: () => ({
              cursor: () => cursor,
            }),
          }),
        }),
      });
      sinon
        .stub(DeviceModel("airqo"), "find")
        .withArgs({ device_number: { $in: [12345] } })
        .returns({
          select: () => ({
            lean: () =>
              Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
          }),
        });

      await updateRawOnlineStatus();

      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.have.property("isOnline", true);
    });

    it("should NOT update primary 'isOnline' for a 'deployed' device", async () => {
      const device = mockDevice("deployed");
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield device;
        },
        close: sinon.stub(),
      };
      sinon.stub(DeviceModel("airqo"), "find").returns({
        select: () => ({
          lean: () => ({
            batchSize: () => ({
              cursor: () => cursor,
            }),
          }),
        }),
      });
      sinon
        .stub(DeviceModel("airqo"), "find")
        .withArgs({ device_number: { $in: [12345] } })
        .returns({
          select: () => ({
            lean: () =>
              Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
          }),
        });

      await updateRawOnlineStatus();

      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.not.have.property("isOnline");
      expect(updateOperation.$set).to.have.property("rawOnlineStatus", true);
    });

    it("should update primary 'isOnline' for a mobile device, regardless of status", async () => {
      const device = mockDevice("deployed", { mobility: true });
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield device;
        },
        close: sinon.stub(),
      };
      sinon.stub(DeviceModel("airqo"), "find").returns({
        select: () => ({
          lean: () => ({
            batchSize: () => ({
              cursor: () => cursor,
            }),
          }),
        }),
      });
      sinon
        .stub(DeviceModel("airqo"), "find")
        .withArgs({ device_number: { $in: [12345] } })
        .returns({
          select: () => ({
            lean: () =>
              Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
          }),
        });

      await updateRawOnlineStatus();

      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.have.property("isOnline", true);
    });
  });
});
