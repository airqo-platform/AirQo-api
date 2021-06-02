"use-strict";
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
const request = require("request");
chai.use(chaiHttp);
const SiteSchema = require("../Site");
const { getModelByTenant } = require("../../utils/multitenancy");

const stubValue = {
  _id: faker.random.uuid(),
  tenant: "airqo",
  name: faker.name.findName(),
  generated_name: faker.internet.name(),
  lat_long: faker.internet.name(),
  formatted_name: faker.address.streetAddress(),
  city: faker.address.city(),
  street: faker.address.streetName(),
  country: faker.address.country(),
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
      const SiteModel = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      );
      const stub = sinon.stub(SiteModel, "create").returns(stubValue);

      const site = SiteModel.create(
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
      const SiteModel = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      );
      const stub = sinon.stub(SiteModel, "list").returns(stubValue);
      let filter = { lat_long: stubValue.lat_long };
      const site = SiteModel.list(filter);
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("update", function() {
    it("should update a Site with specific ID", async function() {
      const SiteModel = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      );
      const stub = sinon.stub(SiteModel, "update").returns(stubValue);
      let body = stubValue;
      delete body._id;

      const updatedSite = SiteModel.update(stubValue.lat_long, body);
      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
      assert.equal(updatedSite.success, true, "the site has been updated");
    });
  });

  describe("delete", function() {
    it("should delete a Site with specific ID", async function() {
      const SiteModel = await getModelByTenant(
        tenant.toLowerCase(),
        "site",
        SiteSchema
      );
      const stub = sinon.stub(SiteModel, "delete").returns(stubValue);

      const deletedSite = SiteModel.update(stubValue.lat_long);
      expect(stub.calledOnce).to.be.true;
      expect(deletedSite).to.not.be.empty;
      expect(deletedSite).to.be.a("object");
      assert.equal(deletedSite.success, true, "the site has been deleted");
    });
  });
});
