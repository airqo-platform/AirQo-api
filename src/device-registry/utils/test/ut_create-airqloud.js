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
const geolib = require("geolib");
const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: "airqloud-service",
  brokers: "brokers:9092",
});

const airqloudUtil = require("@utils/create-airqloud");
const locationUtil = require("@utils/create-location");
const AirQloudSchema = require("@models/Airqloud");

const generateFilter = require("@utils/generate-filter");


const stubValue = {
    tenant: "airqo",
    airqloud_codes: [],
    long_name: faker.name.findName(),
    airqloud_tags: [faker.datatype.string(), faker.datatype.string()],
    admin_level: "country",
    airqloud: faker.name.findName(),
    id: faker.datatype.uuid(),
    createdAt: faker.date.past(),
    network: faker.datatype.string(),
    location_id: faker.datatype.uuid(),
    latitude: faker.address.latitude(),
    longitude: faker.address.longitude(),
    admin_level: 1,
    summary: "This is an airqloud",
    dashboard: "yes",
    isCustom: false,
}

describe("Create AirQloud Util", function () {
    beforeEach(() => {
            sinon.restore();
        });
    let request = {
                query: { tenant: 'test' },
                body: { name: 'updated airqloud' },
                id:stubValue.id,
                name:stubValue.airqloud,
                admin_level:stubValue.admin_level,
                dashboard:stubValue.dashboard,
                airqloud_codes:stubValue.airqloud_codes,
            };
    
    describe('retrieveCoordinates', () => {
        request = { 
            tenant: stubValue.tenant
        };
        
        afterEach(() => {
            sinon.restore();
        });
        beforeEach(() => {
            listResult = {
                success: true,
                data: [{ location: "testLocation" }]
            };
            sinon.stub(locationUtil, "list").returns(listResult);
            sinon.stub(airqloudUtil, "list").returns(listResult);
        });

        it('should return the location coordinates if only one location is found', async () => {
            for (let i = 0; i < 2; i++)
            {
                i == 0 ? entity = "location" : "airqloud";
            const result = await airqloudUtil.retrieveCoordinates(request, entity);
            assert.deepStrictEqual(result, {
                data:"testLocation",
                success: true,
                message: 'retrieved the location',
                status: HTTPStatus.OK,
            });
            }
        });

         it('should return the location coordinates if more than one location is found', async () => {
             listResult.data = [{ location: "testLocation" }, { location:"testlocation"}]
            
            const result = await airqloudUtil.retrieveCoordinates(request, "location");
            assert.deepStrictEqual(result, {
            success: false,
            message: "unable to retrieve location details",
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
            errors: {
              message: "requested for one record but received many",
            },
            });
        });

        it('should return an error if no location is found', async () => {
            sinon.restore();
            listResult = {
                success: false,
                data: []
            };
            sinon.stub(locationUtil, "list").returns(listResult);
            const result = await airqloudUtil.retrieveCoordinates(request, 'location');
            expect(result.success).to.be.false;
            expect(result.message).to.equal("unable to retrieve details from the provided location_id");
            sinon.assert.calledOnceWithExactly(locationUtil.list, request);
        });
    });
    describe("Create Method", function () {
        
        it('should create an airqloud successfully', async function() {
           
            const createStubResponse = {
                success: true,
                message: 'site created',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
            };
            request = {
                query: { tenant: stubValue.tenant },
                body: { location_id: stubValue.location_id }
            };
            kafkaProducer = { 
                connect: sinon.stub(),
                send: sinon.stub(),
                disconnect: sinon.stub()
            };
            sinon.stub(kafka, "producer").returns(kafkaProducer);
            const retrieveCoordinatesStub = sinon.stub(airqloudUtil, 'retrieveCoordinates').resolves({
                success: true,
                data: { coordinates: [10, 20] }
            });
            const calculateGeographicalCenterStub = sinon.stub(airqloudUtil, 'calculateGeographicalCenter').resolves({
                success: true,
                data: { center: [10, 20] }
            });
            sinon.stub(AirQloudSchema.statics, "register").returns(createStubResponse);
            
            const response = await airqloudUtil.create(request);
            expect(response).to.deep.equal(createStubResponse); 

        });
    })

    describe("Update Function", function () {
        it('should update an AirQloud document', async () => {
            request = {
                query: { tenant: 'airqo' },
                body: { name: 'kampala' },
                id:stubValue.id,
                name:stubValue.airqloud,
                admin_level:stubValue.admin_level,
                dashboard:stubValue.dashboard,
                airqloud_codes:stubValue.airqloud_codes,
            };
            sinon.stub(generateFilter, "airqlouds").returns(stubValue);
           const updateStub= sinon.stub(airqloudUtil, "update").returns({
                success: true,
                data: stubValue,
                message: "airqloud updated",
                status: HTTPStatus.OK,
            });
            const response = await airqloudUtil.update(request);
            expect(response).to.deep.equal({
                success: true,
                data: stubValue,
                message: "airqloud updated",
                status: HTTPStatus.OK,
            });
        }).timeout(10000);
    })

    describe('Delete function', function () {
        const deleteStubResponse = {
            success: true,
            message: "successfully removed the airqloud",
            data: stubValue,
            status: HTTPStatus.OK,
        };
        beforeEach(() => {
            sinon.restore();
             request = {
                query: { tenant: 'test' },
                body: { name: 'updated airqloud' },
                id:stubValue.id,
                name:stubValue.airqloud,
                admin_level:stubValue.admin_level,
                dashboard:stubValue.dashboard,
                airqloud_codes:stubValue.airqloud_codes,
            };
        });

        it('returns success with airqloud data on successful deletion', async function () {
            
            const generateFilterStub=sinon.stub(generateFilter, "airqlouds").returns({ stubValue });
            const removeStub=sinon.stub(AirQloudSchema.statics, "remove").returns(deleteStubResponse);
            
            const response = await airqloudUtil.delete(request);

            expect(generateFilterStub.calledWithMatch(request)).to.be.true;
            expect(removeStub.calledWithMatch({ filter: { stubValue } })).to.be.true;
            expect(response).to.deep.equal(deleteStubResponse);
            sinon.restore();
        });

        it('returns error message on deletion failure', async function () {
            sinon.stub(generateFilter, "airqlouds").returns( stubValue );
            sinon.stub(AirQloudSchema.statics, "remove").returns({
                success: false,
                message: "Internal Server Error",
                errors: "Deletion Error",
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            });
            
            const response = await airqloudUtil.delete(request);

            expect(response).to.deep.equal({
                success: false,
                errors: "Deletion Error",
                message: "Internal Server Error",
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            });
        });
    });

    describe("Calculate Geographical Center", async function () {
        

        afterEach(() => {
            sinon.restore();
        })

        it('Successfully calculated the AirQloud\'s center point', async function () {
            request = {
                query: { id:stubValue.id },
                body: { coordinates: 'kampala' },
                id:stubValue.id,
                name:stubValue.airqloud,
                admin_level:stubValue.admin_level,
                dashboard:stubValue.dashboard,
                airqloud_codes:stubValue.airqloud_codes,
            };
            listResult = {
                success: true,
                data: [{
                    location: { coordinates: [stubValue.latitude]},
                }]
            };
            sinon.stub(airqloudUtil, "list").returns(listResult);
            sinon.stub(geolib, "getCenter").returns({
                latitude: stubValue.latitude,
                 longitude: stubValue.longitude,
            });
            
            const response = await airqloudUtil.calculateGeographicalCenter(request);
            assert.deepStrictEqual(response.success,true);
        });
    });
    
});