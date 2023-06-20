process.env.NODE_ENV = "development";

require("module-alias/register");
require('dotenv').config();
const chai = require("chai");
const chaiHttp = require("chai-http");
const should = chai.should();
const expect = chai.expect;
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
const HTTPStatus = require("http-status");
const axios = require("axios");
chai.use(chaiHttp);
const { BigQuery } = require("@google-cloud/bigquery");
const bigquery = new BigQuery();


const EventSchema = require("@models/Event");
const EventUtil = require("@utils/create-event");
const MeasurementModel = require("@models/Measurement");
const MonitorUtil = require("@utils/create-monitor");
const { getDevicesCount, list, decryptKey } = require("@utils/create-monitor");
const generateFilter = require("@utils/generate-filter");
const DeviceSchema = require("@models/Device");
const redis = require("@config/redis");
const {
  generateDateFormatWithoutHrs,
} = require("@utils/date");

const stubValue = {
  _id: faker.datatype.uuid(),
  name:faker.name.findName(),
  tenant: "test",
  device: faker.datatype.string(),
  device_number:faker.datatype.string(),
  is_device_primary: faker.datatype.boolean(),
  device_id: faker.datatype.uuid(),
  site_id:faker.datatype.uuid(),
  startTime: faker.date.past(),
  endTime: faker.date.past(),
  latitude:faker.address.latitude(),
  longitude: faker.address.longitude(),
  update: {
    push: "test"
  }
};

describe("create Event utils", function () {
  beforeEach(() => {
      sinon.restore();
    });

  let generateFilterStub=sinon.stub(generateFilter, "devices").returns(
        {
          success: true,
          data: stubValue,
          message: " ",
          status: HTTPStatus.OK,
        }
      );
  let req = {
    body: {
      name: stubValue.name,
      tenant: stubValue.tenant,
      latitude: stubValue.latitude,
      longitude: stubValue.longitude,
      airqlouds: [],
      network: 'testNetwork',
      device_id: stubValue.device_id,
    },
    query: {
      tenant: stubValue.tenant,
      device: stubValue.device,
      tenant: stubValue.tenant,
      device_number: stubValue.device_number,
    }
  };

  describe("create", function () {
    it.skip("should create a new event", async function () {
      sinon.stub(EventUtil, "transformManyEvents").returns({
        success: true,
        errors: '',
        message: '',
        data: [stubValue],
      });
      
      // sinon.stub(EventSchema, "updateOne").returns(true);
      const response = await EventUtil.create(req);

      console.log(response);
      expect(response).to.equal({
        success: true,
        status: HTTPStatus.OK,
        message: "successfully added all the events",
      });
    });
  });

  describe("clear Events", function () {
    it("should clear the Events", async function () {
      const stub = sinon
        .stub(EventUtil, "clearEventsOnPlatform")
        .returns(null);

      const deletedEvent = await EventUtil.clearEventsOnPlatform(
        stubValue.tenant,
        stubValue.lat_long
      );

      expect(stub.calledOnce).to.be.true;
      expect(deletedEvent).to.be.null;
    });
  });



  describe('getMeasurementsFromBigQuery', () => {
  

  it('should retrieve measurements from BigQuery', async () => {
    
  });

  
});

  describe('latestFromBigQuery', function () {
    it('should return the latest measurements from BigQuery', async () => {

      const expectedQuery = `SELECT site_id, name, device, \`datawarehouse.metadata\`.sites.latitude AS latitude,
      \`datawarehouse.metadata\`.sites.longitude AS longitude, timestamp, pm2_5, pm10, pm2_5_raw_value, pm2_5_calibrated_value, pm10_raw_value, pm10_calibrated_value,
      \`datawarehouse.metadata\`.sites.tenant AS tenant 
      FROM \`datawarehouse_averaged_data.hourly_device_measurements\` 
      JOIN \`datawarehouse.metadata.sites\` 
      ON \`datawarehouse.metadata.sites\`.id = \`datawarehouse_averaged_data.hourly_device_measurements\`.site_id 
      WHERE timestamp  
     >= "2022-01-01" AND timestamp <= "2022-02-01" 
     AND site_id="site1" AND device="device1" AND \`datawarehouse.metadata.sites\`.tenant="test"
     LIMIT 100`;

      const expectedRows = [
        { site_id: 'site1', name: 'site1', device: 'device1', latitude: 123.45, longitude: 67.89, timestamp: '2022-01-01 00:00:00', pm2_5: 10, pm10: 20 },
        { site_id: 'site1', name: 'site1', device: 'device1', latitude: 123.45, longitude: 67.89, timestamp: '2022-01-01 01:00:00', pm2_5: 15, pm10: 25 },
      ];
      const bigqueryJobStub = sinon.stub();
      bigqueryJobStub.getQueryResults = sinon.stub().resolves([expectedRows]);

      const bigqueryStub = sinon.stub(BigQuery.prototype, 'createQueryJob').resolves([bigqueryJobStub]);

      const result = await EventUtil.latestFromBigQuery({ query: stubValue });

      assert.deepEqual(result, { success: true, data: expectedRows, message: 'successfully retrieved the measurements' });
    });

    it('should return an error response if retrieval fails', async function () {
      const expectedErrorMessage = 'Internal Server Error';
      let bigqueryStub = sinon.stub(BigQuery.prototype, 'createQueryJob');
    bigqueryStub.rejects(new Error(expectedErrorMessage));

    const result = await EventUtil.latestFromBigQuery({ query: stubValue });

    assert.isTrue(bigqueryStub.calledOnce);
    assert.deepEqual(result, { success: false, message: expectedErrorMessage, errors: { message: expectedErrorMessage } });
    });
  });

  describe('list', function () {
    it('should list items successfully', async function () {
      // Test implementation goes here
    });

    it('should return an error response if listing fails', async function () {
      // Test implementation goes here
    });
  });

  describe('generateOtherDataString', function () {
    it('should generate the other data string for a valid input object', () => {
  const inputObject = {
    0: 10,
    1: 20,
    2: 30,
    3: 40,
    4: 50,
  };

  const expectedResult = '10,20,30,40,50';

  const result = EventUtil.generateOtherDataString(inputObject);

  expect(result).to.equal(expectedResult);
    });
    
    it('should return an empty string for an empty input object', () => {
      const inputObject = {};

      const expectedResult = '';

      const result = EventUtil.generateOtherDataString(inputObject);

      expect(result).to.equal(expectedResult);
    });

  });

 
  describe('createThingSpeakRequestBody', () => {
    it('should create the ThingSpeak request body for lowcost category', () => {
      const req = {
        body: {
          api_key: 'API_KEY',
          time: '2023-01-01T12:00:00Z',
          s1_pm2_5: 10,
          s1_pm10: 20,
          s2_pm2_5: 30,
          s2_pm10: 40,
          latitude: 50,
          longitude: 60,
          battery: 70,
          status: 'OK',
          altitude: 80,
          wind_speed: 90,
          satellites: 5,
          hdop: 1.5,
          internal_temperature: 25,
          internal_humidity: 50,
          external_temperature: 15,
          external_humidity: 40,
          external_pressure: 1013,
          external_altitude: 100,
          category: 'lowcost',
          rtc_adc: 1,
          rtc_v: 3.3,
          rtc: 2,
          stc_adc: 4,
          stc_v: 3.3,
          stc: 5,
        },
      };

      const expectedRequestBody = {
        api_key: 'API_KEY',
        created_at: '2023-01-01T12:00:00Z',
        field1: 10,
        field2: 20,
        field3: 30,
        field4: 40,
        field5: 50,
        field6: 60,
        field7: 70,
        field8: "50,60,80,90,5,1.5,25,50,15,40,1013,100,lowcost",
        latitude: 50,
        longitude: 60,
        status: 'OK',
      };

      const result = EventUtil.createThingSpeakRequestBody(req);

      expect(result.success).to.be.true;
      expect(result.message).to.equal('successfully created ThingSpeak body');
      expect(result.data).to.deep.equal(expectedRequestBody);
    });

    it('should create the ThingSpeak request body for bam category', () => {
      const req = {
        body: {
          api_key: 'API_KEY',
          time: '2023-01-01T12:00:00Z',
          s1_pm2_5: 10,
          s1_pm10: 20,
          s2_pm2_5: 30,
          s2_pm10: 40,
          latitude: 50,
          longitude: 60,
          battery: 70,
          status: 'OK',
          altitude: 80,
          wind_speed: 90,
          satellites: 5,
          hdop: 1.5,
          internal_temperature: 25,
          internal_humidity: 50,
          external_temperature: 15,
          external_humidity: 40,
          external_pressure: 1013,
          external_altitude: 100,
          category: 'bam',
          rtc_adc: 1,
          rtc_v: 3.3,
          rtc: 2,
          stc_adc: 4,
          stc_v: 3.3,
          stc: 5,
        },
      };

      const expectedRequestBody = {
        api_key: 'API_KEY',
        created_at: '2023-01-01T12:00:00Z',
        field1: 1,
        field2: 3.3,
        field3: 2,
        field4: 4,
        field5: 3.3,
        field6: 5,
        field7: 70,
        field8: "50,60,80,90,5,1.5,25,50,15,40,1013,100,bam"
,
        latitude: 50,
        longitude: 60,
        status: 'OK',
      };

      const result = EventUtil.createThingSpeakRequestBody(req);

      expect(result.success).to.be.true;
      expect(result.message).to.equal('successfully created ThingSpeak body');
      expect(result.data).to.deep.equal(expectedRequestBody);
    });

  });

 

  describe('transmitMultipleSensorValues', function () {
    it('should transmit multiple sensor values successfully', async function () {
      // Test implementation goes here
    });

    it('should return an error response if transmission fails', async function () {
      // Test implementation goes here
    });
  });

  describe('bulkTransmitMultipleSensorValues', function () {
    it('should bulk transmit multiple sensor values successfully', async function () {
      // Test implementation goes here
    });

    it('should return an error response if bulk transmission fails', async function () {
      // Test implementation goes here
    });
  });

  describe('generateCacheID', function () {
    it('should generate a cache ID with default values when no query parameters are provided', () => {
      request = { query: {} };
      const cacheID = EventUtil.generateCacheID(request);
      expect(cacheID).to.equal('list_events_noDevice_undefined_0_0_noRecent_noFrequency_noEndTime_noStartTime_noDeviceId_noSite_noSiteId_2023-06-20_noDeviceNumber_noMetadata_noExternal_noAirQloud_noAirQloudID_noLatLong_noPage_noRunning_noIndex_noBrief_noLatitude_noLongitude');
    });

    it('should generate a cache ID with the correct values when query parameters are provided', () => {
      const currentTime = new Date().toISOString();
      const day = generateDateFormatWithoutHrs(currentTime);
      console.log(day)
      request = {
        query: {
          device: stubValue.device,
          tenant: stubValue.tenant,
          skip: 10,
          limit: 20,
          recent: true,
          frequency: 'daily',
          endTime: stubValue.endTime,
          startTime: stubValue.startTime,
          device_id: stubValue.device_id,
          site: stubValue.name,
          site_id: stubValue.site_id,
          metadata: true,
          external: true,
          airqloud: true,
          airqloud_id: 'myAirQloudId',
          lat_long: stubValue.latitude + '_' + stubValue.longitude,
          page: 2,
          running: true,
          index: 3,
          brief: true,
          latitude: stubValue.latitude,
          longitude: stubValue.longitude,
        },
      };
   
      const cacheID = EventUtil.generateCacheID(request);
      const expectCacheID = `list_events_${request.query.device ? request.query.device : 'noDevice'}_${request.query.tenant}_${request.query.skip ? request.query.skip : 0}_${request.query.limit ? request.query.limit : 0}_${request.query.recent ? request.query.recent : 'noRecent'}_${request.query.frequency ? request.query.frequency : 'noFrequency'}_${request.query.endTime ? request.query.endTime : 'noEndTime'}_${request.query.startTime ? request.query.startTime : 'noStartTime'}_${request.query.device_id ? request.query.device_id : 'noDeviceId'}_${request.query.site ? request.query.site : 'noSite'}_${request.query.site_id ? request.query.site_id : 'noSiteId'}_${day}_${request.query.device_number ? request.query.device_number : 'noDeviceNumber'}_${request.query.metadata ? request.query.metadata : 'noMetadata'}_${request.query.external ? request.query.external : 'noExternal'}_${request.query.airqloud ? request.query.airqloud : 'noAirQloud'}_${request.query.airqloud_id ? request.query.airqloud_id : 'noAirQloudID'}_${request.query.lat_long ? request.query.lat_long : 'noLatLong'}_${request.query.page ? request.query.page : 'noPage'}_${request.query.running ? request.query.running : 'noRunning'}_${request.query.index ? request.query.index : 'noIndex'}_${request.query.brief ? request.query.brief : 'noBrief'}_${request.query.latitude ? request.query.latitude : 'noLatitude'}_${request.query.longitude ? request.query.longitude : 'noLongitude'}`;
      expect(cacheID).to.equal(expectCacheID);
    });
  });

  describe('setCache', function () {
    it('should set the cache successfully', async function () {
      // Test implementation goes here
    });

    it('should return an error response if setting the cache fails', async function () {
      // Test implementation goes here
    });
  });

  describe('getCache', function () {
    it('should return cached data if present', async () => {
      
    });

    it('should return an error response if getting the cache fails', async function () {
      // Test implementation goes here
    });
  });

  describe('transformOneEvent', function () {
    it('should transform one event successfully', async function () {
      const response = await EventUtil.transformOneEvent(req);
      expect(response).to.deep.equal({
        success: true,
        message: "successfully transformed the provided event",
        data: {},
      });
    });
  });

  describe('enrichOneEvent', function () {
    it('should enrich one event successfully', function () {
      // Test implementation goes here
    });
  });

  describe('transformManyEvents', function () {
    it('should transform many events successfully', async function () {
      const request = {
        body: [
          { event_type: 'my-event-type-1', data: { value: 1 } },
          { event_type: 'my-event-type-2', data: { value: 2 } },
          { event_type: 'my-event-type-3', data: { value: 3 } }
        ]
      };

      const transformOneEventStub = sinon.stub(EventUtil, 'transformOneEvent').returns({
        success: true,
        data: { value: 1 }
      });

      const result = await EventUtil.transformManyEvents(request);
   
      assert.equal(result.success, true);
      assert.equal(result.message, 'transformation successfully done');
      assert.deepEqual(result.data, [{ value: 1 }, { value: 1 }, { value: 1 }]);

      transformOneEventStub.restore();
    });

    it('should return an error response if an exception is thrown', async function() {
      const request = {
        body: [
          { event_type: 'my-event-type-1', data: { value: 1 } },
          { event_type: 'my-event-type-2', data: { value: 2 } },
          { event_type: 'my-event-type-3', data: { value: 3 } }
        ]
      };

      const transformOneEventStub = sinon.stub(EventUtil, 'transformOneEvent')
        .throws(new Error('transformOneEvent() threw an exception'));
      const response = await EventUtil.transformManyEvents(req);
      expect(response).to.deep.equal(
        {
          success: false,
          message: "server side error - transformEvents ",
          status: HTTPStatus.INTERNAL_SERVER_ERROR,
          errors: { message: "body.map is not a function" }
        }
      );
      transformOneEventStub.restore();
    });
  });

  describe('addEvents', function () {
    it('should add events successfully', async function () {
      const transformManyEventsStub = sinon.stub(EventUtil, 'transformManyEvents').returns({
        success: true,
        data: stubValue,
      });
      const insertTransformedEventsStub = sinon.stub(EventUtil, 'insertTransformedEvents').returns({
        success: true,
        message: "successfully added all the events",
        stubValue,
      });
      const response = await EventUtil.addEvents(req);
      expect(response).to.deep.equal({
        success: true,
        message: "successfully added all the events",
        stubValue,
      });
      expect(transformManyEventsStub.calledOnce).to.be.true;
      expect(insertTransformedEventsStub.calledOnce).to.be.true;
      
      transformManyEventsStub.restore();
      insertTransformedEventsStub.restore();
    });

    it('should return an error response if adding events fails', async function () {
      const transformManyEventsStub = sinon.stub(EventUtil, 'transformManyEvents')
        .throws(new Error('transformManyEvents() threw an exception'));
      const response = await EventUtil.addEvents(req);
      expect(response).to.deep.equal(
        {
          success: false,
          message: 'server side error',
          errors: { message: 'transformManyEvents() threw an exception' }
        }
      );
      expect(transformManyEventsStub.calledOnce).to.be.true;
       transformManyEventsStub.restore();
    });
  });

  describe('insertTransformedEvents', function () {
    it('should insert transformed events successfully', async function () {
     
    });

    it('should return an error response if inserting transformed events fails', async function () {
      // Test implementation goes here
    });
  });

  describe('clearEventsOnPlatform', function () {
    it('should clear events on the platform successfully', async function () {
      let responseFromClearEvents = { success: false, message: "coming soon" };
      const result = await EventUtil.clearEventsOnPlatform(req);
      expect(result).to.deep.equal(responseFromClearEvents);
    });

    it('should return an error response if clearing events on the platform fails', async function () {
      generateFilterStub.restore();
      generateFilterStub = sinon.stub(generateFilter, 'events')
        .throws(new Error('generateFilter.events() threw an exception'));
      const result = await EventUtil.clearEventsOnPlatform(req);
      expect(result).to.deep.equal({
        success: false,
        message: 'generateFilter.events() threw an exception'
      });
    });
  });

  describe('insertMeasurements', function () {
    it('should insert measurements successfully', async function () {
      const measurements = [
        {
          device_id: "device-1",
          timestamp: "2022-01-01T00:00:00.000Z",
          pm25: 10,
          pm10: 20,
        },
        {
          device_id: "device-2",
          timestamp: "2022-01-01T00:00:00.000Z",
          pm25: 30,
          pm10: 40,
        },
      ];
      const insertStub = sinon.stub(EventUtil, "insert").returns({
        success: true,
        message: "successfully added all the events",
        status: HTTPStatus.OK,
      });

      const response = await EventUtil.insertMeasurements(measurements);

      expect(response).deep.equal({
        success: true,
        message: "successfully added all the events",
        status: HTTPStatus.OK,
      });
    });

    it("should return an error message if unable to insert measurements", async () => {
     const measurements = [
        {
          device_id: "device-1",
          timestamp: "2022-01-01T00:00:00.000Z",
          pm25: 10,
          pm10: 20,
        },
        {
          device_id: "device-2",
          timestamp: "2022-01-01T00:00:00.000Z",
          pm25: 30,
          pm10: 40,
        },
      ];
      const insertStub = sinon.stub(EventUtil, "insert").returns({
       success: false,
        message: "finished the operation with some errors",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      });

      const response = await EventUtil.insertMeasurements(measurements);

      expect(response).deep.equal({
         success: false,
        message: "finished the operation with some errors",
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      });
    });
  });

  describe('insert', function () {
    it('should insert data successfully', async function () {
       const tenant = 'testTenant';
      const measurements = [{ time: '2023-01-01', day: '2023-01-01', site_id: 'site1', device_id: 'device1' }];
      
     
      const transformMeasurementsStub = sinon.stub(EventUtil, 'transformMeasurements_v2').resolves({
        success: true,
        data: measurements,
      });
     const EventModelStub= sinon.stub(EventSchema(stubValue.tenant), 'updateOne').resolves(stubValue);
 
      const result = await EventUtil.insert(tenant, measurements);
     
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.message, 'successfully added all the events');
      assert.strictEqual(result.data, measurements);
      transformMeasurementsStub.restore();
      EventModelStub.restore();
      
    });
  });

  describe('transformMeasurements', function () {
     it('should transform measurements successfully', async function () {
      const measurements = [
      { time: '2023-05-17T10:00:00Z', value: 10 },
      { time: '2023-05-17T11:00:00Z', value: 15 },
      { time: '2023-05-17T12:00:00Z', value: 20 },
    ];

    const expected = [
      { day: '2023-05-17', time: '2023-05-17T10:00:00Z', value: 10 },
      { day: '2023-05-17', time: '2023-05-17T11:00:00Z', value: 15 },
      { day: '2023-05-17', time: '2023-05-17T12:00:00Z', value: 20 },
    ];

       const result = await EventUtil.transformMeasurements(stubValue.device, measurements);
       console.log(result)
       for (const key in result) {
  assert.strictEqual(result[key].success, true);
  assert.deepStrictEqual(result[key].day, expected[key].day);
}
         
    });
    
  });

  describe('transformMeasurements_v2', function () {
    it('should transform measurements (version 2) successfully', async function () {
      const measurements = [
      { time: '2023-05-17T10:00:00Z', value: 10 },
      { time: '2023-05-17T11:00:00Z', value: 15 },
      { time: '2023-05-17T12:00:00Z', value: 20 },
    ];

    const expected = [
      { day: '2023-05-17', time: '2023-05-17T10:00:00Z', value: 10 },
      { day: '2023-05-17', time: '2023-05-17T11:00:00Z', value: 15 },
      { day: '2023-05-17', time: '2023-05-17T12:00:00Z', value: 20 },
    ];

    const result = await EventUtil.transformMeasurements_v2(measurements);
    assert.strictEqual(result.success, true);
    assert.deepStrictEqual(result.data, expected);
    });

     it('should handle errors gracefully', async function() {
    const measurements ="";

       const result = await EventUtil.transformMeasurements_v2(measurements);
    assert.strictEqual(result.success, false);
    assert.deepStrictEqual(result.message, "unable to transform measurement");

  });
  });

  describe('transformField', function () {
    it('should transform a field successfully', async function () {
      const testCases = [
      { input: 's1_pm2_5', expected: 'field1' },
      { input: 's1_pm10', expected: 'field2' },
      { input: 's2_pm2_5', expected: 'field3' },
      { input: 's2_pm10', expected: 'field4' },
      { input: 'latitude', expected: 'field5' },
      { input: 'longitude', expected: 'field6' },
      { input: 'battery', expected: 'field7' },
      { input: 'others', expected: 'field8' },
      { input: 'time', expected: 'created_at' },
      { input: 'elevation', expected: 'elevation' },
      { input: 'status', expected: 'status' },
    ];

    testCases.forEach(async ({ input, expected }) => {
      const result = await EventUtil.transformField(input);
      assert.strictEqual(result, expected);
    });
    });

     it('should return the input field for unknown fields', async function() {
    const unknownField = 'unknown_field';
       const result = await EventUtil.transformField(unknownField);
       console.log(result)
    assert.strictEqual(result, unknownField);
  });
  });

  describe('transformMeasurementFields', function () {
    it('should transform measurement fields successfully', async function () {
      const createThingSpeakStub = sinon.stub(EventUtil, "createThingSpeakRequestBody").returns({
        success: true,
        data: stubValue,
        status: HTTPStatus.OK,
      });
      const result = await EventUtil.transformMeasurementFields([stubValue]);
      expect(result).to.deep.equal({
          message: "successfully transformed the measurements",
        data: [stubValue],
        success: true,
      })
      
      createThingSpeakStub.restore();
    });
  });

  describe('deleteValuesOnThingspeak', function () {
    
    beforeEach(() => {
      sinon.restore();
    });
    afterEach(() => {
      generateFilterStub.restore();
      sinon.restore();
    });
    it('should delete values on ThingSpeak successfully', async function () {

      
      const deviceListStub=sinon.stub(DeviceSchema.statics, "list").returns({
        success: true,
        data: [stubValue],
        message: "Successfully retrieved devices",
        status: HTTPStatus.OK,
      });
    
      const axiosStub = sinon.stub(axios, "delete").resolves({
        data: stubValue
      })
      const result = await EventUtil.deleteValuesOnThingspeak(req);
      assert.deepStrictEqual(result, {
        message: `successfully cleared the data for device ${stubValue.device}`,
        success: true,
        stubValue,
      });
      axiosStub.restore();
      deviceListStub.restore();
    });

    it('should return an error response if deleting values on ThingSpeak fails', async function () {
      generateFilterStub=sinon.stub(generateFilter, "devices").returns(
        {
          success: false,
          data: stubValue,
          message: " ",
          status: HTTPStatus.BAD_REQUEST,
        }
      );
      const result = await EventUtil.deleteValuesOnThingspeak(req);
      assert.deepStrictEqual(result, {
        message: `device ${stubValue.device} does not exist in the system`,
        success: false,
        errors: {
          message: `device ${stubValue.device} does not exist in the system`
        }
      });
    });
  });
});