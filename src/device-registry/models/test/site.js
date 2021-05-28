"use-strict";
const siteController = require("../Site");

let chai = require("chai"),
  expect = chai.expect;
chai.should();

describe("create a site", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should have validation error for a duplicate compoment type name", function() {});
});

describe("read site", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should find the existing site", function() {});
});

describe("deleting site", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should delete a site using ID", function() {});

  it("should delete a site using the name", function() {});

  it("should remove multiple site", function() {});

  it("should remove site using its instance", function() {});
});

describe("updating a site", function() {
  beforeEach(function() {});
  afterEach(function() {});
  it("should set and saves a site using an instance", function() {});

  it("should update a site using its instance", function() {});

  it("should update one site using the model", function() {});

  it("should update one site with ID using model", function() {});

  it("should return error is the update action fails", function() {});
});
