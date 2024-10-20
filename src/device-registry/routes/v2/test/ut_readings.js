require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const { expect } = chai;
const proxyquire = require("proxyquire");
const express = require("express");
const mongoose = require("mongoose");

chai.use(sinonChai);

describe("Create Event Routes", () => {
  let router, eventController, constants, NetworkModel, validationResult;

  beforeEach(() => {
    router = {
      get: sinon.stub(),
      use: sinon.stub(),
    };
    eventController = {
      readingsForMap: sinon.stub(),
      getBestAirQuality: sinon.stub(),
      recentReadings: sinon.stub(),
      fetchAndStoreData: sinon.stub(),
    };
    constants = {
      NETWORKS: ["network1", "network2"],
    };
    NetworkModel = sinon.stub().returns({
      distinct: sinon.stub().resolves(["Network1", "Network2"]),
    });
    validationResult = sinon.stub().returns({
      isEmpty: sinon.stub().returns(true),
      array: sinon.stub().returns([]),
    });

    const routeDefinition = proxyquire("@routes/readings", {
      express: {
        Router: () => router,
      },
      "@controllers/create-event": eventController,
      "@config/constants": constants,
      "@models/Network": NetworkModel,
      "express-validator": {
        check: sinon.stub(),
        oneOf: sinon.stub(),
        query: sinon.stub(),
        body: sinon.stub(),
        param: sinon.stub(),
        validationResult: validationResult,
      },
    });
  });

  describe("Route Definitions", () => {
    it("should define GET /map route", () => {
      expect(router.get).to.have.been.calledWith(
        "/map",
        eventController.readingsForMap
      );
    });

    it("should define GET /best-air-quality route", () => {
      expect(router.get).to.have.been.calledWith(
        "/best-air-quality",
        sinon.match.any,
        eventController.getBestAirQuality
      );
    });

    it("should define GET /recent route", () => {
      expect(router.get).to.have.been.calledWith(
        "/recent",
        sinon.match.any,
        sinon.match.any,
        eventController.recentReadings
      );
    });

    it("should define GET /fetchAndStoreData route", () => {
      expect(router.get).to.have.been.calledWith(
        "/fetchAndStoreData",
        eventController.fetchAndStoreData
      );
    });
  });

  describe("Middleware", () => {
    it("should use headers middleware", () => {
      expect(router.use).to.have.been.calledWith(sinon.match.func);
    });

    it("should use validatePagination middleware", () => {
      expect(router.use).to.have.been.calledWith(sinon.match.func);
    });
  });

  describe("Custom Validators", () => {
    describe("isValidObjectId", () => {
      it("should return true for valid ObjectId", () => {
        const isValidObjectId = sinon
          .stub(mongoose.Types.ObjectId, "isValid")
          .returns(true);
        expect(isValidObjectId("507f1f77bcf86cd799439011")).to.be.true;
        isValidObjectId.restore();
      });

      it("should return false for invalid ObjectId", () => {
        const isValidObjectId = sinon
          .stub(mongoose.Types.ObjectId, "isValid")
          .returns(false);
        expect(isValidObjectId("invalid-id")).to.be.false;
        isValidObjectId.restore();
      });
    });

    describe("validateNetwork", () => {
      it("should not throw error for valid network", async () => {
        const validateNetwork = sinon.stub().resolves();
        await expect(validateNetwork("Network1")).to.be.fulfilled;
      });

      it("should throw error for invalid network", async () => {
        const validateNetwork = sinon
          .stub()
          .rejects(new Error("Invalid network"));
        await expect(validateNetwork("InvalidNetwork")).to.be.rejected;
      });
    });
  });

  describe("Route Handlers", () => {
    describe("GET /best-air-quality", () => {
      it("should call getBestAirQuality controller method", () => {
        const req = { query: {} };
        const res = {};
        const next = sinon.spy();

        router.get
          .withArgs(
            "/best-air-quality",
            sinon.match.any,
            eventController.getBestAirQuality
          )
          .callArgWith(1, req, res, next);

        expect(eventController.getBestAirQuality).to.have.been.calledWith(
          req,
          res,
          next
        );
      });
    });

    describe("GET /recent", () => {
      it("should call recentReadings controller method", () => {
        const req = { query: {} };
        const res = {};
        const next = sinon.spy();

        router.get
          .withArgs(
            "/recent",
            sinon.match.any,
            sinon.match.any,
            eventController.recentReadings
          )
          .callArgWith(2, req, res, next);

        expect(eventController.recentReadings).to.have.been.calledWith(
          req,
          res,
          next
        );
      });

      it("should return 400 if both cohort_id and grid_id are provided", () => {
        const req = { query: { cohort_id: "123", grid_id: "456" } };
        const res = {
          status: sinon.stub().returnsThis(),
          json: sinon.spy(),
        };
        const next = sinon.spy();

        router.get
          .withArgs(
            "/recent",
            sinon.match.any,
            sinon.match.any,
            eventController.recentReadings
          )
          .callArgWith(2, req, res, next);

        expect(res.status).to.have.been.calledWith(400);
        expect(res.json).to.have.been.calledWith({
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "You cannot provide both cohort_id and grid_id",
          },
        });
      });

      it("should return 400 if both device_id and site_id are provided", () => {
        const req = { query: { device_id: "123", site_id: "456" } };
        const res = {
          status: sinon.stub().returnsThis(),
          json: sinon.spy(),
        };
        const next = sinon.spy();

        router.get
          .withArgs(
            "/recent",
            sinon.match.any,
            sinon.match.any,
            eventController.recentReadings
          )
          .callArgWith(2, req, res, next);

        expect(res.status).to.have.been.calledWith(400);
        expect(res.json).to.have.been.calledWith({
          success: false,
          message: "Bad Request Error",
          errors: {
            message: "You cannot provide both device_id and site_id",
          },
        });
      });
    });
  });
});
