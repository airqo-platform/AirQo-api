require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const httpStatus = require("http-status");
const { validationResult } = require("express-validator");
const createFavorite = require("@controllers/create-favorite");
const createFavoriteUtil = require("@utils/create-favorite");
const { badRequest, convertErrorArrayToObject } = require("@utils/errors");
const constants = require("@config/constants");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- create-favorite-controller`
);

describe("createFavorite module", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("syncFavorites()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for validation errors
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub(createFavorite, "badRequest");

      // Call the function to be tested
      await createFavorite.syncFavorites(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      // Add more assertions to check the bad request response

      // Restore the stubs
      validationResultStub.restore();
      badRequestStub.restore();
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.syncFavorites", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const syncFavoritesStub = sinon
        .stub(createFavoriteUtil, "syncFavorites")
        .throws(new Error("Mocked error"));

      // Call the function to be tested
      await createFavorite.syncFavorites(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(syncFavoritesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the internal server error response

      // Restore the stubs
      validationResultStub.restore();
      syncFavoritesStub.restore();
    });

    it("should return a success response with data if createFavoriteUtil.syncFavorites is successful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const syncFavoritesStub = sinon
        .stub(createFavoriteUtil, "syncFavorites")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Mocked success message",
          data: [{ favorite: "data" }],
        });

      // Call the function to be tested
      await createFavorite.syncFavorites(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(syncFavoritesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the success response with data

      // Restore the stubs
      validationResultStub.restore();
      syncFavoritesStub.restore();
    });

    it("should return an error response if createFavoriteUtil.syncFavorites is unsuccessful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const syncFavoritesStub = sinon
        .stub(createFavoriteUtil, "syncFavorites")
        .returns({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Mocked error message",
          errors: { field: "error message" },
        });

      // Call the function to be tested
      await createFavorite.syncFavorites(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(syncFavoritesStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the error response

      // Restore the stubs
      validationResultStub.restore();
      syncFavoritesStub.restore();
    });
  });

  describe("create()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for validation errors
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub(createFavorite, "badRequest");

      // Call the function to be tested
      await createFavorite.create(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      // Add more assertions to check the bad request response

      // Restore the stubs
      validationResultStub.restore();
      badRequestStub.restore();
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.create", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteStub = sinon
        .stub(createFavoriteUtil, "create")
        .throws(new Error("Mocked error"));

      // Call the function to be tested
      await createFavorite.create(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the internal server error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteStub.restore();
    });

    it("should return a success response with data if createFavoriteUtil.create is successful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteStub = sinon
        .stub(createFavoriteUtil, "create")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Mocked success message",
          data: { favorite: "data" },
        });

      // Call the function to be tested
      await createFavorite.create(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the success response with data

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteStub.restore();
    });

    it("should return an error response if createFavoriteUtil.create is unsuccessful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteStub = sinon
        .stub(createFavoriteUtil, "create")
        .returns({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Mocked error message",
          errors: { field: "error message" },
        });

      // Call the function to be tested
      await createFavorite.create(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteStub.restore();
    });
  });

  describe("list()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for validation errors
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub(createFavorite, "badRequest");

      // Call the function to be tested
      await createFavorite.list(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      // Add more assertions to check the bad request response

      // Restore the stubs
      validationResultStub.restore();
      badRequestStub.restore();
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.list", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "list")
        .throws(new Error("Mocked error"));

      // Call the function to be tested
      await createFavorite.list(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the internal server error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return a success response with data if createFavoriteUtil.list is successful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "list")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Mocked success message",
          data: { favorites: ["data1", "data2"] },
        });

      // Call the function to be tested
      await createFavorite.list(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the success response with data

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return an error response if createFavoriteUtil.list is unsuccessful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "list")
        .returns({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Mocked error message",
          errors: { field: "error message" },
        });

      // Call the function to be tested
      await createFavorite.list(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });
  });

  describe("delete()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for validation errors
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub(createFavorite, "badRequest");

      // Call the function to be tested
      await createFavorite.delete(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      // Add more assertions to check the bad request response

      // Restore the stubs
      validationResultStub.restore();
      badRequestStub.restore();
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.delete", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "delete")
        .throws(new Error("Mocked error"));

      // Call the function to be tested
      await createFavorite.delete(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the internal server error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return a success response with data if createFavoriteUtil.delete is successful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "delete")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Mocked success message",
          data: { deleted_Favorite: "data1" },
        });

      // Call the function to be tested
      await createFavorite.delete(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the success response with data

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return an error response if createFavoriteUtil.delete is unsuccessful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "delete")
        .returns({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Mocked error message",
          errors: { field: "error message" },
        });

      // Call the function to be tested
      await createFavorite.delete(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });
  });

  describe("update()", () => {
    it("should return a bad request response if there are validation errors", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for validation errors
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(false);
      const badRequestStub = sinon.stub(createFavorite, "badRequest");

      // Call the function to be tested
      await createFavorite.update(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(badRequestStub.calledOnce).to.be.true;
      // Add more assertions to check the bad request response

      // Restore the stubs
      validationResultStub.restore();
      badRequestStub.restore();
    });

    it("should return an internal server error response if an error occurs in createFavoriteUtil.update", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "update")
        .throws(new Error("Mocked error"));

      // Call the function to be tested
      await createFavorite.update(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.INTERNAL_SERVER_ERROR)).to.be
        .true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the internal server error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return a success response with data if createFavoriteUtil.update is successful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "update")
        .returns({
          success: true,
          status: httpStatus.OK,
          message: "Mocked success message",
          data: { updated_Favorite: "data1" },
        });

      // Call the function to be tested
      await createFavorite.update(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.OK)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the success response with data

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });

    it("should return an error response if createFavoriteUtil.update is unsuccessful", async () => {
      // Mock the required objects and functions
      const req = {}; // Provide the necessary data for a successful request
      const res = {
        status: sinon.stub().returnsThis(),
        json: sinon.spy(),
      };
      const validationResultStub = sinon
        .stub(validationResult(req), "isEmpty")
        .returns(true);
      const createFavoriteUtilStub = sinon
        .stub(createFavoriteUtil, "update")
        .returns({
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Mocked error message",
          errors: { field: "error message" },
        });

      // Call the function to be tested
      await createFavorite.update(req, res);

      // Assertions
      expect(validationResultStub.calledOnce).to.be.true;
      expect(createFavoriteUtilStub.calledOnce).to.be.true;
      expect(res.status.calledWith(httpStatus.BAD_REQUEST)).to.be.true;
      expect(res.json.calledOnce).to.be.true;
      // Add more assertions to check the error response

      // Restore the stubs
      validationResultStub.restore();
      createFavoriteUtilStub.restore();
    });
  });
});
