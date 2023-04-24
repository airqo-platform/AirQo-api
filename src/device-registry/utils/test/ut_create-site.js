require("module-alias/register");
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
const HTTPStatus = require("http-status");
const siteModel = require("@utils/multitenancy");
const siteUtil = require("@utils/create-site");
const constants = require("@config/constants");
const axios = require("axios");
const { Client } = require("@googlemaps/google-maps-services-js");
const client = new Client({});
const axiosInstance = () => {
  return axios.create();
};
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
  lat_long: `${this.latitude}_${this.longitude}`,
  altitude: faker.datatype.float(),
  aspect: faker.datatype.float(),
  greenness: faker.datatype.float(),
  roadStatus: faker.datatype.float(),
  landUse: faker.datatype.float(),
  terrain:faker.datatype.float(),
  trafficFactor:faker.datatype.float(),
};
stubValue.name = stubValue.name.replaceAll(" ", "-");
stubValue.lat_long=`${stubValue.latitude}_${stubValue.longitude}`


describe("create Site utils", function () {

  beforeEach(() => {
    sinon.restore();
  });
  
  
  describe('create function', function(){
      let siteStub;
      const createStubResponse = {
        success: true,
        message: 'site created',
        data: stubValue,
        status: HTTPStatus.ACCEPTED,
      }
    siteStub = sinon.replace(siteModel, "getModelByTenant",sinon.fake).returns(createStubResponse);

    afterEach(() => {
      sinon.restore();
    })

    it('returns success with site data on successful creation', async function () {
      
      siteStub();
      const tenant = stubValue.tenant;
      generateNameStub= sinon.stub(siteUtil, "generateName").returns({
            success: true,
            message: "unique name generated for this site",
            data: stubValue.name,
            status: "",
      });
      validateNameStub = sinon.stub(siteUtil, "validateSiteName").returns(true);
      const req = {
        body: {
          name: stubValue.name,
          latitude: stubValue.latitude,
          longitude:stubValue.longitude,
          airqlouds: [],
          network: 'testNetwork',
          approximate_distance_in_km: stubValue.distance_to_nearest_city
        },
        query: {
          tenant: tenant
        }
      };
      const response = await siteUtil.create(tenant, req);
      expect(siteStub.calledOnce).to.be.true;
      expect(response.name).to.equal(createStubResponse.name);
      expect(response.latitude).to.equal(createStubResponse.latitude);
      expect(response.longitude).to.equal(createStubResponse.longitude);
      expect(response.network).to.equal(createStubResponse.network);
    }).timeout(5000);

    it('returns error message on invalid site name', async () => {
      const tenant = 'testTenant';
      const req = {
        body: {
          name: '',
          latitude: '12.34',
          longitude: '56.78',
          airqlouds: [],
          network: 'testNetwork',
          approximate_distance_in_km: 10
        },
        query: {
          tenant: tenant
        }
      };
      generateLatLongStub =sinon.stub(siteUtil,"generateLatLong").returns(stubValue.lat_long)

      const response = await siteUtil.create(tenant, req); 
      expect(response).to.deep.equal({
        message: "site name is invalid, please check documentation",
       success:false
      });
    });

    it('returns error message and errors on unsuccessful site creation', async () => {
      siteStub = sinon.replace(siteModel, "getModelByTenant",sinon.fake).returns({
          errors:'' ,
          message:'',
          success: false,
          status:'', 
      });
      const tenant = 'testTenant';
      const req = {
        body: {
          name: 'testSite',
          latitude: '12.34',
          longitude: '56.78',
          airqlouds: [],
          network: 'testNetwork',
          approximate_distance_in_km: 10
        },
        query: {
          tenant: tenant
        }
      };
      const response = await siteUtil.create(tenant, req);
      expect(response.success).to.equal(false);
    });
  });

  describe('list function', () => {
    sinon.restore()
    beforeEach(() => {
      sinon.restore();
    })
    
    const tenant = stubValue.tenant;
      const filter = { name: stubValue.name };
      const skip = 0;
      const limit = 100;
 
    const listStubResponse = {
      success: true,
      message: "successfully retrieved the site details",
      data: stubValue,
      status: "",
    };
    siteStub = sinon.replace(siteModel, "getModelByTenant", sinon.fake).returns(listStubResponse);
   
    it('should return modified response if success is true', async () => {
      

      siteStub();
      const response = await siteUtil.list({ tenant, filter, skip, limit });
      expect(siteStub.calledOnce).to.be.true;
      expect(response.success).to.deep.equal(listStubResponse.success);
    });

    it.skip('should return original response if success is false', async () => {
      siteStub=sinon.replace(siteModel, "getModelByTenant", sinon.fake).returns({
        success: false,
        message: 'Invalid request',
      });
      siteStub();
      const response = await siteUtil.list({ tenant, filter, skip, limit });
      expect(siteStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: 'Invalid request',
      });
    });

    it('should return error response if getModelByTenant throws an error', async () => {
  
      siteStub = sinon.replace(siteModel, "getModelByTenant", sinon.fake);
      siteStub();
      const response = await siteUtil.list("");
      expect(response.success).to.equal(false);
      expect(response.message).to.equal('Internal Server Error');
      expect(response.status).to.equal(HTTPStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update Site", function () {
    sinon.restore();
    const tenant = stubValue.tenant;
    const filter = { name: stubValue.name };
    const update = stubValue;
 
    const updateStubResponse = {
      success: true,
      message: "successfully modified the site",
      data: stubValue,
      status: HTTPStatus.OK,
    };
    siteStub = sinon.replace(siteModel, "getModelByTenant", sinon.fake).returns(updateStubResponse);
    
    it("should update the Site and return the updated details", async function () {

      const response = await siteUtil.list({ tenant, filter, update });
      expect(response.success).to.equal(updateStubResponse.success);
      expect(response.status).to.equal(HTTPStatus.OK);
    });
  });

  describe("delete Site", function () {
    sinon.restore();
    it("should delete the Site", async function() {
      siteStub = sinon.replace(siteModel, "getModelByTenant", sinon.fake).returns({
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      });

      const response= await siteUtil.delete(
        stubValue.tenant,
        stubValue.lat_long
      );
      siteStub();
      expect(siteStub.calledOnce).to.be.true;
      expect(response).to.deep.equal({
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      });
    });
  });
  /**
   *
   * @param {*} data
   * all the functions below are just utilised by the main CRUD operations
   * above during data insertion into the Site collection
   */

  describe("validate Site name", function () {
    

    it.skip("it should return true if the site name has no spaces", function () {     
      let isValid = siteUtil.hasWhiteSpace(stubValue.name);
      expect(isValid).to.be.true;
    });

    it("should return true if the site name is not longer than 50 characters and shorter than 4 characters", function () {
      let isValid = siteUtil.checkStringLength(stubValue.name);
      expect(isValid).to.be.true;
    });
  });

  describe.skip("format Site name", function() {
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

  describe("generate Site name", function () {
    
    beforeEach(() => {
      sinon.restore();
    })
 
    const tenant = "airqo";
 
    const generateStubResponse = {
      success: true,
      message: "unique name generated for this site",
      data: stubValue.name,
      status:HTTPStatus.OK,
    };
    siteStub = sinon.replace(siteModel, "getModelByTenant", sinon.fake).returns(generateStubResponse);
   
    it('should generate a unique site name given the parish name', async () => {

      const response = await siteUtil.generateName(tenant);
      expect(response.success).to.equal(generateStubResponse.success);
    });

    // it("should generate a unique site name given the parish name", function () {
      
    //   const stub = sinon
    //     .stub(siteModel(stubValue.tenant), "create")
    //     .returns(stubValue);

    //   const sites = siteUtil.getSite({});
    //   let numberOfSitesInNetwork = sites.length();
    //   let siteNameNumber = numberOfSitesInNetwork + 1;

    //   let generatedSiteName = siteUtil.generateName(stubValue.parish);

    //   expect(stub.calledOnce).to.be.true;

    //   assert.equal(
    //     generatedSiteName,
    //     `/${stubValue.parish}_${siteNameNumber}/i`,
    //     "the generated site name is the expected one"
    //   );
    // });
  });

  describe("Geo code", function() {
    sinon.restore()
    beforeEach(() => {
      sinon.restore();
    })
    
    const latitude = stubValue.latitude;
    const longitude = stubValue.longitude;
 
    const GeoCodeStubResponse = {
      success: true,
      message: "retrieved the Google address details of this site",
      data: stubValue,
    };
         
    it("it should return the details of the site given the GPS coords", async function () {
      siteStub = sinon.stub(siteUtil, "retrieveInformationFromAddress").returns(GeoCodeStubResponse);
 
      const response = await siteUtil.reverseGeoCode(latitude, longitude);
      expect(response).to.deep.equal(GeoCodeStubResponse);

    });
  });

  describe.skip("get the nearest distances", function () {
    // Missing functionality in create-sites-util
    it("it should return the nearest distances when provided with the GPS coordinates", function() {
      let nearestDistance = siteUtil.getDistance(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the land form details", function() {
    it("it should return the landform details", function () {
      let landform = siteUtil.getLandform(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe("get the altitude", function() {
    it("it should return the altitude details", async function () {
      let stubData;
      await client
        .elevation(
          {
            params: {
              locations: [{ lat: stubValue.latitude, lng: stubValue.longitude }],
              key: process.env.GOOGLE_MAPS_API_KEY,
            },
            timeout: 1000, // milliseconds
          },
          axiosInstance()
        )
        .then((r) => {
         
          stubData = r.data.results[0].elevation;
          
        });
      const altitudeStubResponse = {
      success: true,
      message: "successfully retrieved the altitude details",
      data: stubData,
      status: HTTPStatus.OK,
    };
      let response = await siteUtil.getAltitude(
        stubValue.latitude,
        stubValue.longitude,
      );
      expect(response).to.deep.equal(altitudeStubResponse);
    });
  });

  describe.skip("get the traffic factor", function() {
    it("it should return the traffic factor", function () {
      let trafficFactor = siteUtil.getTrafficFactor(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the greenness", function() {
    it("it should return the greenness number", function () {
      let greenness = siteUtil.getGreenness(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the terrain", function() {
    it("it should return the terrain", function () {
      let terrain = siteUtil.getTerrain(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the aspect", function() {
    it("it should return the get Aspect", function () {
      let aspect = siteUtil.getAspect(stubValue.latitude, stubValue.longitude);
     
    });
  });

  describe.skip("get the Road Intensity", function() {
    it("it should return the get Road Intensity", function () {
      let roadIntesity = siteUtil.getRoadIntesity(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the road status", function() {
    it("it should return the road status", function () {
  
      let roadStatus = siteUtil.getRoadStatus(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe.skip("get the land use", function () {
    it("it should return the land use", function() {
      let landUse = siteUtil.getLandUse(
        stubValue.latitude,
        stubValue.longitude
      );
    });
  });

  describe("generate the lat_long field", function () {
    
    it("it should return the lat_long unique string of the specific site", function() {
      let latLong = siteUtil.generateLatLong(
        stubValue.latitude,
        stubValue.longitude
      );
      expect(latLong).to.not.be.null;
      expect(latLong).to.be.equal(stubValue.lat_long);
    });
  });
  
});
