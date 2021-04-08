"use-strict";
const imageController = require("../Device");

let chai = require("chai"),
  expect = chai.expect;
chai.should();

describe("create a device", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should have validation error for a duplicate compoment type name", function() {});
});

describe("read device ", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should find the existing device ", function() {});
});

describe("deleting device ", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should delete a device using ID", function() {});

  it("should delete a device using the name", function() {});

  it("should remove multiple device ", function() {});

  it("should remove device using its instance", function() {});
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
