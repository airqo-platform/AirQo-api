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

const createSensorUtil = require("@utils/create-sensor");

describe("createSensorUtil", function () {

describe('CRUD Operations', function() {
  describe('create', function() {
    it('should create a new item', function() {
        result = createSensorUtil.create();
        expect(result).to.equal(undefined);  
    });
  });

  describe('update', function() {
    it('should update an existing item', function() {
     
    });
  });

  describe('delete', function() {
    it('should delete an existing item', function() {
     
    });
  });

  describe('list', function() {
    it('should return a list of items', function() {
     
    });
  });
});

});