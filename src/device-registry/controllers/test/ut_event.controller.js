require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const expect = chai.expect;
const should = chai.should();
const chaiHttp = require("chai-http");
const httpStatus = require("http-status");
const { HttpError } = require("@utils/shared");
const createEventUtil = require("@utils/event.util");
const { readingsForMap } = require("@controllers/event.controller");

chai.use(sinonChai);
chai.use(chaiHttp);

const { createEvent } = require("@controllers/event.controller");

describe("Create Event Controller", () => {
  describe("addValues", () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        query: {},
        body: {},
      };
      res = {
        json: sinon.spy(),
        status: sinon.stub().returns(res),
        send: sinon.spy(),
      };
      next = sinon.spy();
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should call insert method with correct parameters", async () => {
      const measurements = {
        /* sample measurements */
      };
      req.body = measurements;

      await createEvent.addValues(req, res, next);

      expect(createEventUtil.insert).to.have.been.calledWith(
        sinon.match.any,
        sinon.match.any,
        sinon.match.any
      );
    });

    it("should handle bad request errors", async () => {
      const errors = [{ field: "test", message: "Test error" }];
      req.body = {};

      await createEvent.addValues(req, res, next);

      expect(next).to.have.been.calledWith(
        new HttpError("bad request errors", httpStatus.BAD_REQUEST, errors)
      );
    });

    it("should return OK status on successful insertion", async () => {
      const result = { success: true, message: "success" };
      sinon.stub(createEventUtil, "insert").resolves(result);

      await createEvent.addValues(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "successfully added all the events",
      });
    });

    it("should return BAD_REQUEST status on failed insertion", async () => {
      const result = { success: false, errors: ["error"] };
      sinon.stub(createEventUtil, "insert").resolves(result);

      await createEvent.addValues(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.BAD_REQUEST);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "finished the operation with some errors",
        errors: ["error"],
      });
    });

    it("should handle internal server errors", async () => {
      const error = new Error("Internal Server Error");
      sinon.stub(createEventUtil, "insert").rejects(error);

      await createEvent.addValues(req, res, next);

      expect(next).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Internal Server Error" }
        )
      );
    });
  });
  describe("listFromBigQuery", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { format: "csv" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
        type: sinon.spy(),
        send: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, status: httpStatus.OK, data: [] };
      sinon
        .stub(createEventUtil, "getMeasurementsFromBigQuery")
        .resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return CSV format", async () => {
      await listFromBigQuery(req, res, next);

      expect(res.type).to.have.been.calledWith("text/csv");
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.send).to.have.been.calledWith(sinon.match.array);
    });

    it("should return JSON format", async () => {
      req.query.format = "";
      await listFromBigQuery(req, res, next);

      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listFromBigQuery(req, res, next);

      expect(next).to.have.been.calledWith(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: "Error message" }
        )
      );
    });
  });

  describe("latestFromBigQuery", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: {},
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "latestFromBigQuery").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return cached data", async () => {
      await latestFromBigQuery(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await latestFromBigQuery(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("list", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        params: { site_id: "123", device_id: "456" },
        query: { tenant: "custom" },
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should filter by site_id and device_id", async () => {
      await list(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await list(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("fetchAndStoreData", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message" };
      sinon.stub(createEventUtil, "fetchAndStoreData").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should fetch and store data", async () => {
      await fetchAndStoreData(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await fetchAndStoreData(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("getBestAirQuality", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message", data: [] };
      sinon.stub(createEventUtil, "getBestAirQuality").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return air quality measurements", async () => {
      await getBestAirQuality(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await getBestAirQuality(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("readingsForMap", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message", data: [] };
      sinon.stub(createEventUtil, "read").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return air quality measurements", async () => {
      await readingsForMap(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await readingsForMap(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("readingsForMap", () => {
    let req, res, next;

    beforeEach(() => {
      req = {
        query: { tenant: "airqo" },
        params: {},
      };
      res = {
        status: sinon.stub().returnsThis(),
        json: sinon.stub(),
      };
      next = sinon.spy();
      sinon.stub(createEventUtil, "processCohortIds").resolves();
    });

    afterEach(() => {
      sinon.restore();
    });

    it("should return measurements when no cohort_id is provided", async () => {
      const mockResult = {
        success: true,
        data: [{ measurement: "data" }],
        message: "Success",
      };
      sinon.stub(createEventUtil, "read").resolves(mockResult);

      await readingsForMap(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Success",
        measurements: [{ measurement: "data" }],
      });
    });

    it("should return measurements for a valid cohort_id with devices", async () => {
      req.query.cohort_id = "valid_cohort_id";
      req.query.device_id = "device1,device2"; // Simulating processCohortIds populating this

      const mockResult = {
        success: true,
        data: [{ measurement: "cohort_data" }],
        message: "Cohort success",
      };
      sinon.stub(createEventUtil, "read").resolves(mockResult);

      await readingsForMap(req, res, next);

      expect(createEventUtil.processCohortIds).to.have.been.calledOnce;
      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "Cohort success",
        measurements: [{ measurement: "cohort_data" }],
      });
    });

    it("should return a 400 Bad Request when cohort_id has no devices", async () => {
      req.query.cohort_id = "empty_cohort_id";
      // processCohortIds will not populate device_id for an empty cohort

      await readingsForMap(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.BAD_REQUEST);
    });
  });

  describe("listEventsForAllDevices", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return cached data for devices", async () => {
      await listEventsForAllDevices(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listEventsForAllDevices(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listRecent", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", cohort_id: "123" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return cached data for recent events", async () => {
      await listRecent(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors due to missing device ID", async () => {
      await listRecent(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors due to missing site ID", async () => {
      req.query.cohort_id = "456";
      await listRecent(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listHistorical", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return cached data for historical events", async () => {
      await listHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors due to missing device ID", async () => {
      req.query.cohort_id = "123";
      await listHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors due to missing site ID", async () => {
      req.query.grid_id = "789";
      await listHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listRunningDevices", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [{}, {}] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return running devices", async () => {
      await listRunningDevices(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listRunningDevices(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should remove AQI-related fields from devices", async () => {
      mockResult.data = [
        {
          meta: {},
          data: [
            {
              aqi_color: "red",
              aqi_category: "very poor",
              aqi_color_name: "Red",
            },
          ],
        },
      ];
      await listRunningDevices(req, res, next);

      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(mockResult.data[0].data[0]).not.to.have.property("aqi_color");
      expect(mockResult.data[0].data[0]).not.to.have.property("aqi_category");
      expect(mockResult.data[0].data[0]).not.to.have.property("aqi_color_name");
    });
  });

  describe("listGood", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", index: "good" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return good air quality measurements", async () => {
      await listGood(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listGood(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listModerate", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", index: "moderate" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return moderate air quality measurements", async () => {
      await listModerate(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listModerate(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });
  describe("listU4sg", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return U4SG air quality measurements", async () => {
      await listU4sg(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listU4sg(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listUnhealthy", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return unhealthy air quality measurements", async () => {
      await listUnhealthy(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listUnhealthy(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listVeryUnhealthy", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return very unhealthy air quality measurements", async () => {
      await listVeryUnhealthy(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listVeryUnhealthy(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("listHazardous", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should return hazardous air quality measurements", async () => {
      await listHazardous(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });

    it("should handle errors", async () => {
      mockResult.success = false;
      mockResult.message = "Error message";
      mockResult.errors = ["error"];

      await listHazardous(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
    });
  });

  describe("transform", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Success message",
        data: [{}, {}],
      };
      sinon.stub(createEventUtil, "transformManyEvents").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should transform events successfully", async () => {
      await transform(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        message: mockResult.message,
        transformedEvents: mockResult.data,
      });
    });

    it("should handle errors during transformation", async () => {
      mockResult.success = false;
      mockResult.message = "Transformation error";
      mockResult.errors = ["error"];

      await transform(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });
  });

  describe("create", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message", errors: {} };
      sinon.stub(createEventUtil, "create").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should create event successfully", async () => {
      await create(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });

    it("should handle errors during creation", async () => {
      mockResult.success = false;
      mockResult.message = "Creation error";
      mockResult.errors = ["error"];

      await create(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });
  });

  describe("transmitMultipleSensorValues", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", device_number: "123", chid: "456" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Success message",
        data: [{ id: 1, value: "test" }],
      };
      sinon
        .stub(createEventUtil, "transmitMultipleSensorValues")
        .resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should transmit multiple sensor values successfully", async () => {
      await transmitMultipleSensorValues(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        result: mockResult.data,
      });
    });

    it("should handle errors during transmission", async () => {
      mockResult.success = false;
      mockResult.message = "Transmission error";
      mockResult.errors = ["error"];

      await transmitMultipleSensorValues(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });
  });

  describe("bulkTransmitMultipleSensorValues", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", device_number: "123", chid: "456" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message" };
      sinon
        .stub(createEventUtil, "bulkTransmitMultipleSensorValues")
        .resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should bulk transmit multiple sensor values successfully", async () => {
      await bulkTransmitMultipleSensorValues(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
      });
    });

    it("should handle errors during bulk transmission", async () => {
      mockResult.success = false;
      mockResult.message = "Bulk transmission error";
      mockResult.errors = ["error"];

      await bulkTransmitMultipleSensorValues(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });
  });

  describe("transmitValues", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Success message",
        data: [{ id: 1, value: "test" }],
      };
      sinon.stub(createEventUtil, "transmitValues").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should transmit values successfully", async () => {
      await transmitValues(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        result: mockResult.data,
      });
    });

    it("should handle errors during transmission", async () => {
      mockResult.success = false;
      mockResult.message = "Transmission error";
      mockResult.errors = ["error"];

      await transmitValues(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: mockResult.message,
        errors: mockResult.errors,
      });
    });
  });
  describe("deleteValuesOnPlatform", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = { success: true, message: "Success message", data: [] };
      sinon.stub(createEventUtil, "clearEventsOnPlatform").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should delete values on platform successfully", async () => {
      await deleteValuesOnPlatform(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: mockResult.message,
        data: mockResult.data,
      });
    });

    it("should handle errors during deletion", async () => {
      mockResult.success = false;
      mockResult.message = "Deletion error";
      mockResult.error = ["error"];

      await deleteValuesOnPlatform(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: mockResult.message,
        errors: mockResult.error,
      });
    });
  });

  describe("addEvents", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        message: "Success message",
        data: [],
        error: null,
      };
      sinon.stub(createEventUtil, "addEvents").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should add events successfully", async () => {
      await addEvents(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        message: "successfully added all the events",
        stored_events: mockResult.data,
        errors: mockResult.error,
      });
    });

    it("should handle errors during addition", async () => {
      mockResult.success = false;
      mockResult.message = "Addition error";
      mockResult.error = ["error"];

      await addEvents(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        message: "finished the operation with some errors",
        errors: mockResult.error,
      });
    });
  });

  describe("listByAirQloud", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", site_id: "123", recent: "yes" },
        params: { airqloud_id: "abc" },
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by AirQloud ID successfully", async () => {
      await listByAirQloud(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing AirQloud IDs", async () => {
      req = {
        query: { tenant: "custom", airqloud_id: "invalid" },
        params: {},
        query: {},
      };
      await listByAirQloud(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided AirQloud IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByAirQloudHistorical", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", airqloud_id: "abc" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by AirQloud ID historically successfully", async () => {
      await listByAirQloudHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing AirQloud IDs", async () => {
      req = {
        query: { tenant: "custom", airqloud_id: "invalid" },
        params: {},
        query: {},
      };
      await listByAirQloudHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided AirQloud IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByGridHistorical", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", grid_id: "xyz" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by Grid ID historically successfully", async () => {
      await listByGridHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing Grid IDs", async () => {
      req = {
        query: { tenant: "custom", grid_id: "invalid" },
        params: {},
        query: {},
      };
      await listByGridHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided Grid IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByGrid", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", grid_id: "xyz" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by Grid ID successfully", async () => {
      await listByGrid(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing Grid IDs", async () => {
      req = {
        query: { tenant: "custom", grid_id: "invalid" },
        params: {},
        query: {},
      };
      await listByGrid(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided Grid IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByCohort", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", cohort_id: "abc" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by Cohort ID successfully", async () => {
      await listByCohort(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing Cohort IDs", async () => {
      req = {
        query: { tenant: "custom", cohort_id: "invalid" },
        params: {},
        query: {},
      };
      await listByCohort(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided Cohort IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByCohortHistorical", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        query: { tenant: "custom", cohort_id: "abc" },
        params: {},
        query: {},
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: [{ meta: {}, data: [] }],
      };
      sinon.stub(createEventUtil, "list").resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by Cohort ID historically successfully", async () => {
      await listByCohortHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.data[0].meta,
        measurements: mockResult.data[0].data,
      });
    });

    it("should handle errors when processing Cohort IDs", async () => {
      req = {
        query: { tenant: "custom", cohort_id: "invalid" },
        params: {},
        query: {},
      };
      await listByCohortHistorical(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: false,
        errors: {
          message: `Unable to process measurements for the provided Cohort IDs invalid`,
        },
        message: "Internal Server Error",
      });
    });
  });

  describe("listByLatLong", () => {
    let req, res, next, mockResult;

    beforeEach(() => {
      req = {
        params: { latitude: "12.3456", longitude: "-78.9012" },
        query: { tenant: "custom", radius: "100" },
      };
      res = {
        status: sinon.spy(),
        json: sinon.spy(),
      };
      next = sinon.spy();
      mockResult = {
        success: true,
        isCache: true,
        message: "Success message",
        data: ["site1"],
      };
      sinon.stub(getSitesFromLatitudeAndLongitude).resolves(mockResult);
    });

    afterEach(() => {
      sinon.restoreDefaultSpyCache();
    });

    it("should list events by latitude and longitude successfully", async () => {
      await listByLatLong(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: mockResult.isCache,
        message: mockResult.message,
        meta: mockResult.meta,
        measurements: mockResult.data,
      });
    });

    it("should handle errors when getting sites from latitude and longitude", async () => {
      const errorMockResult = {
        success: false,
        message: "Error fetching sites",
      };
      sinon.stub(getSitesFromLatitudeAndLongitude).rejects(errorMockResult);

      await listByLatLong(req, res, next);

      expect(res.status).to.have.been.calledWith(
        httpStatus.INTERNAL_SERVER_ERROR
      );
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith(errorMockResult);
    });

    it("should handle empty result from getSitesFromLatitudeAndLongitude", async () => {
      const emptyMockResult = { success: true, data: [] };
      sinon.stub(getSitesFromLatitudeAndLongitude).resolves(emptyMockResult);

      await listByLatLong(req, res, next);

      expect(res.status).to.have.been.calledWith(httpStatus.OK);
      expect(res.json).to.have.been.calledWith(sinon.match.object);
      expect(res.json).to.have.been.calledWith({
        success: true,
        isCache: emptyMockResult.isCache,
        message: emptyMockResult.message,
        meta: emptyMockResult.meta,
        measurements: [],
      });
    });
  });
});
