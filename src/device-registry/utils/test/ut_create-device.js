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
const deviceModel  = require("@utils/multitenancy");
const deviceUtil = require("@utils/create-device");
const generateFilter = require("@utils/generate-filter");

const stubValue = {
  _id: faker.datatype.uuid(),
  name:faker.name.findName(),
  createdAt: faker.date.past(),
  updatedAt: faker.date.past(),
  visibility: faker.datatype.boolean(),
  mobility: faker.datatype.boolean(),
  height: 0,
  status: "not deployed",
  isPrimaryInLocation: faker.datatype.boolean(),
  category: "lowcost",
  isActive: faker.datatype.boolean(),
  generation_version: 34,
  generation_count: 3,
  device_number: faker.datatype.number(),
  writeKey: faker.random.words(),
  readKey: faker.random.words(),
  deployment_date:faker.date.past(),
  maintenance_date: faker.date.past(),
  recall_date: faker.date.past(),
};

describe("Create Device util", function() {
  
  describe('create Device', () => {

    it('should return an error if the request tenant is not "airqo"', async () => {
      const request = { query: { tenant: 'other' } };
      const result = await deviceUtil.create(request);
      expect(result.success).to.equal(false);
      expect(result.message).to.equal('creation is not yet possible for this organisation');
      expect(result.status).to.equal(501);
    });

    it('should create a device on the platform if the request tenant is "airqo" and enrichment data is available', async () => {
      const request = { query: { tenant: 'airqo' } };
      const createOnThingSpeak = sinon.stub(deviceUtil, 'createOnThingSpeak')
        .returns({
          success: true,
          message: "successfully created the device on thingspeak",
          data: stubValue
        });
      const createOnPlatform = sinon.stub(deviceUtil, 'createOnPlatform')
         .returns({
          success: true,
          message: "successfully created the device",
          data: stubValue,
          status: HTTPStatus.CREATED,
        });
        
      const result = await deviceUtil.create(request);
      expect(result).to.deep.equal({
        success: true,
        message: "successfully created the device",
        data: stubValue,
        status: HTTPStatus.CREATED,
      });
      
    });

    it('should delete the device from ThingSpeak and return an error if creating the device on the platform fails', async () => {
      
      sinon.restore();
      const request = { query: { tenant: 'airqo' } };
      const createOnThingSpeak = sinon.stub(deviceUtil, 'createOnThingSpeak')
        .returns({
          success: true,
          message: "successfully created the device on thingspeak",
          data: stubValue
        });
      const createOnPlatform = sinon.stub(deviceUtil, 'createOnPlatform')
         .returns({
          success: false,
          message: "creation operation failed ",
          data: stubValue,
          status: ''
         });
      const deleteOnThingspeak = sinon.stub(deviceUtil, 'deleteOnThingspeak')
         .returns({
          success: true,
          message: "creation operation failed -- successfully undid the successfull operations",
          data: stubValue,
          status: '',
        });
        
      const result = await deviceUtil.create(request);
      expect(result.success).to.equal(false);
      expect(result.message).to.equal('creation operation failed -- successfully undid the successfull operations');
    });


  });

  describe("Update Device", function () {
    let request;
    let listStub;
    let updateOnPlatformStub;
    let updateOnThingspeakStub;

    beforeEach(() => {
      request = {
        query: {
        },
      };

      listStub = sinon.stub(deviceUtil, 'list');
      updateOnPlatformStub = sinon.stub(deviceUtil, 'updateOnPlatform');
      updateOnThingspeakStub = sinon.stub(deviceUtil, 'updateOnThingspeak');
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should update device on platform if device_number is not provided', async () => {

      listStub.returns({
        success: true,
        message: "successfully retrieved the device details",
        data:[stubValue],
        status: HTTPStatus.OK,
      });

      updateOnPlatformStub.returns({
        success: true,
        message: "successfully modified the device",
        data:stubValue,
        status: HTTPStatus.OK,
      });

      const response = await deviceUtil.update(request);

      sinon.assert.calledOnce(listStub);
      sinon.assert.notCalled(updateOnThingspeakStub);
      expect(response.success).to.be.true;
    });

    it('should update device on Thingspeak and platform if device_number is provided and update on Thingspeak is successful', async () => {
      request.query.device_number = stubValue.device_number;

      updateOnThingspeakStub.returns({
        success: true,
        message: "successfully modified the device",
        data:stubValue,
        status: HTTPStatus.OK,
      });

      updateOnPlatformStub.returns({
        success: true,
        message: "successfully modified the device",
        data:stubValue,
        status: HTTPStatus.OK,
      });

      const response = await deviceUtil.update(request);

      sinon.assert.notCalled(listStub);
      sinon.assert.calledOnce(updateOnThingspeakStub);
      sinon.assert.calledOnce(updateOnPlatformStub);

      expect(response.success).to.be.true;
    });

    it('should return error if device_number is not provided and list device fails', async () => {
      listStub.resolves({
        success: false,
        message: 'List device failed',
      });

      const response = await deviceUtil.update(request);

      sinon.assert.calledOnce(listStub);
      sinon.assert.notCalled(updateOnPlatformStub);
      sinon.assert.notCalled(updateOnThingspeakStub);
      expect(response.success).to.be.false;
      expect(response.message).to.equal('List device failed');
    });

    it('should return error if device_number is provided and update on Thingspeak fails', async () => {
      request.query.device_number = stubValue.device_number;

      updateOnThingspeakStub.resolves({
        success: false,
      });

      const response = await deviceUtil.update(request);

      sinon.assert.notCalled(listStub);
      sinon.assert.calledOnce(updateOnThingspeakStub);
      sinon.assert.notCalled(updateOnPlatformStub);

      expect(response.success).to.be.false;
    });

    it('should return error if any error occurs', async () => {
      const errorMessage = 'Something went wrong';
     listStub.throws(new Error(errorMessage));

      const response = await deviceUtil.update(request);

      sinon.assert.calledOnce(listStub);
      sinon.assert.notCalled(updateOnThingspeakStub);
      sinon.assert.notCalled(updateOnPlatformStub);

      expect(response.success).to.be.false;
      expect(response.message).to.equal('Internal Server Error');
      expect(response.errors.message).to.equal(errorMessage);
      expect(response.status).to.equal(500);
    });

  });

describe('list function', () => {
  let request;
  beforeEach(() => {
    request = {
      query: {
        tenant: 'airqo',
        limit: 10,
        skip: 0,
      },
    };
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should return the device list', async () => {
    
    const generateFilterStub = sinon.stub(generateFilter,"devices").returns({
      success: true,
      message: "successfully generated the filter",
      data: stubValue,
    });

    const result = await deviceUtil.list(request);
    expect(result.success).to.equal(true);
    expect(generateFilterStub.calledOnce).to.be.true;
  });

  it.skip('should return an error message if getModelByTenant fails', async () => {
    const getModelByTenantStub = sinon.stub(deviceModel,"getModelByTenant").returns({
      success: false,
      message: "Failed to retrieve the device details",
      data:"",
      status:" ",
    });
     const generateFilterStub = sinon.stub(generateFilter,"devices").returns({
      success: true,
      message: "successfully generated the filter",
      data: stubValue,
     });

    const result = await deviceUtil.list(request, {
      getModelByTenant: getModelByTenantStub,
      generateFilter: generateFilterStub,
    });
    expect(getModelByTenantStub.calledOnce).to.be.true;
    expect(generateFilterStub.calledOnce).to.be.true;
    expect(result).to.deep.equal({
      success: false,
      message: 'getModelByTenant failed',
      errors: { message: '' },
      status: '',
    });
    
  });

  it('should return an error message if generateFilter fails', async () => {
    const getModelByTenantStub = sinon.stub(deviceModel,"getModelByTenant").resolves({
      success: true,
      data: [{ device_number: '123' }],
    });
    const generateFilterStub = sinon.stub(generateFilter,"devices").returns({
      success: false,
      message: 'generateFilter failed',
    });

    const result = await deviceUtil.list(request, {
      getModelByTenant: getModelByTenantStub,
      generateFilter: generateFilterStub,
    });

    expect(result).to.deep.equal({
      success: false,
      message: 'generateFilter failed',
      errors: { message: '' },
      status: '',
    });
    expect(generateFilterStub.calledOnce).to.be.true;
  });
});


  describe("Delete Device", function () {
    it("Should return feature disabled until device functionality is created", async function () {
      request = {
        query: {
        },
      };
      const response = await deviceUtil.delete(request);
      expect(response).to.deep.equal({
        success: false,
        message: "feature temporarity disabled --coming soon",
        status: HTTPStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      });
    });
    
  });

});
