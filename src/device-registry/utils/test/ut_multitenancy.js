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

describe('Multitenancy Util', function () {

  describe('getModelByTenant', function () {
    it('should call getTenantDB with the correct arguments and return the model', async function () {
      const tenantId = '123';
      const modelName = 'MyModel';
      const schema = {};
        
        const spy=sinon.spy(multitenancy, "getModelByTenant");
      const result = await multitenancy.getModelByTenant(tenantId, modelName, schema);
      expect(spy.calledOnceWithExactly(tenantId, modelName, schema)).to.be.true;
      expect(result.modelName).to.equal(modelName);
    });
  });
});
