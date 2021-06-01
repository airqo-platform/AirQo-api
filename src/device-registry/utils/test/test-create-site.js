process.env.NODE_ENV = "development";

const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
chai.use(chaiHttp);
const SiteModel = require("../../models/Site");
const siteUtil = require("../create-site");

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
  city: faker.address.city(),
  road_intensity: faker.random.float(),
  distance_to_nearest_motor_way: faker.random.float(),
  distance_to_nearest_residential_area: faker.random.float(),
  distance_to_nearest_city: faker.random.float(),
  distance_to_nearest_road: faker.random.float(),
};

describe("create Site utils", function() {
  describe("create", function() {
    it("should create a new site", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "create")
        .returns(stubValue);

      const site = await siteUtil.createSite(
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
    });
  });

  describe("get Site", function() {
    it("should retrieve a Site that matches the provided ID", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "list")
        .returns(stubValue);

      let filter = { _id: stubValue._id };

      const site = await siteUtil.getSite(filter);
      expect(stub.calledOnce).to.be.true;
      expect(site._id).to.equal(stubValue._id);
      expect(site.name).to.equal(stubValue.name);
      expect(site.generated_name).to.equal(stubValue.generated_name);
      expect(site.formatted_name).to.equal(stubValue.formatted_name);
      expect(site.createdAt).to.equal(stubValue.createdAt);
      expect(site.updatedAt).to.equal(stubValue.updatedAt);
    });
  });

  describe("update Site", function() {
    it("should update the Site and return the updated details", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "update")
        .returns(stubValue);

      let body = stubValue;
      delete body._id;

      const updatedSite = await siteUtil.updateSite(stubValue._id, body);

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
    });
  });

  describe("delete Site", function() {
    it("should delete the Site", async function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "delete")
        .returns(stubValue);

      const updatedSite = await siteUtil.delete(stubValue._id);

      expect(stub.calledOnce).to.be.true;
      expect(updatedSite).to.not.be.empty;
      expect(updatedSite).to.be.a("object");
      assert.equal(updatedSite.success, true, "the site has been deleted");
    });
  });
  /**
   *
   * @param {*} data
   * all the functions below are just utilised by the main CRUD operations
   * above during data insertion into the Site collection
   */

  describe("validate Site name", function() {
    it("it should return true if the site name has no spaces", function() {
      let isValid = siteUtil.validateSiteName("yesMeQeaer");
      assert.equal(isValid, true, "the site Name has no spaces");
    });

    it("should return true if the site name is not longer than 15 characters", function() {
      let isValid = siteUtil.validateSiteName("qewr245245wegew");
      assert.equal(
        isValid,
        true,
        "the site Name is not longer than 15 characters"
      );
    });

    it("should return true if the site name if not shorter than 4 characters", function() {
      let isValid = siteUtil.validateSiteName("134141341");
      assert.equal(isValid, true, "the site name is longer than 4 characters");
    });
  });

  describe("format Site name", function() {
    it("should return a site name which is a combination + \
     of parish, county, region and/or city.+ \
      And all should be comma separated ", function() {
      const stub = sinon
        .stub(SiteModel(stubValue.tenant), "create")
        .returns(stubValue);

      let formattedSiteName = siteUtil.formatSiteName(
        stubValue.parish,
        stubValue.district,
        stubValue.region,
        stubValue.city
      );

      expect(stub.calledOnce).to.be.true;
      assert.equal(
        formattedSiteName,
        `${(stubValue.parish,
        stubValue.district,
        stubValue.region,
        stubValue.city)}`,
        "the formatted site name has been created"
      );
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

  describe("reverse geo code", function() {
    it("it should return the details of the site given the GPS coords", function() {
      let siteDetails = siteUtil.reverseGeoCode(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(siteDetails.county).to.be.a("string");
      expect(siteDetail.county).to.not.be.empty;
      expect(siteDetails.country).to.be.a("string");
      expect(siteDetail.country).to.not.be.empty;
      expect(siteDetails.city).to.be.a("string");
      expect(siteDetail.city).to.not.be.empty;
      expect(siteDetails.region).to.be.a("string");
      expect(siteDetail.region).to.not.be.empty;
      expect(siteDetails.district).to.be.a("string");
      expect(siteDetail.district).to.not.be.empty;
      expect(siteDetails.parish).to.be.a("string");
      expect(siteDetail.parish).to.not.be.empty;
    });
  });

  describe("reverse geo code", function() {
    it("it should return the details of the site given the GPS coords", function() {
      let siteDetails = siteUtil.reverseGeoCode(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(siteDetails.county).to.be.a("string");
      expect(siteDetail.county).to.not.be.empty;
      expect(siteDetails.country).to.be.a("string");
      expect(siteDetail.country).to.not.be.empty;
      expect(siteDetails.city).to.be.a("string");
      expect(siteDetail.city).to.not.be.empty;
      expect(siteDetails.region).to.be.a("string");
      expect(siteDetail.region).to.not.be.empty;
      expect(siteDetails.district).to.be.a("string");
      expect(siteDetail.district).to.not.be.empty;
      expect(siteDetails.parish).to.be.a("string");
      expect(siteDetail.parish).to.not.be.empty;
    });
  });

  describe("get the nearest distances", function() {
    it("it should return the nearest distances when provided with the GPS coordinates", function() {
      let nearestDisance = siteUtil.getDistance(
        stubValue.latitude,
        stubValue.longitude
      );

      expect(nearestDisance.distance_to_nearest_city).to.not.be.empty;
      expect(nearestDisance.distance_to_nearest_city).to.be.a("number");
      expect(nearestDisance.distance_to_nearest_motor_way).to.not.be.empty;
      expect(nearestDisance.distance_to_nearest_motor_way).to.be.a("number");
      expect(nearestDisance.distance_to_nearest_residential_area).to.not.be
        .empty;
      expect(nearestDisance.distance_to_nearest_residential_area).to.be.a(
        "number"
      );
      expect(nearestDisance.distance_to_nearest_road).to.not.be.empty;
      expect(nearestDisance.distance_to_nearest_road).to.be.a("number");
    });
  });

  describe("get the land form details", function() {
    it("it should return the landform details", function() {
      let landform = siteUtil.getLandform(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(landform.landform_90).to.not.be.empty;
      expect(landform.landform_90).to.be.a("number");
      expect(landform.landform_270).to.not.be.empty;
      expect(landform.landform_270).to.be.a("number");
    });
  });

  describe("get the altitude", function() {
    it("it should return the altitude details", function() {
      let altitude = siteUtil.getAltitude(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(altitude).to.not.be.empty;
      expect(altitude).to.be.a("number");
    });
  });

  describe("get the traffic factor", function() {
    it("it should return the traffic factor", function() {
      let trafficFactor = siteUtil.getTrafficFactor(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(trafficFactor).to.not.be.empty;
      expect(trafficFactor).to.be.a("number");
    });
  });

  describe("get the greenness", function() {
    it("it should return the greenness number", function() {
      let greenness = siteUtil.getGreenness(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(greenness).to.not.be.empty;
      expect(greenness).to.be.a("number");
    });
  });

  describe("get the terrain", function() {
    it("it should return the terrain", function() {
      let terrain = siteUtil.getTerrain(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(terrain).to.not.be.empty;
      expect(terrain).to.be.a("number");
    });
  });

  describe("get the aspect", function() {
    it("it should return the get Aspect", function() {
      let aspect = siteUtil.getAspect(stubValue.latitude, stubValue.longitude);
      expect(aspect).to.not.be.empty;
      expect(aspect).to.be.a("number");
    });
  });

  describe("get the aspect", function() {
    it("it should return the get Aspect", function() {
      let roadIntesity = siteUtil.getRoadIntesity(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(roadIntesity).to.not.be.empty;
      expect(roadIntesity).to.be.a("number");
    });
  });

  describe("get the road status", function() {
    it("it should return the road status", function() {
      let roadStatus = siteUtil.getRoadStatus(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(roadStatus).to.not.be.empty;
      expect(roadStatus).to.be.a("number");
    });
  });

  describe("get the land use", function() {
    it("it should return the land use", function() {
      let landUse = siteUtil.getLandUse(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(landUse).to.not.be.empty;
      expect(landUse).to.be.a("number");
    });
  });

  describe("generate the lat_long field", function() {
    it("it should return the lat_long string of the device", function() {
      let latLong = siteUtil.generateLatLong(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(latLong).to.not.be.empty;
      expect(latLong).to.be.a("string");
    });
  });
});
