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
  let countDocumentsStub;

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
    // Uniqueness re-check: by default the conflicting device really exists.
    countDocumentsStub = sinon.stub(Device, "countDocuments").resolves(1);
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
        type: "unique",
        value: "667bfca289c0b362dc80aad3",
      }),
    );
    error.addError(
      "api_code",
      new mongoose.Error.ValidatorError({
        message:
          "https://device.iqair.com/v2/667bfca289c0b362dc80aad3 must be unique!",
        path: "api_code",
        type: "unique",
        value: "https://device.iqair.com/v2/667bfca289c0b362dc80aad3",
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
  it("re-checks each duplicate excluding the device being updated", async () => {
    findOneAndUpdateStub.rejects(buildUniqueValidationError());

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      sinon.spy(),
    );

    expect(countDocumentsStub.firstCall.args[0]).to.deep.equal({
      $and: [
        { serial_number: "667bfca289c0b362dc80aad3" },
        { $nor: [{ _id: "64b7f0c2a1b2c3d4e5f60718" }] },
      ],
    });
  });

  it("excludes only documents matching the full filter, not each key", async () => {
    // Per-key $ne would drop every other iqair device from the re-check.
    findOneAndUpdateStub.rejects(buildUniqueValidationError());
    const filter = { _id: { $in: ["64b7f0c2a1b2c3d4e5f60718"] }, network: "iqair" };

    await Device.modify({ filter, update: {} }, sinon.spy());

    expect(countDocumentsStub.firstCall.args[0]).to.deep.equal({
      $and: [{ serial_number: "667bfca289c0b362dc80aad3" }, { $nor: [filter] }],
    });
  });

  it("returns 409 with field details for a duplicate-key (E11000) error", async () => {
    const dupKey = new Error(
      "E11000 duplicate key error collection: devices index: serial_number_1",
    );
    dupKey.code = 11000;
    dupKey.keyValue = { serial_number: "667bfca289c0b362dc80aad3" };
    findOneAndUpdateStub.rejects(dupKey);
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.CONFLICT);
    expect(err.errors.serial_number).to.equal(
      "667bfca289c0b362dc80aad3 must be unique!",
    );
    expect(fakeLogger.warn.calledOnce).to.be.true;
    expect(fakeLogger.error.called).to.be.false;
  });

  it("keeps database connection failures on the 500 path", async () => {
    const connErr = new Error("connection timed out");
    connErr.name = "MongoNetworkError";
    findOneAndUpdateStub.rejects(connErr);
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    expect(next.firstCall.args[0].statusCode).to.equal(
      httpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(fakeLogger.error.called).to.be.true;
  });

  it("returns 500 and logs ERROR when the uniqueness re-check fails", async () => {
    // e.g. DB outage: the plugin reports "must be unique!" and the re-check throws.
    findOneAndUpdateStub.rejects(buildUniqueValidationError());
    countDocumentsStub.rejects(new Error("connection refused"));
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    const err = next.firstCall.args[0];
    expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    expect(err.message).to.equal("Internal Server Error");
    expect(fakeLogger.error.called).to.be.true;
    expect(fakeLogger.warn.called).to.be.false;
  });

  it("returns 500 when the reported duplicate does not actually exist", async () => {
    // Plugin swallowed a transient count error; the conflict is not real.
    findOneAndUpdateStub.rejects(buildUniqueValidationError());
    countDocumentsStub.resolves(0);
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    expect(next.firstCall.args[0].statusCode).to.equal(
      httpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(fakeLogger.warn.called).to.be.false;
  });

  it("still returns 409 for non-unique validation errors without a re-check", async () => {
    const error = new mongoose.Error.ValidationError();
    error.addError(
      "category",
      new mongoose.Error.ValidatorError({
        message: "invalid category",
        path: "category",
        type: "enum",
        value: "drone",
      }),
    );
    findOneAndUpdateStub.rejects(error);
    const next = sinon.spy();

    await Device.modify(
      { filter: { _id: "64b7f0c2a1b2c3d4e5f60718" }, update: {} },
      next,
    );

    expect(next.firstCall.args[0].statusCode).to.equal(httpStatus.CONFLICT);
    expect(next.firstCall.args[0].errors.category).to.equal("invalid category");
    expect(countDocumentsStub.called).to.be.false;
  });
});
