require("module-alias/register");
const sinon = require("sinon");
const { expect } = require("chai");
const log4js = require("log4js");
const DeviceModel = require("@models/Device");
const { logText } = require("@utils/log");
const checkNetworkStatus = require("@bin/jobs/new-check-network-status-job");

describe("checkNetworkStatus", () => {
  let loggerStub;
  let aggregateStub;

  beforeEach(() => {
    // Stub the logger methods
    loggerStub = sinon.stub(log4js.getLogger(), "info");
    sinon.stub(log4js.getLogger(), "warn");
    sinon.stub(log4js.getLogger(), "error");

    // Stub the DeviceModel aggregate method
    aggregateStub = sinon
      .stub(DeviceModel.prototype, "aggregate")
      .returns(Promise.resolve([]));
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
    aggregateStub.returns(
      Promise.resolve([{ totalDevices: 10, offlineDevicesCount: 2 }])
    );

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith("✅ Network status is acceptable: 20.00% offline")
    ).to.be.true;
  });

  it("should calculate offline percentage correctly and log warning if more than 60% are offline", async () => {
    aggregateStub.returns(
      Promise.resolve([{ totalDevices: 5, offlineDevicesCount: 4 }])
    );

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith(
        "⚠️💔😥 More than 60% of devices are offline: 80.00%"
      )
    ).to.be.true;
  });

  it("should handle errors gracefully", async () => {
    const errorMessage = "Database error";
    aggregateStub.throws(new Error(errorMessage));

    await checkNetworkStatus();

    expect(
      loggerStub.calledWith("Error checking network status: Database error")
    ).to.be.true;
  });
});
