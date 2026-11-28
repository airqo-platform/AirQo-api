require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const deviceController = require("@controllers/device.controller");
const createDeviceUtil = require("@utils/device.util");

// Kampala (AirQo HQ) and two nearby / far points.
const ORIGIN = { latitude: "0.3136", longitude: "32.5811" };
const NEARBY = { latitude: 0.3236, longitude: 32.5811 }; // ~1.11 km north
const FAR = { latitude: 0.0512, longitude: 32.4637 }; // Entebbe, ~32 km

const activeDevice = (name, coords) => ({
  name,
  ...coords,
  isActive: true,
  isPrimaryInLocation: true,
});

const buildRes = () => {
  const res = { headersSent: false };
  res.status = sinon.stub().returns(res);
  res.json = sinon.stub().returns(res);
  return res;
};

describe("device controller - listAllByNearestCoordinates", () => {
  let listStub;

  beforeEach(() => {
    listStub = sinon.stub(createDeviceUtil, "list");
  });

  afterEach(() => {
    sinon.restore();
  });

  const call = async (query) => {
    const req = { query: { ...query } };
    const res = buildRes();
    const next = sinon.spy();
    await deviceController.listAllByNearestCoordinates(req, res, next);
    return { req, res, next };
  };

  it("returns devices within the radius with a numeric distance in km", async () => {
    listStub.resolves({
      success: true,
      data: [
        activeDevice("aq_near", NEARBY),
        activeDevice("aq_far", FAR),
      ],
    });

    const { res, next } = await call({ ...ORIGIN, radius: "5" });

    expect(next.called).to.be.false;
    expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    const body = JSON.parse(JSON.stringify(res.json.firstCall.args[0]));
    expect(body).to.have.lengthOf(1);
    expect(body[0].name).to.equal("aq_near");
    expect(body[0].distance).to.be.a("number").and.closeTo(1.11, 0.01);
  });

  it("works without a tenant and defaults it to airqo", async () => {
    listStub.resolves({ success: true, data: [] });

    const { res, next } = await call({ ...ORIGIN, radius: "5" });

    expect(next.called).to.be.false;
    expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    expect(listStub.firstCall.args[0].query.tenant).to.equal("airqo");
  });

  it("still honours an explicit tenant", async () => {
    listStub.resolves({ success: true, data: [] });

    await call({ ...ORIGIN, radius: "5", tenant: "airqo" });

    expect(listStub.firstCall.args[0].query.tenant).to.equal("airqo");
  });

  it("filters by device name when `device` is given", async () => {
    listStub.resolves({ success: true, data: [] });

    const { next } = await call({ ...ORIGIN, radius: "5", device: "aq_near" });

    expect(next.called).to.be.false;
    expect(listStub.firstCall.args[0].query.name).to.equal("aq_near");
  });

  it("filters by device number when `chid` is given", async () => {
    listStub.resolves({ success: true, data: [] });

    await call({ ...ORIGIN, radius: "5", chid: "930434" });

    expect(listStub.firstCall.args[0].query.device_number).to.equal("930434");
  });

  it("does not add name or device_number filters when they are not given", async () => {
    listStub.resolves({ success: true, data: [] });

    await call({ ...ORIGIN, radius: "5" });

    const { query } = listStub.firstCall.args[0];
    expect(query).to.not.have.property("name");
    expect(query).to.not.have.property("device_number");
  });

  ["latitude", "longitude", "radius"].forEach((param) => {
    it(`returns 400 when ${param} is missing`, async () => {
      const query = { ...ORIGIN, radius: "5" };
      delete query[param];

      const { res } = await call(query);

      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.firstCall.args[0]).to.deep.equal({
        success: false,
        message: "missing query params, please check documentation",
      });
      expect(listStub.called).to.be.false;
    });
  });

  it("returns an empty array when the device lookup fails", async () => {
    listStub.resolves({ success: false, message: "lookup failed" });

    const { res, next } = await call({ ...ORIGIN, radius: "5" });

    expect(next.called).to.be.false;
    expect(res.status.calledWith(httpStatus.OK)).to.be.true;
    expect(res.json.firstCall.args[0]).to.deep.equal([]);
  });
});
