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
const mongodb = require("@config/database");

const errorsUtil = require("@utils/errors");

describe('Errors Util', function () {
    describe('convertErrorArrayToObject', function () {
        it('should return an object with the correct keys and values', async function () {
            const errorArray = [
                {
                    value: 'test',
                    msg: 'test message'
                }
            ];
            const result = errorsUtil.convertErrorArrayToObject(errorArray);
            expect(result).to.be.an('object');
            expect(result).to.have.property('test');
            expect(result).to.have.property('message');
            expect(result.test).to.equal('test message');
            expect(result.message).to.equal('test message');
        });
    });

    describe('axiosError', function () {
        it('should return an object with the correct keys and values', async function () {
            const error = {
                response: {
                    data: 'test data'
                },
                request: 'test request',
                message: 'test message',
                config: 'test config'
            };
            const req = 'test req';
            const res = {
                status: sinon.stub().returns({
                    json: sinon.stub().returns({
                        success: false,
                        error: 'test error'
                    })
                })
            };
            const spy = sinon.spy(errorsUtil, "axiosError");
            errorsUtil.axiosError(error, req, res);
            expect(spy.calledOnceWithExactly(error, req, res)).to.be.true;
            expect(res.status.calledOnceWithExactly(HTTPStatus.INTERNAL_SERVER_ERROR)).to.be.true;
            expect(res.status().json.calledOnceWithExactly({
                success: false,
                error: error.response.data
            })).to.be.true;
        });
    });

    describe('tryCatchErrors', function () {
        it('should return an object with the correct keys and values', async function () {
            const error = {
                message: 'test message'
            };
            const res = {
                status: sinon.stub().returns({
                    json: sinon.stub().returns({
                        success: false,
                        message: 'test message'
                    })
                })
            };
            const message = 'test message';
            const spy = sinon.spy(errorsUtil, "tryCatchErrors");
            errorsUtil.tryCatchErrors(res, error, message);
            expect(spy.calledOnceWithExactly(res, error, message)).to.be.true;
            expect(res.status().json.calledOnceWithExactly({
                success: false,
                message: `server error - ${message}`,
                error: error.message
            })).to.be.true;
        });
    }
    );

    describe('missingQueryParams', function () {
        it('should return an object with the correct keys and values', async function () {
            const res = {
                status: sinon.stub().returns({
                    send: sinon.stub().returns({
                        success: false,
                        message: 'misssing request parameters, please check documentation'
                    })
                })
            };
            const spy = sinon.spy(errorsUtil, "missingQueryParams");
            errorsUtil.missingQueryParams(res);
            expect(spy.calledOnceWithExactly(res)).to.be.true;
            expect(res.status().send.calledOnceWithExactly({
                success: false,
                message: "misssing request parameters, please check documentation"
            })).to.be.true;
        });
    }
    );
  
    describe('missingOrInvalidValues', function () {
        it('should return an object with the correct keys and values', async function () {
            const res = {
                status: sinon.stub().returns({
                    send: sinon.stub().returns({
                        success: false,
                        message: 'missing or invalid request parameter values, please check documentation'
                    })
                })
            };
            const spy = sinon.spy(errorsUtil, "missingOrInvalidValues");
            errorsUtil.missingOrInvalidValues(res);
            expect(spy.calledOnceWithExactly(res)).to.be.true;
            expect(res.status().send.calledOnceWithExactly({
                success: false,
                message: "missing or invalid request parameter values, please check documentation"
            })).to.be.true;
        });
    }
    );

    describe('invalidParamsValue', function () {
        it('should return an object with the correct keys and values', async function () {
            const req = {
                params: {
                    test: 'test'
                }
            };
            const res = {
                status: sinon.stub().returns({
                    send: sinon.stub().returns({
                        success: false,
                        message: 'Invalid request parameter value, please check documentation'
                    })
                })
            };
            const spy = sinon.spy(errorsUtil, "invalidParamsValue");
            errorsUtil.invalidParamsValue(req,res);
            expect(spy.calledOnceWithExactly(req,res)).to.be.true;
            expect(res.status().send.calledOnceWithExactly({
                success: false,
                message: "Invalid request parameter value, please check documentation"
            })).to.be.true;
        });
    }
    );


    describe('callbackErrors', function () {
        it('should return an object with the correct keys and values', async function () {
            const error = {
                message: 'test message'
            };
            const req = 'test req';
            const res = {
                status: sinon.stub().returns({
                    json: sinon.stub().returns({
                        success: false,
                        message: 'server error',
                        error: error
                    })
                })
            };
            const spy = sinon.spy(errorsUtil, "callbackErrors");
            errorsUtil.callbackErrors(error, req, res);
            expect(spy.calledOnceWithExactly(error, req, res)).to.be.true;
            expect(res.status().json.calledOnceWithExactly({
                success: false,
                message: "server error",
                error: error
            })).to.be.true;
        });
    }
    );

    describe('badRequest', function () {
        it('should return an object with the correct keys and values', async function () {
            const res = {
                status: sinon.stub().returns({
                    json: sinon.stub().returns({
                        success: false,
                        message: 'test message',
                        errors: 'test errors'
                    })
                })
            };
            const message = 'test message';
            const errors = 'test errors';
            const spy = sinon.spy(errorsUtil, "badRequest");
            errorsUtil.badRequest(res, message, errors);
            expect(spy.calledOnceWithExactly(res, message, errors)).to.be.true;
            expect(res.status().json.calledOnceWithExactly({
                success: false,
                message: message,
                errors: errors
            })).to.be.true;
        });
    }
    );
    
    describe('utillErrors', function () {
        it('should return an object with the correct keys and values', async function () {
            const error = {
                message: 'test message'
            };
            const message = 'test message';
            const errors = {
                "message": "test message"
            };
            const tryCatchSpy = sinon.spy(errorsUtil.utillErrors, "tryCatchErrors");
            const result = errorsUtil.utillErrors.tryCatchErrors(error, message);
            expect(tryCatchSpy.calledOnceWithExactly(error, message)).to.be.true;
            expect(result).to.be.eql({
                success: false,
                message: `util server error -- ${message}`,
                error: error.message
            });

            const badRequestSpy = sinon.spy(errorsUtil.utillErrors, "badRequest");
            const response = errorsUtil.utillErrors.badRequest(message,error);
            expect(badRequestSpy.calledOnceWithExactly(message,error)).to.be.true;
            expect(response).to.be.eql({ success: false, message, errors });
        });
    }
    );

    
});
