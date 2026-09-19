require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const usageRecorder = require("@utils/usage-recorder.util");
const { trackApiUsage } = require("@middleware/usage-tracker.middleware");

describe("usage-tracker.middleware", () => {
  afterEach(() => sinon.restore());

  const makeReq = (overrides = {}) => ({
    query: {},
    body: {},
    headers: { "x-original-uri": "/api/v2/devices/sites", "x-original-method": "GET" },
    user: { _id: "5f8d0d55b54764421b7156c3", email: "a@b.c" },
    authTenant: "airqo",
    ...overrides,
  });

  it("records under the authenticated tenant, ignoring a client-supplied one", () => {
    const record = sinon.stub(usageRecorder, "recordApiCall");
    const next = sinon.stub();
    trackApiUsage(makeReq({ query: { tenant: "someone-else" }, body: { tenant: "other" } }), {}, next);
    expect(record.calledOnce).to.equal(true);
    expect(record.firstCall.args[0].tenant).to.equal("airqo");
    expect(record.firstCall.args[0].uri).to.equal("/api/v2/devices/sites");
    expect(next.calledOnceWithExactly()).to.equal(true);
  });

  it("does not record when the auth tenant is unknown, but never blocks the request", () => {
    const record = sinon.stub(usageRecorder, "recordApiCall");
    const next = sinon.stub();
    trackApiUsage(makeReq({ authTenant: undefined, query: { tenant: "airqo" } }), {}, next);
    expect(record.called).to.equal(false);
    expect(next.calledOnce).to.equal(true);
  });

  it("does not record without an authenticated user", () => {
    const record = sinon.stub(usageRecorder, "recordApiCall");
    const next = sinon.stub();
    trackApiUsage(makeReq({ user: undefined }), {}, next);
    expect(record.called).to.equal(false);
    expect(next.calledOnce).to.equal(true);
  });

  it("keeps the request flowing even if the recorder throws", () => {
    sinon.stub(usageRecorder, "recordApiCall").throws(new Error("boom"));
    const next = sinon.stub();
    trackApiUsage(makeReq(), {}, next);
    expect(next.calledOnce).to.equal(true);
  });
});
