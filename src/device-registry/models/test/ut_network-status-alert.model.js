require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const mongoose = require("mongoose");
const httpStatus = require("http-status");
const path = require("path");
const proxyquire = require("proxyquire");

describe("NetworkStatusAlert Model", () => {
  let Model;

  before(() => {
    const NetworkStatusAlertModel = proxyquire(
      path.resolve(__dirname, "../NetworkStatusAlert"),
      {
        "@config/database": {
          getModelByTenant: (_tenant, name, schema) => {
            try { return mongoose.model(name, schema); }
            catch (_) { return mongoose.model(name); }
          },
        },
      }
    );
    Model = NetworkStatusAlertModel("airqo");
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("Schema fields", () => {
    it("should define checked_at as required Date", () => {
      const path = Model.schema.path("checked_at");
      expect(path).to.exist;
      expect(path.instance).to.equal("Date");
      expect(path.isRequired).to.be.true;
    });

    it("should define total_deployed_devices as required Number", () => {
      const path = Model.schema.path("total_deployed_devices");
      expect(path).to.exist;
      expect(path.instance).to.equal("Number");
      expect(path.isRequired).to.be.true;
    });

    it("should set operational_count default to 0", () => {
      const path = Model.schema.path("operational_count");
      expect(path.defaultValue).to.equal(0);
    });

    it("should define status with enum [OK, WARNING, CRITICAL]", () => {
      const path = Model.schema.path("status");
      expect(path.enumValues).to.include.members(["OK", "WARNING", "CRITICAL"]);
      expect(path.defaultValue).to.equal("OK");
    });

    it("should define severity with enum [LOW, MEDIUM, HIGH]", () => {
      const path = Model.schema.path("severity");
      expect(path.enumValues).to.include.members(["LOW", "MEDIUM", "HIGH"]);
      expect(path.defaultValue).to.equal("LOW");
    });

    it("should define threshold_exceeded as required Boolean with default false", () => {
      const path = Model.schema.path("threshold_exceeded");
      expect(path.instance).to.equal("Boolean");
      expect(path.isRequired).to.be.true;
      expect(path.defaultValue).to.equal(false);
    });

    it("should define alert_type with default NETWORK_STATUS", () => {
      const path = Model.schema.path("alert_type");
      expect(path.defaultValue).to.equal("NETWORK_STATUS");
    });

    it("should define tenant as required with lowercase", () => {
      const path = Model.schema.path("tenant");
      expect(path.isRequired).to.be.true;
    });

    it("should define day_of_week as required Number", () => {
      const path = Model.schema.path("day_of_week");
      expect(path.isRequired).to.be.true;
      expect(path.instance).to.equal("Number");
    });

    it("should define hour_of_day as required Number", () => {
      const path = Model.schema.path("hour_of_day");
      expect(path.isRequired).to.be.true;
    });

    it("should have timestamps enabled", () => {
      expect(Model.schema.options.timestamps).to.be.true;
    });

    it("should define cohort_breakdown as an array field", () => {
      const path = Model.schema.path("cohort_breakdown");
      expect(path).to.exist;
      expect(path.instance).to.equal("Array");
    });
  });

  describe("Static method: register", () => {
    it("should return success response when create succeeds", async () => {
      const fakeDoc = {
        _id: new mongoose.Types.ObjectId(),
        _doc: { checked_at: new Date(), status: "OK", message: "ok" },
      };
      sinon.stub(Model, "create").resolves(fakeDoc);
      const next = sinon.spy();

      const result = await Model.register(
        {
          checked_at: new Date(),
          total_deployed_devices: 100,
          not_transmitting_devices_count: 5,
          not_transmitting_percentage: 5,
          status: "OK",
          message: "ok",
          threshold_exceeded: false,
          threshold_value: 35,
          tenant: "airqo",
          environment: "test",
          day_of_week: 1,
          hour_of_day: 8,
        },
        next
      );

      expect(result.success).to.be.true;
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(result.message).to.equal("Network status alert created");
      expect(next.called).to.be.false;
    });

    it("should call next with HttpError when create throws validation error", async () => {
      const error = new Error("validation error");
      error.errors = { status: { message: "invalid status" } };
      sinon.stub(Model, "create").rejects(error);
      const next = sinon.spy();

      await Model.register({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: list", () => {
    it("should return success with data when records exist", async () => {
      const fakeRecords = [{ _id: "abc", status: "OK" }];
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves(fakeRecords),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeRecords);
      expect(result.status).to.equal(httpStatus.OK);
    });

    it("should return empty array when no records exist", async () => {
      const fakeQuery = {
        sort: sinon.stub().returnsThis(),
        skip: sinon.stub().returnsThis(),
        limit: sinon.stub().returnsThis(),
        lean: sinon.stub().resolves([]),
      };
      sinon.stub(Model, "find").returns(fakeQuery);
      const next = sinon.spy();

      const result = await Model.list({}, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
    });

    it("should call next when find throws", async () => {
      sinon.stub(Model, "find").throws(new Error("db error"));
      const next = sinon.spy();

      await Model.list({}, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: executeAggregation", () => {
    it("should return success with aggregation results", async () => {
      const fakeResult = [{ _id: null, totalAlerts: 10 }];
      sinon.stub(Model, "aggregate").resolves(fakeResult);
      const next = sinon.spy();

      const result = await Model.executeAggregation({ pipeline: [] }, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeResult);
    });

    it("should return empty array when aggregation yields nothing", async () => {
      sinon.stub(Model, "aggregate").resolves([]);
      const next = sinon.spy();

      const result = await Model.executeAggregation({ pipeline: [] }, next);

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal([]);
    });

    it("should call next when aggregate throws", async () => {
      sinon.stub(Model, "aggregate").rejects(new Error("agg error"));
      const next = sinon.spy();

      await Model.executeAggregation({ pipeline: [] }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: getStatisticsByCohort", () => {
    it("should unwind cohort_breakdown, match cohort_id, and call executeAggregation", async () => {
      const execStub = sinon
        .stub(Model, "executeAggregation")
        .resolves({ success: true, data: [] });
      const next = sinon.spy();

      await Model.getStatisticsByCohort(
        { filter: {}, cohort_id: "60f5a1b2c3d4e5f678901234" },
        next
      );

      expect(execStub.calledOnce).to.be.true;
      const { pipeline } = execStub.firstCall.args[0];
      expect(
        pipeline.some(
          (stage) => stage.$unwind && stage.$unwind.path === "$cohort_breakdown"
        )
      ).to.be.true;
      expect(
        pipeline.some(
          (stage) =>
            stage.$match &&
            stage.$match["cohort_breakdown.cohort_id"] ===
              "60f5a1b2c3d4e5f678901234"
        )
      ).to.be.true;
    });

    it("should call next when aggregation fails", async () => {
      sinon.stub(Model, "aggregate").rejects(new Error("cohort agg error"));
      const next = sinon.spy();

      await Model.getStatisticsByCohort({ filter: {} }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: getHourlyTrendsByCohort", () => {
    it("should match on cohort_id and call executeAggregation", async () => {
      const execStub = sinon
        .stub(Model, "executeAggregation")
        .resolves({ success: true, data: [] });
      const next = sinon.spy();

      await Model.getHourlyTrendsByCohort(
        { filter: {}, cohort_id: "60f5a1b2c3d4e5f678901234" },
        next
      );

      expect(execStub.calledOnce).to.be.true;
      const { pipeline } = execStub.firstCall.args[0];
      expect(
        pipeline.some(
          (stage) =>
            stage.$match &&
            stage.$match["cohort_breakdown.cohort_id"] ===
              "60f5a1b2c3d4e5f678901234"
        )
      ).to.be.true;
    });

    it("should call next when aggregation fails", async () => {
      sinon.stub(Model, "aggregate").rejects(new Error("trend agg error"));
      const next = sinon.spy();

      await Model.getHourlyTrendsByCohort(
        { filter: {}, cohort_id: "60f5a1b2c3d4e5f678901234" },
        next
      );

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Static method: getUptimeSummaryByCohort", () => {
    it("should match on cohort_id and call executeAggregation", async () => {
      const execStub = sinon
        .stub(Model, "executeAggregation")
        .resolves({ success: true, data: [] });
      const next = sinon.spy();

      await Model.getUptimeSummaryByCohort(
        { filter: {}, cohort_id: "60f5a1b2c3d4e5f678901234" },
        next
      );

      expect(execStub.calledOnce).to.be.true;
      const { pipeline } = execStub.firstCall.args[0];
      expect(
        pipeline.some(
          (stage) =>
            stage.$match &&
            stage.$match["cohort_breakdown.cohort_id"] ===
              "60f5a1b2c3d4e5f678901234"
        )
      ).to.be.true;
    });

    it("should call next when aggregation fails", async () => {
      sinon.stub(Model, "aggregate").rejects(new Error("uptime agg error"));
      const next = sinon.spy();

      await Model.getUptimeSummaryByCohort(
        { filter: {}, cohort_id: "60f5a1b2c3d4e5f678901234" },
        next
      );

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("Instance method: toJSON", () => {
    it("should return the expected shape", () => {
      const doc = new Model({
        checked_at: new Date(),
        total_deployed_devices: 50,
        not_transmitting_devices_count: 2,
        not_transmitting_percentage: 4,
        status: "OK",
        message: "ok",
        threshold_exceeded: false,
        threshold_value: 35,
        tenant: "airqo",
        environment: "test",
        day_of_week: 0,
        hour_of_day: 12,
      });

      const json = doc.toJSON();

      expect(json).to.have.property("_id");
      expect(json).to.have.property("checked_at");
      expect(json).to.have.property("status", "OK");
      expect(json).to.have.property("tenant", "airqo");
    });
  });
});
