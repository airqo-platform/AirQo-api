require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const proxyquire = require("proxyquire");
const httpStatus = require("http-status");

describe("Device Model - modify error handling", () => {
  let Device;
  let fakeLogger;
  let findOneAndUpdateStub;

  before(() => {
    fakeLogger = {
      info: sinon.stub(),
      warn: sinon.stub(),
      error: sinon.stub(),
      debug: sinon.stub(),
    };
    const DeviceModel = proxyquire("@models/Device", {
      "@config/database": {
        getModelByTenant: (tenant, name, schema) =>
          mongoose.models.device_modify_test ||
          mongoose.model("device_modify_test", schema),
      },
      log4js: { getLogger: () => fakeLogger },
    });
    Device = DeviceModel("airqo");
  });

  beforeEach(() => {
    Object.values(fakeLogger).forEach((s) => s.resetHistory());
    findOneAndUpdateStub = sinon.stub(Device, "findOneAndUpdate");
  });

  afterEach(() => {
    sinon.restore();
  });

  const buildUniqueValidationError = () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "serial_number",
      new mongoose.Error.ValidatorError({
        message: "667bfca289c0b362dc80aad3 must be unique!",
        path: "serial_number",
      }),
    );
    error.addError(
      "api_code",
      new mongoose.Error.ValidatorError({
        message:
          "https://device.iqair.com/v2/667bfca289c0b362dc80aad3 must be unique!",
        path: "api_code",
      }),
    );
    return error;
  };

  it("returns 409 Conflict with per-field details on a uniqueness conflict", async () => {
    findOneAndUpdateStub.rejects(buildUniqueValidationError());
    const next = sinon.spy();

    await Device.modify(
      {
        filter: { _id: "64b7f0c2a1b2c3d4e5f60718" },
        update: { serial_number: "667bfca289c0b362dc80aad3" },
      },
      next,
    );

    expect(next.calledOnce).to.be.true;
    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.CONFLICT);
    expect(err.message).to.equal(
      "Validation errors for some of the provided fields",
    );
    expect(err.errors).to.include({
      serial_number: "667bfca289c0b362dc80aad3 must be unique!",
      api_code:
        "https://device.iqair.com/v2/667bfca289c0b362dc80aad3 must be unique!",
    });
    expect(err.errors.message).to.be.a("string").and.include("Validation failed");
  });

  it("logs a uniqueness conflict at WARN, not ERROR", async () => {
    findOneAndUpdateStub.rejects(buildUniqueValidationError());

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      sinon.spy(),
    );

    expect(fakeLogger.warn.calledOnce).to.be.true;
    expect(fakeLogger.error.called).to.be.false;
  });

  it("still returns 500 and logs ERROR for unexpected failures", async () => {
    findOneAndUpdateStub.rejects(new Error("connection reset"));
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    expect(err.message).to.equal("Internal Server Error");
    expect(err.errors).to.deep.equal({ message: "connection reset" });
    expect(fakeLogger.error.calledOnce).to.be.true;
    expect(fakeLogger.warn.called).to.be.false;
  });
});
