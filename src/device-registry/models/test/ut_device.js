"use-strict";
const imageController = require("../Device");

let chai = require("chai"),
  expect = chai.expect;
chai.should();
const chaiHttp = require("chai-http");
const should = chai.should();
const assert = chai.assert;
const faker = require("faker");
const sinon = require("sinon");
const request = require("request");
chai.use(chaiHttp);
const DeviceSchema = require("../Device");
const SiteModel = require("../../utils/multitenancy");

const stubValue = {
    _name_id: faker.datatype.uuid(),
    tenant: "airqo",
    name: faker.name.findName(),
    latitude: faker.address.latitude(),
    longitude: faker.address.longitude(),
    createdAt: faker.date.past(),
    updatedAt: faker.date.past(),
    approximate_distance_in_km: faker.datatype.float(),
    writeKey: faker.name.writeKey(),
    readKey: faker.name.readKey(),
    network:faker.company.network(),
    access_code:faker.datatype.int(),
    visibility: faker.datatype.boolean(),
    generation_version: faker.datatype.float(),
    generation_count:faker.datatype.int(),
    mobility: faker.datatype.boolean(),
    height: faker.datatype.float(),
    mountType:faker.datatype.mountType(),
    device_codes:faker.datatype.array(),
    status: faker.datatype.status(),
    ISP:faker.datatype.ISP(),
    phoneNumber: faker.phone.unique(),
    powerType:faker.random.powerType(),
    host_id: faker.random.unique(),
    site_id:faker.datatype.uuid(),
    device_number: faker.random.unique(),
    category: faker.name.category(),
    isActive:faker.datatype.isActive()
};

describe("create a device", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should have validation error for a duplicate compoment type name", function () {
    
  });
});

describe("read device ", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should find the existing device ", function () {
  
    });
  });

describe("deleting device ", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should delete a device using ID", function () {
    
  });

  it("should delete a device using the name", function () {
    
  });

  it("should remove multiple device ", function () {
    
  });

  it("should remove device using its instance", function () {
    
  });
});

describe("updating a device", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should set and saves a device using an instance", function() {});

  it("should update a device using its instance", function() {});

  it("should update one device using the model", function() {});

  it("should update one device with ID using model", function() {});

  it("should return error is the update action fails", function() {});
});
