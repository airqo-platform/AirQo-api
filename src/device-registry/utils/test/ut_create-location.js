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
const { Kafka } = require("kafkajs");

const airqloudUtil = require("@utils/create-airqloud");
const locationUtil = require("@utils/create-location");
const locationSchema = require("@models/Location");

const generateFilter = require('../generate-filter');

const stubValue = {
    tenant: "airqo",
    long_name: faker.name.findName(),
    admin_level: "test-level",
    id: faker.datatype.uuid(),
    network: faker.datatype.string(),
    isCustom: faker.datatype.boolean(),
    name: faker.name.findName(),
    description: faker.datatype.string(),
    location_tags: [faker.datatype.string(), faker.datatype.string()],
}

const kafka = new Kafka({
  clientId: "location-test-service",
  brokers: "brokers:9092",
});


describe("Create Location Util", function () {
     beforeEach(() => {
            sinon.restore();
     });
   
    let request = {
        query: { tenant: 'test' },
        body: {
            id: stubValue.id,
            name: stubValue.name,
            admin_level: stubValue.admin_level,
            update: stubValue,
        },
    };

    describe("initialIsCapital", function () {
        it("should return false if first letter is not capital", function () {
            let word = "hello";
            let result = locationUtil.initialIsCapital(word);
            expect(result).to.be.false;
        });
        it("should return true if first letter is capital", function () {
            let word = "Hello";
            let result = locationUtil.initialIsCapital(word);
            expect(result).to.be.true;
        });
    });

    describe("hasNoWhiteSpace", function () {
            it("should return false if word has whitespace", function () {
                let word = "hello world";
                let result = locationUtil.hasNoWhiteSpace(word);
                expect(result).to.be.false;
            });
            it("should return true if word has no whitespace", function () {
                let word = "helloworld";
                let result = locationUtil.hasNoWhiteSpace(word);
                expect(result).to.be.true;
            });
        });

    describe("create Location", function () {
        beforeEach(() => {
            sinon.restore();
        });
        
        it("Should Create a location", async function () {
            const createStubResponse = {
                success: true,
                message: 'Location created',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
            };
             kafkaProducer = { 
                connect: sinon.stub(),
                send: sinon.stub(),
                disconnect: sinon.stub()
            };
            sinon.stub(kafka,"producer").returns(kafkaProducer);
            
            sinon.stub(locationSchema.statics, "register").returns(createStubResponse);
            const response = await locationUtil.create(request);
            expect(response).to.deep.equal(createStubResponse);
        });

        it("Should return error if creation fails", async function () {
            const createStubErrorResponse = {
                success: false,
                errors: {
                    message: "Cannot read properties of undefined (reading 'success')"
                },
                message: "unable to create location",
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            };
            sinon.stub(locationSchema.statics, "register").returns(createStubErrorResponse);
            const response = await locationUtil.create(request);
            expect(response).to.deep.equal(createStubErrorResponse);
        });
    });

    describe("Update Location", function () {
        beforeEach(() => {
            sinon.restore();
        });

        it("Should update a location", async function () { 
            const updateStubResponse = {
                success: true,
                message: 'Location updated',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
             };
            sinon.stub(generateFilter, "locations").returns(stubValue)
            sinon.stub(locationSchema.statics, "modify").returns(updateStubResponse);
            const response = await locationUtil.update(request);
            console.log(response)
            expect(response).to.deep.equal(updateStubResponse);
        }).timeout(5000);
    });

    describe('delete Location', function () {
        const deleteStubResponse = {
            success: true,
            message: 'Location deleted',
            data: stubValue,
            status: HTTPStatus.ACCEPTED,
         };
        beforeEach(() => {
            sinon.restore();
            request = {
        query: { tenant: 'test' },
        body: {
            id: stubValue.id,
            name: stubValue.name,
            admin_level: stubValue.admin_level,
            update: stubValue,
        },
    };
        });

         it('should delete a location', async function () {
            
           sinon.stub(generateFilter, "locations").resolves(stubValue);
           sinon.stub(locationSchema.statics, "remove").returns(deleteStubResponse);
            
            const response = await locationUtil.delete(request);

            
            assert.deepStrictEqual(response, deleteStubResponse);
           
         });
        
        it('should handle errors during deletion', async function () {
            sinon.restore();
            const deleteStubResponse = {
                success: false,
                message: 'unable to delete location',
                errors: { message: 'Unable to delete location' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             };
          
            sinon.stub(generateFilter, "locations").resolves({
                success: false,
                message: 'unable to delete location',
                errors: { message: 'Unable to delete location' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             });
            sinon.stub(locationSchema.statics, "remove").rejects(new Error('Unable to delete location'));
            
            const response = await locationUtil.delete(request);
            assert.deepStrictEqual(response, deleteStubResponse);
        });
       
    });

    describe('List Location', function () {

        beforeEach(() => {
            sinon.restore();
        });

        it('should list a location', async function () {
            
            const listStubResponse = {
                success: true,
                message: 'Location Listed',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
             };
           sinon.stub(generateFilter, "locations").resolves(listStubResponse);
           sinon.stub(locationSchema.statics, "list").returns(listStubResponse);
            
            const response = await locationUtil.list(request);

            
            assert.deepStrictEqual(response, listStubResponse);
           
        });

        it('should handle errors during Listing', async function () {
           
            const listStubResponse = {
                success: false,
                message: 'unable to list location',
                errors: { message: 'Unable to list location' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             };
          
            sinon.stub(generateFilter, "locations").resolves(listStubResponse);
            sinon.stub(locationSchema.statics, "list").rejects(new Error('Unable to list location'));
            
            const response = await locationUtil.list(request);
            assert.deepStrictEqual(response, listStubResponse);
        });
    });

});
