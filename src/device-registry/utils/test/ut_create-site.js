process.env.NODE_ENV = "development";

require('dotenv').config();
require("module-alias/register");
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const SiteModel = require("@utils/multitenancy");
const siteUtil = require("@utils/create-site");

let stubValue = {
  _id: faker.datatype.uuid(),
  tenant: "test",
  name: faker.name.findName(),
  generated_name: faker.address.secondaryAddress(),
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
  city: faker.address.city(),
  road_intensity: faker.datatype.float(),
  distance_to_nearest_motor_way: faker.datatype.float(),
  distance_to_nearest_residential_area: faker.datatype.float(),
  distance_to_nearest_city: faker.datatype.float(),
  distance_to_nearest_road: faker.datatype.float(),
  lat_long: `${faker.datatype.float()}_${faker.datatype.float()}`,
  altitude: faker.datatype.float(),
  aspect: faker.datatype.float(),
  greenness: faker.datatype.float(),
  roadStatus: faker.datatype.float(),
  landUse: faker.datatype.float(),
  terrain:faker.datatype.float(),
  trafficFactor:faker.datatype.float(),
};
stubValue.name = stubValue.name.replaceAll(" ", "-");


describe("create Site utils", function () {

  describe("create", function () {
      it("should create a new site", async function () {
          const Modelstub = sinon.stub(SiteModel, "getModelByTenant").returns(stubValue);
          const stub = sinon.stub(siteUtil, "create").returns(Modelstub.apply(stubValue));
        
          const site = await siteUtil.create(
            stubValue.tenant,
            stubValue.latitude,
            stubValue.longitude,
            stubValue.name
          );

            expect(stub.calledOnce).to.be.true;
            expect(site._id).to.equal(stubValue._id);
            expect(site.name).to.equal(stubValue.name);
            expect(site.generated_name).to.equal(stubValue.generated_name);
            expect(site.formatted_name).to.equal(stubValue.formatted_name);
            expect(site.createdAt).to.equal(stubValue.createdAt);
            expect(site.updatedAt).to.equal(stubValue.updatedAt);
            Modelstub.restore();
      });
    });

  describe("get Site", function() {
    it("should retrieve a Site that matches the provided ID", async function() {
      const Modelstub = sinon.stub(SiteModel, "getModelByTenant").returns(stubValue);
      const stub = sinon.stub(siteUtil, "list").returns(Modelstub.apply(stubValue));
      const site = await siteUtil.list(stubValue._id);

      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
       Modelstub.restore();
    });
  });

  describe("update Site", function() {
    it("should update the Site and return the updated details", async function() {
      const Modelstub = sinon.stub(SiteModel, "getModelByTenant").returns(stubValue);
      const stub = sinon.stub(siteUtil, "update").returns(Modelstub.apply(stubValue));

      let body = stubValue;
      delete body.lat_long;

      const updatedSite = await siteUtil.update(
        stubValue.tenant,
        stubValue.lat_long,
        body
      );

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
      expect(updatedSite.lat_long).to.equal(stubValue.lat_long);
      Modelstub.restore();
    });
  });

  describe("delete Site", function() {
    it("should delete the Site", async function() {
      const Modelstub = sinon.stub(SiteModel, "getModelByTenant").returns(stubValue);
      const stub = sinon.stub(siteUtil, "delete").returns(Modelstub.apply(stubValue));

      const deletedSite = await siteUtil.delete(
        stubValue.tenant,
        stubValue.lat_long
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedSite).to.not.be.empty;
      expect(deletedSite).to.be.a("object");
    });
  });
  /**
   *
   * @param {*} data
   * all the functions below are just utilised by the main CRUD operations
   * above during data insertion into the Site collection
   */

  describe("validate Site name", function () {
    let mock = sinon.mock(siteUtil).expects("validateSiteName").returns(stubValue);
    let isValid = siteUtil.validateSiteName("yesMeQeaer");

    it("it should return true if the site name has no spaces", function () {     
      mock.verify();
      expect(isValid.name).to.not.contain(" ");
    });

    it("should return true if the site name is not longer than 15 characters", function() {
      mock.verify();
      expect(isValid.name.length).to.be.lessThanOrEqual(15);

    });

    it("should return true if the site name if not shorter than 4 characters", function() {
      mock.verify();
      expect(isValid.name.length).to.be.greaterThan(4);
    });
  });

  describe("format Site name", function() {
    it("should return a site name which is a combination + \
     of parish, county, region and/or city.+ \
      And all should be comma separated ", function() {
      stubValue.formatted_name = stubValue.parish
        +","+stubValue.district
        +","+stubValue.region
        +","+stubValue.city;
      let mock = sinon.mock(siteUtil).expects("formatSiteName")
        .withArgs(stubValue.parish,
        stubValue.district,
        stubValue.region,
        stubValue.city).returns(stubValue);
      let formattedSiteName = siteUtil.formatSiteName(
        stubValue.parish,
        stubValue.district,
        stubValue.region,
        stubValue.city
      );
      
      mock.verify();
      expect(stubValue.formatted_name).to.equal(formattedSiteName.formatted_name);
      
    });
  });

  describe("generate Site name", function() {
    it("should generate a unique site name given the parish name", function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "create")
        .returns(stubValue);

      const sites = siteUtil.getSite({});
      let numberOfSitesInNetwork = sites.length();
      let siteNameNumber = numberOfSitesInNetwork + 1;

      let generatedSiteName = siteUtil.generateSiteName(stubValue.parish);

      expect(stub.calledOnce).to.be.true;

      assert.equal(
        generatedSiteName,
        `/${stubValue.parish}_${siteNameNumber}/i`,
        "the generated site name is the expected one"
      );
    });
  });

  describe("Geo code", function() {
    it("it should return the details of the site given the GPS coords", function() {
      
      let mock = sinon.mock(siteUtil).expects("reverseGeoCode")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let site = siteUtil.reverseGeoCode(
        stubValue.latitude,
        stubValue.longitude
      );

      mock.verify();
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);      
    });
  });

  describe("get the nearest distances", function() {
    it("it should return the nearest distances when provided with the GPS coordinates", function() {
      let mock = sinon.mock(siteUtil).expects("getDistance")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let nearestDistance = siteUtil.getDistance(
        stubValue.latitude,
        stubValue.longitude
      );
      mock.verify();
      expect(nearestDistance.distance_to_nearest_city).to.be.equal(stubValue.distance_to_nearest_city);
      expect(nearestDistance.distance_to_nearest_city).to.not.be.null;
      expect(nearestDistance.distance_to_nearest_city).to.be.a("number");
      expect(nearestDistance.distance_to_nearest_motor_way).to.not.be.null;
      expect(nearestDistance.distance_to_nearest_motor_way).to.be.a("number");
      expect(nearestDistance.distance_to_nearest_residential_area).to.not.be
        .null;
      expect(nearestDistance.distance_to_nearest_residential_area).to.be.a(
        "number"
      );
      expect(nearestDistance.distance_to_nearest_road).to.not.be.null;
      expect(nearestDistance.distance_to_nearest_road).to.be.a("number");
    });
  });

  describe("get the land form details", function() {
    it("it should return the landform details", function () {
      let mock = sinon.mock(siteUtil).expects("getLandform")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let landform = siteUtil.getLandform(
        stubValue.latitude,
        stubValue.longitude
      );
      mock.verify();
    });
  });

  describe("get the altitude", function() {
    it("it should return the altitude details", function () {
      let mock = sinon.mock(siteUtil).expects("getAltitude")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let altitude = siteUtil.getAltitude(
        stubValue.latitude,
        stubValue.longitude
      );
      mock.verify();
      expect(altitude.altitude).to.not.be.null;
      expect(altitude.altitude).to.be.a("number");
    });
  });

  describe("get the traffic factor", function() {
    it("it should return the traffic factor", function () {
      let mock = sinon.mock(siteUtil).expects("getTrafficFactor")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let trafficFactor = siteUtil.getTrafficFactor(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(trafficFactor.trafficFactor).to.not.be.null;
      expect(trafficFactor.trafficFactor).to.be.a("number");
    });
  });

  describe("get the greenness", function() {
    it("it should return the greenness number", function () {
      let mock = sinon.mock(siteUtil).expects("getGreenness")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let greenness = siteUtil.getGreenness(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(greenness.greenness).to.not.be.null;
      expect(greenness.greenness).to.be.a("number");
    });
  });

  describe("get the terrain", function() {
    it("it should return the terrain", function () {
      let mock = sinon.mock(siteUtil).expects("getTerrain")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let terrain = siteUtil.getTerrain(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(terrain.terrain).to.not.be.null;
      expect(terrain.terrain).to.be.a("number");
    });
  });

  describe("get the aspect", function() {
    it("it should return the get Aspect", function () {
      let mock = sinon.mock(siteUtil).expects("getAspect")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let aspect = siteUtil.getAspect(stubValue.latitude, stubValue.longitude);
      expect(aspect.aspect).to.not.be.null;
      expect(aspect.aspect).to.be.a("number");
    });
  });

  describe("get the Road Intensity", function() {
    it("it should return the get Road Intensity", function () {
      let mock = sinon.mock(siteUtil).expects("getRoadIntesity")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let roadIntesity = siteUtil.getRoadIntesity(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(roadIntesity.road_intensity).to.not.be.null;
      expect(roadIntesity.road_intensity).to.be.a("number");
    });
  });

  describe("get the road status", function() {
    it("it should return the road status", function () {
      let mock = sinon.mock(siteUtil).expects("getRoadStatus")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
      let roadStatus = siteUtil.getRoadStatus(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(roadStatus.roadStatus).to.not.be.null;
      expect(roadStatus.roadStatus).to.be.a("number");
    });
  });

  describe("get the land use", function () {
    let mock = sinon.mock(siteUtil).expects("getLandUse")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
    it("it should return the land use", function() {
      let landUse = siteUtil.getLandUse(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(landUse.landUse).to.not.be.null;
      expect(landUse.landUse).to.be.a("number");
    });
  });

  describe("generate the lat_long field", function () {
    let mock = sinon.mock(siteUtil).expects("generateLatLong")
        .withExactArgs(stubValue.latitude, stubValue.longitude).returns(stubValue);
    it("it should return the lat_long unique string of the specific site", function() {
      let latLong = siteUtil.generateLatLong(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(latLong).to.not.be.null;
      expect(latLong.lat_long).to.be.equal(stubValue.lat_long);
    });
  });
  
});
