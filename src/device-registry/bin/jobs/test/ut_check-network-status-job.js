require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const log4js = require("log4js");
const DeviceModel = require("@models/Device");
const { logText } = require("@utils/log");
const checkNetworkStatus = require("@bin/jobs/check-network-status-job");

describe("checkNetworkStatus", () => {
  let loggerStub;
  let findStub;

  beforeEach(() => {
    // Stub the logger methods
    loggerStub = sinon.stub(log4js.getLogger(), "info");
    sinon.stub(log4js.getLogger(), "warn");
    sinon.stub(log4js.getLogger(), "error");

    // Stub the DeviceModel find method
    findStub = sinon.stub(DeviceModel.prototype, "find").returns({
      lean: () => ({
        limit: () => ({
          skip: () => Promise.resolve([]), // Default to an empty array
        }),
      }),
    });
  });

  afterEach(() => {
    // Restore all stubs
    sinon.restore();
  });

  it("should log 'No devices found' when there are no devices", async () => {
    await checkNetworkStatus();

    expect(loggerStub.calledWith("No devices found.")).to.be.true;
    expect(logText.calledWith("No devices found")).to.be.true;
  });

  it("should calculate offline percentage correctly and log acceptable status", async () => {
    findStub.returns({
      lean: () => ({
        limit: () => ({
          skip: () =>
            Promise.resolve([{ isOnline: true }, { isOnline: false }]), // Mock devices
        }),
      }),
    });

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith("✅ Network status is acceptable: 50.00% offline")
    ).to.be.true;
  });

  it("should calculate offline percentage correctly and log warning if more than 60% are offline", async () => {
    findStub.returns({
      lean: () => ({
        limit: () => ({
          skip: () =>
            Promise.resolve([
              { isOnline: false },
              { isOnline: false },
              { isOnline: true },
            ]), // Mock devices
        }),
      }),
    });

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith("⚠️ More than 60% of devices are offline: 66.67%")
    ).to.be.true;
  });

  it("should handle errors gracefully", async () => {
    findStub.throws(new Error("Database error"));

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith("Error checking network status: Database error")
    ).to.be.true;
  });
});
