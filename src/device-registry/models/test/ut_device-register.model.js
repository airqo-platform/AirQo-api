require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const proxyquire = require("proxyquire");
const httpStatus = require("http-status");

describe("Device Model - register error handling", () => {
  let Device;
  let fakeLogger;
  let saveStub;
  let countDocumentsStub;

  const args = {
    name: "iq_b",
    network: "iqair",
    serial_number: "667bfca289c0b362dc80aad3",
  };

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
          mongoose.models.device_register_test ||
          mongoose.model("device_register_test", schema),
      },
      log4js: { getLogger: () => fakeLogger },
    });
    Device = DeviceModel("airqo");
  });

  beforeEach(() => {
    Object.values(fakeLogger).forEach((s) => s.resetHistory());
    saveStub = sinon.stub(Device.prototype, "save");
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
    return error;
  };

  const register = async () => {
    const next = sinon.spy();
    await Device.register({ ...args }, next);
    return next.firstCall.args[0];
  };

  it("returns 409 with field details for a confirmed duplicate", async () => {
    saveStub.rejects(buildUniqueValidationError());

    const err = await register();

    expect(err.statusCode).to.equal(httpStatus.CONFLICT);
    expect(err.message).to.equal(
      "Validation errors for some of the provided fields",
    );
    expect(err.errors).to.deep.equal({
      serial_number: "667bfca289c0b362dc80aad3 must be unique!",
    });
    expect(fakeLogger.warn.calledOnce).to.be.true;
    expect(fakeLogger.error.called).to.be.false;
  });

  it("re-checks the duplicate without excluding anything (new device)", async () => {
    saveStub.rejects(buildUniqueValidationError());

    await register();

    expect(countDocumentsStub.firstCall.args[0]).to.deep.equal({
      $and: [{ serial_number: "667bfca289c0b362dc80aad3" }],
    });
  });

  it("does not report a duplicate when the uniqueness re-check fails", async () => {
    // e.g. DB outage: the plugin reports "must be unique!" and the re-check throws.
    saveStub.rejects(buildUniqueValidationError());
    countDocumentsStub.rejects(new Error("connection refused"));

    const err = await register();

    // Existing unexpected-error path for device creation (status unchanged).
    expect(err.statusCode).to.equal(httpStatus.CONFLICT);
    expect(err.errors).to.deep.equal({
      message: "An unexpected error occurred.",
    });
    expect(fakeLogger.error.called).to.be.true;
    expect(fakeLogger.warn.called).to.be.false;
  });

  it("does not report a duplicate that does not actually exist", async () => {
    saveStub.rejects(buildUniqueValidationError());
    countDocumentsStub.resolves(0);

    const err = await register();

    expect(err.errors).to.deep.equal({
      message: "An unexpected error occurred.",
    });
    expect(fakeLogger.warn.called).to.be.false;
    expect(fakeLogger.error.called).to.be.true;
  });

  it("keeps non-unique validation errors as field-level conflicts", async () => {
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
    saveStub.rejects(error);

    const err = await register();

    expect(err.statusCode).to.equal(httpStatus.CONFLICT);
    expect(err.errors).to.deep.equal({ category: "invalid category" });
    expect(countDocumentsStub.called).to.be.false;
  });
});
