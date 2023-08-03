require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const express = require("express");
const request = require("supertest");
const airqloudController = require("@controllers/create-airqloud");
const { check, oneOf, query, body, param } = require("express-validator");

const app = express();
app.use(express.json());

/*************************** Mocked Data ***************************/
const mockedNetworks = ["network1", "network2", "network3"]; // Replace with relevant mocked data
const mockedAirqloud = {
  _id: "60f01365c24d4f21a0e066a2",
  name: "Mocked AirQloud",
  admin_level: "district",
  description: "Mocked AirQloud description",
  sites: ["site1", "site2"],
  metadata: { key1: "value1", key2: "value2" },
  long_name: "Mocked AirQloud Long Name",
  isCustom: true,
  location: {
    type: "Point",
    coordinates: [0, 0],
  },
  airqloud_tags: ["tag1", "tag2"],
};

/*************************** Unit Test ***************************/
describe("AirQloud Controller", () => {
  afterEach(() => {
    sinon.restore();
  });

  describe("POST /airqlouds", () => {
    it("should create a new AirQloud", async () => {
      const registerStub = sinon.stub(airqloudController, "register");
      registerStub.resolves(mockedAirqloud);

      const newAirqloud = {
        name: "Test AirQloud",
        admin_level: "village",
        description: "Test AirQloud description",
        sites: ["site3", "site4"],
        metadata: { key1: "value1", key2: "value2" },
        long_name: "Test AirQloud Long Name",
        isCustom: false,
        location: {
          type: "Point",
          coordinates: [10, 10],
        },
        airqloud_tags: ["tag3", "tag4"],
      };

      const response = await request(app)
        .post("/airqlouds")
        .query({ tenant: "test" })
        .send(newAirqloud);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedAirqloud);
      expect(registerStub.calledOnce).to.be.true;
      expect(registerStub.firstCall.args[0]).to.deep.equal(newAirqloud);
    });
  });

  describe("PUT /airqlouds/refresh", () => {
    it("should refresh an existing AirQloud", async () => {
      const refreshStub = sinon.stub(airqloudController, "refresh");
      refreshStub.resolves(mockedAirqloud);

      const airqloudId = "60f01365c24d4f21a0e066a2";

      const response = await request(app)
        .put(`/airqlouds/refresh`)
        .query({ tenant: "test", id: airqloudId });

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedAirqloud);
      expect(refreshStub.calledOnce).to.be.true;
      expect(refreshStub.firstCall.args[0]).to.deep.equal({
        id: airqloudId,
      });
    });
  });

  describe("GET /airqlouds", () => {
    it("should retrieve a list of AirQlouds", async () => {
      const listStub = sinon.stub(airqloudController, "list");
      listStub.resolves([mockedAirqloud]);

      const response = await request(app)
        .get("/airqlouds")
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(listStub.calledOnce).to.be.true;
    });
  });

  describe("GET /airqlouds/summary", () => {
    it("should retrieve a summary of AirQlouds", async () => {
      const listSummaryStub = sinon.stub(airqloudController, "listSummary");
      listSummaryStub.resolves([mockedAirqloud]);

      const response = await request(app)
        .get("/airqlouds/summary")
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(listSummaryStub.calledOnce).to.be.true;
    });
  });

  describe("GET /airqlouds/dashboard", () => {
    it("should retrieve AirQlouds dashboard data", async () => {
      const listDashboardStub = sinon.stub(airqloudController, "listDashboard");
      listDashboardStub.resolves([mockedAirqloud]);

      const response = await request(app)
        .get("/airqlouds/dashboard")
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(listDashboardStub.calledOnce).to.be.true;
    });
  });

  describe("GET /airqlouds/sites", () => {
    it("should find AirQloud sites", async () => {
      const findSitesStub = sinon.stub(airqloudController, "findSites");
      findSitesStub.resolves([mockedAirqloud]);

      const response = await request(app)
        .get("/airqlouds/sites")
        .query({ tenant: "test", id: mockedAirqloud._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(findSitesStub.calledOnce).to.be.true;
      expect(findSitesStub.firstCall.args[0]).to.deep.equal({
        id: mockedAirqloud._id,
      });
    });
  });

  describe("PUT /airqlouds", () => {
    it("should update an existing AirQloud", async () => {
      const updateStub = sinon.stub(airqloudController, "update");
      updateStub.resolves(mockedAirqloud);

      const updatedAirqloud = {
        name: "Updated AirQloud",
        admin_level: "state",
        description: "Updated AirQloud description",
        sites: ["site5", "site6"],
        metadata: { key1: "updated_value1", key2: "updated_value2" },
        long_name: "Updated AirQloud Long Name",
        isCustom: false,
        location: {
          type: "Point",
          coordinates: [20, 20],
        },
        airqloud_tags: ["tag5", "tag6"],
      };

      const response = await request(app)
        .put("/airqlouds")
        .query({ tenant: "test", id: mockedAirqloud._id })
        .send(updatedAirqloud);

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedAirqloud);
      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.deep.equal({
        id: mockedAirqloud._id,
        ...updatedAirqloud,
      });
    });
  });

  describe("DELETE /airqlouds", () => {
    it("should delete an existing AirQloud", async () => {
      const deleteStub = sinon.stub(airqloudController, "delete");
      deleteStub.resolves(mockedAirqloud);

      const response = await request(app)
        .delete("/airqlouds")
        .query({ tenant: "test", id: mockedAirqloud._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.deep.equal(mockedAirqloud);
      expect(deleteStub.calledOnce).to.be.true;
      expect(deleteStub.firstCall.args[0]).to.deep.equal({
        id: mockedAirqloud._id,
      });
    });
  });

  describe("GET /airqlouds/center", () => {
    it("should calculate the geographical center of AirQloud", async () => {
      const calculateGeographicalCenterStub = sinon.stub(
        airqloudController,
        "calculateGeographicalCenter"
      );
      calculateGeographicalCenterStub.resolves([0, 0]);

      const response = await request(app)
        .get("/airqlouds/center")
        .query({ tenant: "test", id: mockedAirqloud._id });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.deep.equal([0, 0]);
      expect(calculateGeographicalCenterStub.calledOnce).to.be.true;
      expect(calculateGeographicalCenterStub.firstCall.args[0]).to.deep.equal({
        id: mockedAirqloud._id,
      });
    });
  });

  describe("GET /airqlouds/combined/:net_id/summary", () => {
    it("should retrieve a summary of AirQlouds for a specific network", async () => {
      const listCohortsAndGridsSummaryStub = sinon.stub(
        airqloudController,
        "listCohortsAndGridsSummary"
      );
      listCohortsAndGridsSummaryStub.resolves([mockedAirqloud]);

      const networkId = "network1"; // Replace with a valid network ID

      const response = await request(app)
        .get(`/airqlouds/combined/${networkId}/summary`)
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(listCohortsAndGridsSummaryStub.calledOnce).to.be.true;
      expect(listCohortsAndGridsSummaryStub.firstCall.args[0]).to.deep.equal({
        tenant: "test",
        net_id: networkId,
      });
    });
  });

  describe("GET /airqlouds/combined/:net_id", () => {
    it("should retrieve combined data of AirQlouds for a specific network", async () => {
      const listCohortsAndGridsStub = sinon.stub(
        airqloudController,
        "listCohortsAndGrids"
      );
      listCohortsAndGridsStub.resolves([mockedAirqloud]);

      const networkId = "network1"; // Replace with a valid network ID

      const response = await request(app)
        .get(`/airqlouds/combined/${networkId}`)
        .query({ tenant: "test" });

      expect(response.status).to.equal(200);
      expect(response.body).to.be.an("array");
      expect(response.body).to.have.lengthOf(1);
      expect(response.body[0]).to.deep.equal(mockedAirqloud);
      expect(listCohortsAndGridsStub.calledOnce).to.be.true;
      expect(listCohortsAndGridsStub.firstCall.args[0]).to.deep.equal({
        tenant: "test",
        net_id: networkId,
      });
    });
  });
});
