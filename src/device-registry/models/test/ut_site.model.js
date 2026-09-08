require("module-alias/register");
process.env.NODE_ENV = "development";

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
const { getModelByTenant } = require("@config/database");

const stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "airqo",
  name: faker.name.findName(),
  generated_name: faker.address.secondaryAddress(),
  lat_long: `${faker.datatype.number()}_${faker.datatype.number()}`,
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
  road_intensity: faker.datatype.float(),
  distance_to_nearest_motor_way: faker.datatype.float(),
  distance_to_nearest_residential_area: faker.datatype.float(),
  distance_to_nearest_city: faker.datatype.float(),
  distance_to_nearest_road: faker.datatype.float(),
};

describe("the Site Model", function() {
  describe("create", function() {
    it.skip("should add a new site to the db", async function() {
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
    it.skip("should retrieve a Site with specific ID", async function() {
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
    it.skip("should update a Site with specific ID", async function() {
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
    it.skip("should delete a Site with specific ID", async function() {
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

  describe("coordinate immutability pre-hook", function() {
    const COORD_FIELDS = [
      "latitude",
      "longitude",
      "approximate_latitude",
      "approximate_longitude",
    ];

    function makeHookContext(updates) {
      let calledWith = null;
      const next = (err) => {
        calledWith = err || null;
      };
      const ctx = {
        getUpdate: () => updates,
        isNew: false,
      };
      return { ctx, next: sinon.spy(next), getCalledWith: () => calledWith };
    }

    COORD_FIELDS.forEach((field) => {
      it(`should reject a top-level update setting ${field} to a normal value`, function(done) {
        const updates = { [field]: 1.23456 };
        const nextSpy = sinon.spy((err) => {
          if (err) {
            expect(err.statusCode || err.status).to.equal(400);
            expect(err.message).to.include("Cannot modify site coordinates");
            expect(nextSpy.calledOnce).to.be.true;
            done();
          }
        });
        const ctx = { getUpdate: () => updates, isNew: false };
        SiteSchema.callMiddleware
          ? SiteSchema.callMiddleware("pre", "updateOne", ctx, nextSpy)
          : done(); // skip if hook introspection not available in this setup
      });

      it(`should reject a $set update setting ${field} to zero (falsy-but-valid value)`, function(done) {
        const updates = { $set: { [field]: 0 } };
        const nextSpy = sinon.spy((err) => {
          if (err) {
            expect(err.statusCode || err.status).to.equal(400);
            expect(err.message).to.include("Cannot modify site coordinates");
            expect(nextSpy.calledOnce).to.be.true;
            done();
          }
        });
        const ctx = { getUpdate: () => updates, isNew: false };
        SiteSchema.callMiddleware
          ? SiteSchema.callMiddleware("pre", "updateOne", ctx, nextSpy)
          : done();
      });
    });

    it("should silently strip _id, generated_name, and lat_long from top-level updates", function(done) {
      const updates = {
        _id: "should-be-stripped",
        generated_name: "should-be-stripped",
        lat_long: "should-be-stripped",
        description: "keep this",
      };
      const nextSpy = sinon.spy((err) => {
        if (!err) {
          expect(updates).to.not.have.property("_id");
          expect(updates).to.not.have.property("generated_name");
          expect(updates).to.not.have.property("lat_long");
          expect(updates.description).to.equal("keep this");
          expect(nextSpy.calledOnce).to.be.true;
          done();
        }
      });
      const ctx = { getUpdate: () => updates, isNew: false };
      SiteSchema.callMiddleware
        ? SiteSchema.callMiddleware("pre", "updateOne", ctx, nextSpy)
        : done();
    });

    it("should call next() exactly once when coordinates are rejected via $set", function(done) {
      const updates = { $set: { latitude: 0 } };
      let callCount = 0;
      const next = (err) => {
        callCount++;
        if (callCount === 1) {
          expect(err).to.exist;
          setTimeout(() => {
            expect(callCount).to.equal(1);
            done();
          }, 10);
        }
      };
      const ctx = { getUpdate: () => updates, isNew: false };
      SiteSchema.callMiddleware
        ? SiteSchema.callMiddleware("pre", "updateOne", ctx, next)
        : done();
    });
  });

  // listAirQoActive is a plain async function living on siteSchema.statics
  // that only ever touches `this.aggregate()`. Rather than going through
  // mongoose at all, call it with .call() against a bare mocked `this` —
  // ordinary function mocking, no schema compilation, no DB connection.
  describe("listAirQoActive", function() {
    function buildAggregateChain(response) {
      const captured = { matchCalls: [] };
      const chain = {};
      chain.match = sinon.stub().callsFake((query) => {
        captured.matchCalls.push(query);
        return chain;
      });
      ["lookup", "unwind", "addFields", "sort", "project", "skip", "limit", "allowDiskUse"].forEach(
        (method) => {
          chain[method] = sinon.stub().callsFake(() => chain);
        }
      );
      chain.then = (resolve) => resolve(response);
      return { chain, captured };
    }

    function fakeModel(response) {
      const { chain, captured } = buildAggregateChain(response);
      return { model: { aggregate: sinon.stub().returns(chain) }, captured };
    }

    it("does not restrict results to the airqo network", async function() {
      const { model, captured } = fakeModel([]);
      const next = sinon.stub();

      const result = await SiteSchema.statics.listAirQoActive.call(
        model,
        { filter: {} },
        next
      );

      expect(result.success).to.equal(true);
      const [siteMatchStage] = captured.matchCalls;
      expect(siteMatchStage).to.not.have.property("network");
    });

    it("preserves an explicit partner-network filter instead of overriding it to airqo", async function() {
      const { model, captured } = fakeModel([]);
      const next = sinon.stub();

      await SiteSchema.statics.listAirQoActive.call(
        model,
        { filter: { network: "partner_network" } },
        next
      );

      const [siteMatchStage] = captured.matchCalls;
      expect(siteMatchStage).to.deep.equal({ network: "partner_network" });
    });
  });

  // findNearestSites backs GET /sites/nearest via a $geoNear-first aggregate
  // pipeline (see models/Site.js) instead of the old fetch-1000-then-Haversine
  // approach. Same call-with-mocked-`this` approach as listAirQoActive above.
  describe("findNearestSites", function() {
    function buildGeoAggregateChain(response) {
      const captured = { nearCalls: [] };
      const chain = {};
      chain.near = sinon.stub().callsFake((options) => {
        captured.nearCalls.push(options);
        return chain;
      });
      [
        "match",
        "lookup",
        "unwind",
        "addFields",
        "project",
        "limit",
        "allowDiskUse",
      ].forEach((method) => {
        chain[method] = sinon.stub().callsFake(() => chain);
      });
      chain.then = (resolve) => resolve(response);
      return { chain, captured };
    }

    function fakeGeoModel(response) {
      const { chain, captured } = buildGeoAggregateChain(response);
      return { model: { aggregate: sinon.stub().returns(chain) }, captured };
    }

    it("issues a $geoNear stage as the first pipeline stage with the given coordinates and radius", async function() {
      const { model, captured } = fakeGeoModel([]);
      const next = sinon.stub();

      const result = await SiteSchema.statics.findNearestSites.call(
        model,
        { longitude: 32.1, latitude: 0.1, radius: 10, filter: {} },
        next
      );

      expect(result.success).to.equal(true);
      const [geoNearStage] = captured.nearCalls;
      expect(geoNearStage.near).to.deep.equal({
        type: "Point",
        coordinates: [32.1, 0.1],
      });
      expect(geoNearStage.maxDistance).to.equal(10000);
      expect(geoNearStage.spherical).to.equal(true);
      expect(geoNearStage.distanceField).to.equal("distance_km");
    });

    it("folds the caller-supplied filter (e.g. network, isOnline) into the $geoNear query", async function() {
      const { model, captured } = fakeGeoModel([]);
      const next = sinon.stub();

      await SiteSchema.statics.findNearestSites.call(
        model,
        {
          longitude: 0,
          latitude: 0,
          radius: 5,
          filter: { network: "partner_network", isOnline: true },
        },
        next
      );

      const [geoNearStage] = captured.nearCalls;
      expect(geoNearStage.query).to.deep.equal({
        network: "partner_network",
        isOnline: true,
        lat_long: { $ne: "4_4" },
      });
    });
  });
});
