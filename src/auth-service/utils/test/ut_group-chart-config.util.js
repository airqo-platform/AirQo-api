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
  const siteId = "507f1f77bcf86cd799439015";

  afterEach(function() {
    rewireGroupChartConfigUtil.__set__(
      "GroupChartConfigModel",
      origGroupChartConfigModel
    );
    sinon.restore();
  });

  describe("create", function() {
    let createStub;

    beforeEach(function() {
      createStub = sinon.stub();
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        create: createStub,
      }));
    });

    it("rejects a chartConfig with no fieldId", async function() {
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig: {}, device_ids: [deviceId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(createStub.called).to.equal(false);
    });

    it("creates a new document scoped to the given device_ids/site_ids and stamps audit fields", async function() {
      const chartConfig = { fieldId: 1, title: "PM2.5" };
      createStub.resolves({
        chartConfigurations: [chartConfig],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig, device_ids: [deviceId], site_ids: [siteId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(createStub.calledOnce).to.equal(true);
      const [doc] = createStub.getCall(0).args;
      expect(doc.group_id).to.equal(groupId);
      expect(doc.device_ids).to.deep.equal([deviceId]);
      expect(doc.site_ids).to.deep.equal([siteId]);
      expect(doc.chartConfigurations).to.deep.equal([chartConfig]);
      expect(doc.created_by).to.equal(userId);
      expect(doc.updated_by).to.equal(userId);
      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal(chartConfig);
    });

    it("defaults device_ids/site_ids to empty arrays when omitted from the body", async function() {
      const chartConfig = { fieldId: 1 };
      createStub.resolves({ chartConfigurations: [chartConfig] });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig },
        user: { _id: userId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.create(request, next);

      const [doc] = createStub.getCall(0).args;
      expect(doc.device_ids).to.deep.equal([]);
      expect(doc.site_ids).to.deep.equal([]);
    });

    it("returns an internal error response when the model throws", async function() {
      createStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig: { fieldId: 1 }, device_ids: [deviceId] },
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

    it("returns 404 when no group chart config contains this chartId", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: { title: "New title" },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(findOneStub.getCall(0).args[0]).to.deep.equal({
        group_id: groupId,
        "chartConfigurations._id": chartId,
      });
    });

    it("only applies whitelisted chart properties and persists via save()", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = { _id: { toString: () => chartId }, title: "Old title" };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [deviceId],
        site_ids: [],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
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

    it("updates device_ids/site_ids on the whole document when provided", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = { _id: { toString: () => chartId }, title: "Old title" };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [deviceId],
        site_ids: [],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const newDeviceIds = [deviceId, "507f1f77bcf86cd799439099"];
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: { device_ids: newDeviceIds, site_ids: [siteId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.update(request, next);

      expect(doc.device_ids).to.deep.equal(newDeviceIds);
      expect(doc.site_ids).to.deep.equal([siteId]);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
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

    it("returns 404 when nothing matches the group/chart filter", async function() {
      updateOneStub.resolves({ matchedCount: 0, modifiedCount: 0 });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("pulls the chart atomically in a single updateOne, keyed on group_id + chartId only — no read-modify-write race with a concurrent update", async function() {
      updateOneStub.resolves({ matchedCount: 1, modifiedCount: 1 });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(updateOneStub.calledOnce).to.equal(true);
      const [filter, update] = updateOneStub.getCall(0).args;
      expect(filter).to.deep.equal({
        group_id: groupId,
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
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("list", function() {
    let findStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      findStub = sinon.stub();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        find: findStub,
      }));
    });

    it("returns an empty array (still success) when nothing exists yet for this group", async function() {
      findStub.resolves([]);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal([]);
      expect(findStub.getCall(0).args[0]).to.deep.equal({
        group_id: groupId,
      });
    });

    it("returns the group's saved chart config documents when present", async function() {
      const docs = [
        { group_id: groupId, device_ids: [deviceId], site_ids: [] },
        { group_id: groupId, device_ids: [], site_ids: [siteId] },
      ];
      findStub.resolves(docs);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.data).to.deep.equal(docs);
    });

    it("narrows the filter by device_id/site_id query params when provided", async function() {
      findStub.resolves([]);
      const request = {
        query: { tenant: "airqo", device_id: deviceId, site_id: siteId },
        params: { groupId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.list(request, next);

      expect(findStub.getCall(0).args[0]).to.deep.equal({
        group_id: groupId,
        device_ids: deviceId,
        site_ids: siteId,
      });
    });

    it("honors limit/skip from the route's pagination() middleware", async function() {
      const docs = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      findStub.resolves(docs);
      const request = {
        query: { tenant: "airqo", limit: 2, skip: 1 },
        params: { groupId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.data).to.deep.equal([{ id: 2 }, { id: 3 }]);
    });

    it("returns an internal error response when the model throws", async function() {
      findStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
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

    it("returns 404 when the group has no chart config doc containing this chartId", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("returns 404 when the specific chart isn't in the array", async function() {
      findOneStub.resolves({
        device_ids: [deviceId],
        site_ids: [],
        chartConfigurations: [{ _id: { toString: () => "other-id" } }],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("returns the chart merged with the parent doc's device_ids/site_ids scope", async function() {
      const chart = {
        _id: { toString: () => chartId },
        fieldId: 3,
        toObject: () => ({ _id: chartId, fieldId: 3 }),
      };
      findOneStub.resolves({
        device_ids: [deviceId],
        site_ids: [siteId],
        chartConfigurations: [chart],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal({
        _id: chartId,
        fieldId: 3,
        device_ids: [deviceId],
        site_ids: [siteId],
      });
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.getById(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
});
