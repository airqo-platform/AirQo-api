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
const kafka = require("kafkajs");

const airqloudUtil = require("@utils/create-airqloud");
const locationUtil = require("@utils/create-location");
const airqloudModel = require("@utils/multitenancy");
const AirQloudSchema = require("@models/Airqloud");

const generateFilter = require("@utils/generate-filter");
const model = require("@models/Airqloud");
const { retrieveCoordinates } = require('../create-airqloud');


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
    dashboard:"yes"
}

describe("Create AirQloud Util", function () {
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
        before(() => {
            
        });
        it('should return a success response when all the steps are successful', async function() {
           
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
            sinon.stub(kafka);
            let airQloudStub = sinon.replace(airqloudModel, "getModelByTenant", sinon.fake).returns(createStubResponse);
            let modelSpy = sinon.spy(airqloudModel, "getModelByTenant");
            airQloudStub();
            const retrieveCoordinatesStub = sinon.stub(airqloudUtil, 'retrieveCoordinates').resolves({
                    success: true,
                    data: { coordinates: [10, 20] }
            });
            const calculateGeographicalCenterStub = sinon.stub(airqloudUtil, 'calculateGeographicalCenter').resolves({
                success: true,
                data: { center: [10, 20] }
            });
            
            const response = await airqloudUtil.create(request);

        
            expect(airQloudStub.calledOnce).to.be.true;
        });
    })

    describe("Update Function", function () {
        it('should update an AirQloud document', async () => {
            let airqloudStub;
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

        it('returns success with airqloud data on successful deletion', async function () {
            sinon.restore();
            sinon.replace(airqloudModel, "getModelByTenant", sinon.fake).returns(deleteStubResponse);
            sinon.stub(generateFilter, "airqlouds").returns({ stubValue });
            
           request = {
                query: { tenant: 'test' },
                body: { name: 'updated airqloud' },
                id:stubValue.id,
                name:stubValue.airqloud,
                admin_level:stubValue.admin_level,
                dashboard:stubValue.dashboard,
                airqloud_codes:stubValue.airqloud_codes,
            };
            
            const response = await airqloudUtil.delete(request);
            console.log(response);
        }).timeout(10000);
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