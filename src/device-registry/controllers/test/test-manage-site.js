const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const faker = require("faker");
const sinon = require("sinon");
const request = require("request");
chai.use(chaiHttp);
const assert = require("assert");
const SiteModel = require("../../models/Site");
const siteController = require("../manage-site");
const siteUtil = require("../../utils/create-site");

const stubValue = {
  _id: faker.random.uuid(),
  tenant: "airqo",
  name: faker.name.findName(),
  generated_name: faker.internet.siteName(),
  formatted_name: faker.address.streetAddress(),
  latitude: faker.address.latitude(),
  longitude: faker.address.longitude(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  description: faker.address.direction(),
  site_activities: faker.random.words(),
  county: faker.address.county(),
  sub_county: faker.address.county(),
  parish: faker.address.county(),
  village: faker.address.county(),
  region: faker.address.country(),
  district: faker.address.state(),
  road_intensity: faker.random.float(),
  distance_to_nearest_motor_way: faker.random.float(),
  distance_to_nearest_residential_area: faker.random.float(),
  distance_to_nearest_city: faker.random.float(),
  distance_to_nearest_road: faker.random.float(),
};

describe("site controller", function() {
  describe("create", function() {
    let status, json, res, siteController, siteUtil;
    beforeEach(async () => {
      status = sinon.stub();
      json = sinon.spy();
      res = { json, status };
      status.returns(res);
      const siteModel = sinon.spy();
      siteUtil = await siteUtil.createSite(siteModel);
    });

    it("should not register a new site if the name parameter is not provided", async function() {
      const req = { body: { generated_name: faker.name.findName() } };
      await siteController.create(req, res);
      //  expect(status.calledOnce).to.be.true;
      //  expect(status.args\[0\][0]).to.equal(400);
      //  expect(json.calledOnce).to.be.true;
      //  expect(json.args\[0\][0].message).to.equal("Invalid Params");
    });

    it("should not register a new site if name,latitude and longitude are not provided", async function() {
      const req = { body: {} };
      await siteController.create(req, res);
      expect(status.calledOnce).to.be.true;
      // expect(status.args\[0\][0]).to.equal(400);
      // expect(json.calledOnce).to.be.true;
      // expect(json.args\[0\][0].message).to.equal("Invalid Params");
    });

    it("should not register a site when latitude and longitude param are not provided", async function() {
      const req = { body: { name: faker.name.findName() } };
      await siteController.create(req, res);
      expect(status.calledOnce).to.be.true;
      // expect(status.args\[0\][0]).to.equal(400);
      // expect(json.calledOnce).to.be.true;
      // expect(json.args\[0\][0].message).to.equal("Invalid Params");
    });

    it("should register a site when name, lat, long are provided are provided", async function() {
      const req = {
        body: {
          name: faker.name.findName(),
          latitude: faker.address.latitude(),
          longitude: faker.address.longitude(),
        },
      };
      const stubValue = {
        id: faker.random.uuid(),
        name: faker.name.findName(),
        longitude: faker.address.longitude(),
        latitude: faker.address.latitude(),
        createdAt: faker.date.past(),
        updatedAt: faker.date.past(),
      };
      const stub = sinon.stub(siteUtil, "create").returns(stubValue);
      await siteController.create(req, res);
      expect(stub.calledOnce).to.be.true;
      expect(status.calledOnce).to.be.true;
      // expect(status.args\[0\][0]).to.equal(201);
      // expect(json.calledOnce).to.be.true;
      // expect(json.args\[0\][0].data).to.equal(stubValue);
    });
  });
});

describe("getSite", function() {
  let req;
  let res;
  let siteUtil;
  beforeEach(() => {
    req = { params: { id: faker.random.uuid() } };
    res = { json: function() {} };
    const SiteModel = sinon.spy();
  });
  it("should retrieve a Site that matches the provided ID", async function() {
    const stubValue = {
      id: faker.random.uuid(),
      name: faker.name.findName(),
      longitude: faker.address.longitude(),
      latitude: faker.address.latitude(),
      createdAt: faker.date.past(),
      updatedAt: faker.date.past(),
    };
    const mock = sinon.mock(res);
    mock
      .expects("json")
      .once()
      .withExactArgs({ data: stubValue });
    const stub = sinon.stub(userUtil, "getSite").returns(stubValue);
    userController = new UserController(userService);
    const site = await siteController.getaSite(req, res);
    expect(stub.calledOnce).to.be.true;
    mock.verify();
  });
});
