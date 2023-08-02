require("module-alias/register");
const HTTPStatus = require("http-status");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { validationResult } = require("express-validator");
const processImage = require("@controllers/create-photo");

chai.use(sinonChai);
const expect = chai.expect;

describe("Process Image Controller", () => {
  describe("create", () => {
    let req, res, next;

    beforeEach(() => {
      req = { body: {}, query: {} };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      next = sinon.stub();
    });

    it("should return 501 Not Implemented", async () => {
      await processImage.create(req, res, next);

      expect(res.status).to.have.been.calledOnceWith(
        HTTPStatus.NOT_IMPLEMENTED
      );
      expect(res.json).to.have.been.calledOnceWith({
        success: false,
        message: "coming soon...",
      });
    });

    // Add more tests for the create function if needed

    // For example, you can add tests to check validation, response structure, etc.
  });

  describe("update", () => {
    // Add tests for the update function similar to the create function
  });

  describe("delete", () => {
    // Add tests for the delete function similar to the create function
  });

  describe("list", () => {
    // Add tests for the list function similar to the create function
  });

  describe("createPhotoOnPlatform", () => {
    // Add tests for the createPhotoOnPlatform function similar to the create function
  });

  describe("deletePhotoOnPlatform", () => {
    // Add tests for the deletePhotoOnPlatform function similar to the create function
  });

  describe("updatePhotoOnPlatform", () => {
    // Add tests for the updatePhotoOnPlatform function similar to the create function
  });

  describe("deletePhotoOnCloudinary", () => {
    // Add tests for the deletePhotoOnCloudinary function similar to the create function
  });

  describe("updatePhotoOnCloudinary", () => {
    // Add tests for the updatePhotoOnCloudinary function similar to the create function
  });

  describe("createPhotoOnCloudinary", () => {
    // Add tests for the createPhotoOnCloudinary function similar to the create function
  });
});
