require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");
const sinonChai = require("sinon-chai");
chai.use(sinonChai);

const rewireGroupChartConfigUtil = rewire("@utils/group-chart-config.util");

describe("group-chart-config UTIL", function() {
  let origGroupChartConfigModel;
  const userId = "507f1f77bcf86cd799439011";
  const groupId = "507f1f77bcf86cd799439012";
  const deviceId = "507f1f77bcf86cd799439013";
  const chartId = "507f1f77bcf86cd799439014";

  afterEach(function() {
    rewireGroupChartConfigUtil.__set__(
      "GroupChartConfigModel",
      origGroupChartConfigModel
    );
    sinon.restore();
  });

  describe("create", function() {
    let findOneAndUpdateStub;

    beforeEach(function() {
      findOneAndUpdateStub = sinon.stub();
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        findOneAndUpdate: findOneAndUpdateStub,
      }));
    });

    it("rejects a chartConfig with no fieldId", async function() {
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
        body: { chartConfig: {} },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(findOneAndUpdateStub.called).to.equal(false);
    });

    it("upserts atomically, keyed on (group_id, device_id) — the same shape that keeps the personal chart create safe from duplicate-key errors — and stamps audit fields", async function() {
      const chartConfig = { fieldId: 1, title: "PM2.5" };
      findOneAndUpdateStub.resolves({
        chartConfigurations: [chartConfig],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
        body: { chartConfig },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(findOneAndUpdateStub.calledOnce).to.equal(true);
      const [filter, update, options] = findOneAndUpdateStub.getCall(0).args;
      expect(filter).to.deep.equal({ group_id: groupId, device_id: deviceId });
      expect(update.$push.chartConfigurations).to.deep.equal(chartConfig);
      expect(update.$set.updated_by).to.equal(userId);
      expect(update.$setOnInsert.group_id).to.equal(groupId);
      expect(update.$setOnInsert.device_id).to.equal(deviceId);
      expect(update.$setOnInsert.created_by).to.equal(userId);
      expect(options.upsert).to.equal(true);
      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal(chartConfig);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneAndUpdateStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
        body: { chartConfig: { fieldId: 1 } },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("update", function() {
    let findOneStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      findOneStub = sinon.stub();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns 404 when no group chart config exists for this device", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        body: { title: "New title" },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("only applies whitelisted chart properties and persists via save()", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = { _id: { toString: () => chartId }, title: "Old title" };
      const doc = {
        chartConfigurations: [chart],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        body: { title: "New title", notAllowedField: "ignore me" },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(chart.title).to.equal("New title");
      expect(chart.notAllowedField).to.equal(undefined);
      expect(doc.updated_by).to.equal(userId);
      expect(saveStub.calledOnce).to.equal(true);
      expect(result.success).to.equal(true);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        body: { title: "New title" },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("delete", function() {
    let updateOneStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      updateOneStub = sinon.stub();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        updateOne: updateOneStub,
      }));
    });

    it("returns 404 when nothing matches the group/device/chart filter", async function() {
      updateOneStub.resolves({ matchedCount: 0, modifiedCount: 0 });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("pulls the chart atomically in a single updateOne — no read-modify-write race with a concurrent update", async function() {
      updateOneStub.resolves({ matchedCount: 1, modifiedCount: 1 });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(updateOneStub.calledOnce).to.equal(true);
      const [filter, update] = updateOneStub.getCall(0).args;
      expect(filter).to.deep.equal({
        group_id: groupId,
        device_id: deviceId,
        "chartConfigurations._id": chartId,
      });
      expect(update.$pull).to.deep.equal({
        chartConfigurations: { _id: chartId },
      });
      expect(update.$set.updated_by).to.equal(userId);
      expect(result.success).to.equal(true);
    });

    it("returns an internal error response when the model throws", async function() {
      updateOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", function() {
    let findOneStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      findOneStub = sinon.stub();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns an empty array (still success) when nothing exists yet for this device", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal([]);
    });

    it("returns the group's chart configurations when present", async function() {
      const charts = [{ fieldId: 1 }, { fieldId: 2 }];
      findOneStub.resolves({ chartConfigurations: charts });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.data).to.deep.equal(charts);
    });

    it("honors limit/skip from the route's pagination() middleware", async function() {
      const charts = [
        { fieldId: 1 },
        { fieldId: 2 },
        { fieldId: 3 },
        { fieldId: 4 },
      ];
      findOneStub.resolves({ chartConfigurations: charts });
      const request = {
        query: { tenant: "airqo", limit: 2, skip: 1 },
        params: { groupId, deviceId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.data).to.deep.equal([{ fieldId: 2 }, { fieldId: 3 }]);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getById", function() {
    let findOneStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      findOneStub = sinon.stub();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns 404 when the group has no chart config doc for this device", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("returns 404 when the specific chart isn't in the array", async function() {
      findOneStub.resolves({
        chartConfigurations: [{ _id: { toString: () => "other-id" } }],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("returns the chart when found", async function() {
      const chart = { _id: { toString: () => chartId }, fieldId: 3 };
      findOneStub.resolves({ chartConfigurations: [chart] });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.equal(chart);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, deviceId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
