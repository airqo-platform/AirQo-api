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

    it("rejects when device_ids and site_ids are both omitted (defaulted to empty arrays)", async function() {
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig: { fieldId: 1 } },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(createStub.called).to.equal(false);
    });

    it("rejects when device_ids and site_ids are both explicitly empty arrays — same 400 the route validators enforce, so a validator-bypassing call still fails cleanly instead of hitting the schema and 500ing", async function() {
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig: { fieldId: 1 }, device_ids: [], site_ids: [] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(createStub.called).to.equal(false);
    });

    it("defaults the omitted one to an empty array when only one of device_ids/site_ids is given", async function() {
      const chartConfig = { fieldId: 1 };
      createStub.resolves({ chartConfigurations: [chartConfig] });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig, device_ids: [deviceId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.create(request, next);

      const [doc] = createStub.getCall(0).args;
      expect(doc.device_ids).to.deep.equal([deviceId]);
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

    it("rejects (400, before any DB write) a sites entry whose site_id isn't in the request's (parent-level) site_ids", async function() {
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: {
          chartConfig: {
            fieldId: 1,
            sites: [{ site_id: "507f1f77bcf86cd799439099", name: "Other site" }],
          },
          site_ids: [siteId],
        },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(createStub.called).to.equal(false);
    });

    it("accepts sites/devices entries that match the request's (parent-level) site_ids/device_ids", async function() {
      const chartConfig = {
        fieldId: 1,
        sites: [{ site_id: siteId, name: "Site A" }],
      };
      createStub.resolves({ chartConfigurations: [chartConfig] });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
        body: { chartConfig, site_ids: [siteId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.create(request, next);

      expect(result.success).to.equal(true);
      expect(createStub.calledOnce).to.equal(true);
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

    it("rejects (400, no save()) a partial update that narrows the parent doc's site_ids without also updating the chart's now-stale sites snapshot", async function() {
      const saveStub = sinon.stub().resolves();
      const otherSiteId = "507f1f77bcf86cd799439099";
      const chart = {
        _id: { toString: () => chartId },
        sites: [
          { site_id: siteId, name: "Site A" },
          { site_id: otherSiteId, name: "Site B" },
        ],
      };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [],
        site_ids: [siteId, otherSiteId],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: { site_ids: [siteId] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
    });

    it("accepts a partial update that narrows the parent doc's site_ids and updates the chart's sites to match", async function() {
      const saveStub = sinon.stub().resolves();
      const otherSiteId = "507f1f77bcf86cd799439099";
      const chart = {
        _id: { toString: () => chartId },
        sites: [
          { site_id: siteId, name: "Site A" },
          { site_id: otherSiteId, name: "Site B" },
        ],
      };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [],
        site_ids: [siteId, otherSiteId],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: {
          site_ids: [siteId],
          sites: [{ site_id: siteId, name: "Site A" }],
        },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(true);
      expect(saveStub.calledOnce).to.equal(true);
      expect(chart.sites).to.deep.equal([{ site_id: siteId, name: "Site A" }]);
    });

    it("rejects (400, not a save() that trips the schema into a 500) when both scope arrays are explicitly cleared", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = { _id: { toString: () => chartId }, title: "Old title" };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [deviceId],
        site_ids: [siteId],
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: { device_ids: [], site_ids: [] },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
    });

    it("rejects when clearing just one scope array leaves the doc's other array already empty — a case the validator layer alone can't see, since it needs the existing document", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = { _id: { toString: () => chartId }, title: "Old title" };
      const doc = {
        chartConfigurations: [chart],
        device_ids: [deviceId],
        site_ids: [], // already empty on the existing document
        save: saveStub,
      };
      findOneStub.resolves(doc);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        body: { device_ids: [] }, // site_ids untouched, but it's already []
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.update(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
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
    let findOneAndUpdateStub;
    let deleteOneStub;

    beforeEach(function() {
      origGroupChartConfigModel = rewireGroupChartConfigUtil.__get__(
        "GroupChartConfigModel"
      );
      findOneAndUpdateStub = sinon.stub();
      deleteOneStub = sinon.stub().resolves();
      rewireGroupChartConfigUtil.__set__("GroupChartConfigModel", () => ({
        findOneAndUpdate: findOneAndUpdateStub,
        deleteOne: deleteOneStub,
      }));
    });

    it("returns 404 when nothing matches the group/chart filter", async function() {
      findOneAndUpdateStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(deleteOneStub.called).to.equal(false);
    });

    it("pulls the chart atomically via findOneAndUpdate, keyed on group_id + chartId only — no read-modify-write race with a concurrent update", async function() {
      findOneAndUpdateStub.resolves({
        _id: "doc1",
        chartConfigurations: [{ fieldId: 2 }],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(findOneAndUpdateStub.calledOnce).to.equal(true);
      const [filter, update, options] = findOneAndUpdateStub.getCall(0).args;
      expect(filter).to.deep.equal({
        group_id: groupId,
        "chartConfigurations._id": chartId,
      });
      expect(update.$pull).to.deep.equal({
        chartConfigurations: { _id: chartId },
      });
      expect(update.$set.updated_by).to.equal(userId);
      expect(options.new).to.equal(true);
      expect(result.success).to.equal(true);
    });

    it("leaves the parent document alone when other charts remain after the pull", async function() {
      findOneAndUpdateStub.resolves({
        _id: "doc1",
        chartConfigurations: [{ fieldId: 2 }],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.delete(request, next);

      expect(deleteOneStub.called).to.equal(false);
    });

    it("cascades and removes the whole document once its last chart is pulled, so it doesn't linger in list() with an empty chartConfigurations array", async function() {
      findOneAndUpdateStub.resolves({
        _id: "doc1",
        chartConfigurations: [],
      });
      const request = {
        query: { tenant: "airqo" },
        params: { groupId, chartId },
        user: { _id: userId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.delete(request, next);

      expect(deleteOneStub.calledOnce).to.equal(true);
      expect(deleteOneStub.getCall(0).args[0]).to.deep.equal({ _id: "doc1" });
      expect(result.success).to.equal(true);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneAndUpdateStub.rejects(new Error("Mongo down"));
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

    // Mimics a real Mongoose Query: .skip()/.limit() are chainable (return
    // the same object) and the object itself is awaitable. This is what
    // lets the util's find(filter).skip(n).limit(n) actually paginate at
    // the query level instead of loading everything into memory to slice.
    function chainableFind(resolvedValue, rejectedError) {
      const calls = {};
      const chain = {
        skip(n) {
          calls.skip = n;
          return chain;
        },
        limit(n) {
          calls.limit = n;
          return chain;
        },
        then(resolve, reject) {
          return rejectedError
            ? Promise.reject(rejectedError).then(resolve, reject)
            : Promise.resolve(resolvedValue).then(resolve, reject);
        },
      };
      return { chain, calls };
    }

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
      const { chain } = chainableFind([]);
      findStub.returns(chain);
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
      const { chain } = chainableFind(docs);
      findStub.returns(chain);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(result.data).to.deep.equal(docs);
    });

    it("narrows the filter by device_id/site_id query params when provided", async function() {
      const { chain } = chainableFind([]);
      findStub.returns(chain);
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

    it("paginates at the query level via skip()/limit(), not by loading everything and slicing in memory", async function() {
      const docs = [{ id: 2 }, { id: 3 }];
      const { chain, calls } = chainableFind(docs);
      findStub.returns(chain);
      const request = {
        query: { tenant: "airqo", limit: 2, skip: 1 },
        params: { groupId },
      };
      const next = sinon.stub();

      const result = await rewireGroupChartConfigUtil.list(request, next);

      expect(calls.skip).to.equal(1);
      expect(calls.limit).to.equal(2);
      expect(result.data).to.deep.equal(docs);
    });

    it("defaults skip/limit to 0 — a MongoDB no-op — when omitted from the query", async function() {
      const { chain, calls } = chainableFind([]);
      findStub.returns(chain);
      const request = {
        query: { tenant: "airqo" },
        params: { groupId },
      };
      const next = sinon.stub();

      await rewireGroupChartConfigUtil.list(request, next);

      expect(calls.skip).to.equal(0);
      expect(calls.limit).to.equal(0);
    });

    it("returns an internal error response when the model throws", async function() {
      const { chain } = chainableFind(null, new Error("Mongo down"));
      findStub.returns(chain);
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
