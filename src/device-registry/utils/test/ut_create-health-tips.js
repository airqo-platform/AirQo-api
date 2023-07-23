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


const healthTipsUtil = require("@utils/create-location");
const healthTipsSchema = require("@models/Location");

const generateFilter = require('../generate-filter');

const stubValue = {
    tenant: "airqo",
    title: faker.datatype.string(),
    description: faker.datatype.string(),
    aqi_category: faker.datatype.string(),
    image: faker.datatype.string(),
 
}

const kafka = new Kafka({
  clientId: "location-test-service",
  brokers: "brokers:9092",
});


describe("Create Health-Tips Util", function () {
     beforeEach(() => {
            sinon.restore();
     });
   
    let request = {
        query: {
            tenant: stubValue.tenant,
            limit: 10,
            skip: 0,
        },
        
    };

    describe("Create Health Tips", function () {
        beforeEach(() => {
            sinon.restore();
        });
        
        it("Should create a health tip", async function () {
            const createStubResponse = {
                success: true,
                message: 'Health tip created',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
            };
             kafkaProducer = { 
                connect: sinon.stub(),
                send: sinon.stub(),
                disconnect: sinon.stub()
            };
            sinon.stub(kafka,"producer").returns(kafkaProducer);
            
            sinon.stub(healthTipsSchema.statics, "register").returns(createStubResponse);
            const response = await healthTipsUtil.create(request);
            expect(response).to.deep.equal(createStubResponse);
        });

        it("Should return error if creation fails", async function () {
            const createStubErrorResponse = {
                success: false,
                errors: {
                    message: "Cannot read properties of undefined (reading 'success')"
                },
                message: "unable to create health tip",
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
            };
            sinon.stub(healthTipsSchema.statics, "register").returns(createStubErrorResponse);
            const response = await healthTipsUtil.create(request);
            expect(response).to.deep.equal(createStubErrorResponse);
            
        });
    });

    describe("Update Health tip", function () {
        beforeEach(() => {
            sinon.restore();
        });

        it("Should update a health tip", async function () { 
            const updateStubResponse = {
                success: true,
                message: 'Health tip updated',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
             };
            sinon.stub(generateFilter, "tips").returns(stubValue)
            sinon.stub(healthTipsSchema.statics, "modify").returns(updateStubResponse);
            const response = await healthTipsUtil.update(request);
            expect(response).to.deep.equal(updateStubResponse);
        }).timeout(5000);
    });

    describe('delete Health tip', function () {
        const deleteStubResponse = {
            success: true,
            message: 'Health tip deleted',
            data: stubValue,
            status: HTTPStatus.ACCEPTED,
         };
        beforeEach(() => {
            sinon.restore();
        });

         it('should delete a health tip', async function () {
            
           sinon.stub(generateFilter, "tips").resolves(stubValue);
           sinon.stub(healthTipsSchema.statics, "remove").returns(deleteStubResponse);
            
            const response = await healthTipsUtil.delete(request);

            
            assert.deepStrictEqual(response, deleteStubResponse);
           
         });
        
        it('should handle errors during deletion', async function () {
            const deleteStubResponse = {
                success: false,
                message: 'unable to delete health tip',
                errors: { message: 'Unable to delete health tip' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             };
          
            sinon.stub(generateFilter, "tips").resolves({
                success: false,
                message: 'unable to delete health tip',
                errors: { message: 'Unable to delete health tip' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             });
            sinon.stub(healthTipsSchema.statics, "remove").rejects(new Error('Unable to delete health tip'));
            
            const response = await healthTipsUtil.delete(request);
            assert.deepStrictEqual(response.success, deleteStubResponse.success);
            assert.deepStrictEqual(response.errors.message, deleteStubResponse.errors.message);
            assert.deepStrictEqual(response.status, deleteStubResponse.status);
        });
       
    });

    describe('List Health Tips', function () {

        beforeEach(() => {
            sinon.restore();
        });

        it('should list a health tip', async function () {
            
            const listStubResponse = {
                success: true,
                message: 'Health Tip Listed',
                data: stubValue,
                status: HTTPStatus.ACCEPTED,
             };
           sinon.stub(generateFilter, "tips").resolves(stubValue);
           sinon.stub(healthTipsSchema.statics, "list").returns(listStubResponse);
            
            const response = await healthTipsUtil.list(request);

            
            assert.deepStrictEqual(response, listStubResponse);
           
        });

        it('should catch errors during Listing', async function () {
           
            const listStubResponse = {
                success: false,
                message: 'unable to list health tip',
                errors: { message: 'Unable to list health tip' },
                status: HTTPStatus.INTERNAL_SERVER_ERROR,
             }; 
          
            sinon.stub(generateFilter, "tips").resolves(stubValue);
            sinon.stub(healthTipsSchema.statics, "list").rejects(new Error('Unable to list health tip'));
            
            const response = await healthTipsUtil.list(request);
             assert.deepStrictEqual(response.success, listStubResponse.success);
            assert.deepStrictEqual(response.errors.message, listStubResponse.errors.message);
            assert.deepStrictEqual(response.status, listStubResponse.status);
        });
    });

});
