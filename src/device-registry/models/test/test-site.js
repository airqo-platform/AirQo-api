"use-strict";
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const faker = require("faker");
const sinon = require("sinon");
const request = require("request");
chai.use(chaiHttp);
const assert = require("assert");
const SiteModel = require("../Site");

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

describe("the Site Model", function() {
  describe("create", function() {
    it("should add a new site to the db", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "create")
        .returns(stubValue);
      const newSite = new SiteModel(stubValue.tenant);
      const site = await newSite.create(
        stubValue.name,
        stubValue.generated_name,
        stubValue.formatted_name,
        stubValue.longitude,
        stubValue.latitude,
        stubValue.createdAt,
        stubValue.updatedAt
      );
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("getSite", function() {
    it("should retrieve a Site with specific ID", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "list")
        .returns(stubValue);
      let filter = { _id: stubValue._id };
      const site = await SiteModel(stubValue.tenant).list(filter);
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });
});
