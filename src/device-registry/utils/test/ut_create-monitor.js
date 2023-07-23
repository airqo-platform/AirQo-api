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
const cryptoJS = require('crypto-js');

const monitorUtil = require("@utils/create-monitor");
const generateFilter = require("@utils/generate-filter");
const DeviceSchema = require("@models/Device");
const { getModelByTenant } = require("@utils/multitenancy");
let devicesModel = (tenant) => {
  return getModelByTenant(tenant, "device", DeviceSchema);
};

let request = {
    query: {
        tenant: "airqo",
        limit: 10,
        skip: 0,
    },
    body: {},

}

describe("Monitor Util", () => {
    beforeEach(() => {
        sinon.restore();
    });

    describe("list", () => {
        it("Should return a success response if the list of devices is retrieved successfully", async () => {

            sinon.stub(generateFilter, "devices").returns(
                {
                    success: true,
                    data: "",
                    message: " ",
                    status: HTTPStatus.OK,
                }
            );
            sinon.stub(DeviceSchema.statics, "list").returns({
                success: true,
                data: "",
                message: "Successfully retrieved devices",
                status: HTTPStatus.OK,
            });
            response = await monitorUtil.list(request);
            expect(response.success).to.be.true;
            expect(response.message).to.be.equal("Successfully retrieved devices");
        }); 
        
        it("Should return an error response if the list of devices is not retrieved successfully", async () => {
                
                sinon.stub(generateFilter, "devices").returns(
                    {
                        success: false,
                        errors:"",
                        message: "Failed to retrieve devices",
                        status: HTTPStatus.INTERNAL_SERVER_ERROR,
                    }
                );
                response = await monitorUtil.list(request);
                expect(response.success).to.be.false;
                expect(response.message).to.be.equal("Failed to retrieve devices");
         });
    });


describe('decryptKey', () => {
  it('should decrypt the key successfully', async () => {
    const decryptStub = sinon.stub(cryptoJS.AES, 'decrypt');
    decryptStub.returns({
      toString: sinon.stub().returns('decrypted key'),
    });

    const encryptedKey = 'encrypted key';

    const response = await monitorUtil.decryptKey(encryptedKey);

    assert.strictEqual(response.success, true);
    assert.strictEqual(response.message, 'successfully decrypted the text');
    assert.strictEqual(response.data, 'decrypted key');
    assert.strictEqual(response.status, HTTPStatus.OK);

    decryptStub.restore();
  });

  it('should handle unrecognized encrypted key', async () => {
    const decryptStub = sinon.stub(cryptoJS.AES, 'decrypt');
    decryptStub.returns({
      toString: sinon.stub().returns(''),
    });

    const encryptedKey = 'unrecognized encrypted key';
    const response = await monitorUtil.decryptKey(encryptedKey);

    assert.strictEqual(response.success, true);
    assert.strictEqual(
      response.message,
      'the provided encrypted key is not recognizable'
    );
    assert.strictEqual(response.status, HTTPStatus.NOT_FOUND);
    decryptStub.restore();
  });

  it('should handle decryption errors', async () => {
    const decryptStub = sinon.stub(cryptoJS.AES, 'decrypt');
    decryptStub.throws(new Error('Decryption error'));

    const encryptedKey = 'encrypted key';

    const response = await monitorUtil.decryptKey(encryptedKey);
    assert.strictEqual(response.success, false);
    assert.strictEqual(response.message, 'unable to decrypt the key');
    assert.strictEqual(response.errors.message, 'Decryption error');
    assert.strictEqual(response.status, HTTPStatus.INTERNAL_SERVER_ERROR);

    decryptStub.restore();
  });
});


});