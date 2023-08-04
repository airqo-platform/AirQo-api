require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const express = require("express");
const expressValidator = require("express-validator");
const { createRequest, createResponse } = require("node-mocks-http");
const constants = require("@config/constants");
const { isEmpty } = require("is-empty");
const ObjectId = require("mongoose").Types.ObjectId;

const photoController = require("@controllers/create-photo");

const expect = chai.expect;

describe("Photo Controller", () => {
  describe("DELETE /", () => {
    it("should respond with status 200 and call photoController.delete function", () => {
      // TODO: Write your test case for DELETE route here
    });
  });

  describe("POST /", () => {
    it("should respond with status 200 and call photoController.create function", () => {
      // TODO: Write your test case for POST route here
    });
  });

  describe("PUT /", () => {
    it("should respond with status 200 and call photoController.update function", () => {
      // TODO: Write your test case for PUT route here
    });
  });

  describe("GET /", () => {
    it("should respond with status 200 and call photoController.list function", () => {
      // TODO: Write your test case for GET route here
    });
  });

  describe("POST /soft", () => {
    it("should respond with status 200 and call photoController.createPhotoOnPlatform function", () => {
      // TODO: Write your test case for POST /soft route here
    });
  });

  describe("PUT /soft", () => {
    it("should respond with status 200 and call photoController.updatePhotoOnPlatform function", () => {
      // TODO: Write your test case for PUT /soft route here
    });
  });

  describe("DELETE /soft", () => {
    it("should respond with status 200 and call photoController.deletePhotoOnPlatform function", () => {
      // TODO: Write your test case for DELETE /soft route here
    });
  });

  describe("POST /cloud", () => {
    it("should respond with status 200 and call photoController.createPhotoOnCloudinary function", () => {
      // TODO: Write your test case for POST /cloud route here
    });
  });

  describe("DELETE /cloud", () => {
    it("should respond with status 200 and call photoController.deletePhotoOnCloudinary function", () => {
      // TODO: Write your test case for DELETE /cloud route here
    });
  });

  describe("PUT /cloud", () => {
    it("should respond with status 200 and call photoController.updatePhotoOnCloudinary function", () => {
      // TODO: Write your test case for PUT /cloud route here
    });
  });
});
