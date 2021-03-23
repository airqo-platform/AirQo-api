"use-strict";
let chai = require("chai"),
  expect = chai.expect;
chai.should();

const transformMeasurements = require("../transform-measurements");
const insertMeasurements = require("../insert-measurements");
const { getMeasurements } = require("../get-measurements");

describe("get measurements", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should get the measurements", function() {
    getMeasurements();
  });
});

describe("transform measurements", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should return the transformed measurements", function() {
    let transformedMeasurements = transformMeasurements(device, measurement);
    // transformedMeasurements.should.eq
  });
});

describe("insert the measurements", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should insert the measurements", function() {
    insertMeasurements(res, tenant, transformedMeasurements);
  });
});
