require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const {
  updateRawOnlineStatus,
  STATUSES_FOR_PRIMARY_UPDATE,
} = require("@bin/jobs/update-raw-online-status-job");
const constants = require("@config/constants");
const DeviceModel = require("@models/Device");
const DeviceUptimeModel = require("@models/DeviceUptime");
const createDeviceUtil = require("@utils/device.util");
const createFeedUtil = require("@utils/feed.util");

// Global hook: establish the query DB connection so DeviceModel("airqo") can
// resolve a model to stub. No real queries ever execute — every DB-touching
// method used below (bulkWrite, find, estimatedDocumentCount) is stubbed in
// beforeEach — but getQueryTenantDB() throws unless a live connection object
// exists first. Same pattern as bin/test/ut_index.js.
before(function(done) {
  this.timeout(15000);
  const { connectToMongoDB } = require("@config/database");
  try {
    const { queryDB } = connectToMongoDB();
    if (!queryDB || queryDB.readyState === 0 || queryDB.readyState === 1)
      return done();
    // Share one completion callback across both listeners so a connection
    // that errors and later reconnects (emitting "open" after "error") can't
    // call done() a second time.
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      done();
    };
    queryDB.once("open", finish);
    queryDB.once("error", finish);
  } catch (_) {
    done();
  }
});

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
    // updateRawOnlineStatus now also flushes best-effort DeviceUptime
    // samples (see flushUptimeSamples) — stub it so tests never issue a
    // real insertMany, matching the pattern for every other model call above.
    sinon.stub(DeviceUptimeModel("airqo"), "insertMany").resolves([]);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("STATUSES_FOR_PRIMARY_UPDATE constant", () => {
    it("should include all valid statuses except 'deployed'", () => {
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
      // processDeviceBatch's deviceNumbers lookup only includes devices with
      // network === "airqo" (ThingSpeak channels are AirQo-only) — without
      // this the mock device never matches deviceDetailsMap and falls through
      // to the no-readkey fallback branch (always rawOnlineStatus: false).
      network: "airqo",
      status,
      rawOnlineStatus: false,
      onlineStatusAccuracy: {},
      ...overrides,
    });

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
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      // Specific call for device details
      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });

      // Default call for the cursor
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
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
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      // Specific call for device details
      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });

      // Default call for the cursor
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
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
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      // Specific call for device details
      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });

      // Default call for the cursor
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
        }),
      });

      await updateRawOnlineStatus();

      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.have.property("isOnline", true);
    });

    it("should flag channelStatus 'not_found' when ThingSpeak returns 404", async () => {
      const device = mockDevice("ready");
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield device;
        },
        close: sinon.stub(),
      };
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
        }),
      });

      const notFoundError = new Error("Request failed with status code 404");
      notFoundError.response = { status: 404 };
      fetchThingspeakDataStub.rejects(notFoundError);

      await updateRawOnlineStatus();

      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.have.property(
        "channelStatus",
        "not_found"
      );
      expect(updateOperation.$set).to.have.property("channelStatusCheckedAt");
    });

    it("should skip the ThingSpeak call while channelStatus 'not_found' is within its cooldown", async () => {
      const device = mockDevice("ready", {
        channelStatus: "not_found",
        channelStatusCheckedAt: new Date(),
      });
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield device;
        },
        close: sinon.stub(),
      };
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
        }),
      });

      await updateRawOnlineStatus();

      expect(fetchThingspeakDataStub.called).to.be.false;
      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      const updateOperation = bulkWriteArgs[0].updateOne.update;
      expect(updateOperation.$set).to.not.have.property("channelStatus");
    });

    it("should not poll ThingSpeak for a decommissioned device that shares a device_number with an active one", async () => {
      const activeDevice = mockDevice("ready", { _id: "active_id", name: "active_device" });
      const decommissionedDevice = mockDevice("decommissioned", {
        _id: "decommissioned_id",
        name: "decommissioned_device",
      });
      const cursor = {
        [Symbol.asyncIterator]: async function*() {
          yield activeDevice;
          yield decommissionedDevice;
        },
        close: sinon.stub(),
      };
      const findStub = sinon.stub(DeviceModel("airqo"), "find");

      // Simulates the real (unfiltered-by-status) query: it resolves a
      // readKey for device_number 12345 because the active device shares it.
      findStub.withArgs({ device_number: { $in: [12345] } }).returns({
        select: () => ({
          lean: () =>
            Promise.resolve([{ device_number: 12345, readKey: "testKey" }]),
        }),
      });
      findStub.returns({
        select: () => ({
          lean: () => ({ batchSize: () => ({ cursor: () => cursor }) }),
        }),
      });

      await updateRawOnlineStatus();

      // Only the active device should ever reach the ThingSpeak fetch.
      expect(fetchThingspeakDataStub.calledOnce).to.be.true;
      expect(deviceModelStub.calledOnce).to.be.true;
      const bulkWriteArgs = deviceModelStub.firstCall.args[0];
      // processIndividualDevice returns null for the decommissioned device,
      // so only one bulk op (the active device's) should be written.
      expect(bulkWriteArgs.length).to.equal(1);
      expect(bulkWriteArgs[0].updateOne.filter._id).to.equal("active_id");
    });
  });
});
