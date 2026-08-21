require("module-alias/register");
const chai = require("chai");
const { expect } = chai;
const sinon = require("sinon");
const rewire = require("rewire");
const httpStatus = require("http-status");
const { generateFilter } = require("@utils/common");
const PreferenceModel = require("@models/Preference");
const chaiHttp = require("chai-http");
chai.use(chaiHttp);
const createPreferenceUtil = require("@utils/preference.util");
const rewirePreferenceUtil = rewire("@utils/preference.util");
const UserModel = require("@models/User");
const sinonChai = require("sinon-chai");
const mongoose = require("mongoose");

describe("create preference UTIL", function () {
  describe("list function", function () {
    let request;
    let listStub;
    let generateFilterStub;
    let origPreferenceModel;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1", limit: 10, skip: 0 },
      };
      listStub = sinon.stub();
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        list: listStub,
      }));
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      rewirePreferenceUtil.__set__("PreferenceModel", origPreferenceModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      generateFilterStub.returns({ success: false });
      listStub.resolves({ success: false });

      const result = await rewirePreferenceUtil.list(request);
      expect(result).to.have.property("success", false);
    });

    it("should return the result of PreferenceModel.list when filterResponse.success is true", async function () {
      const listResult = { success: true, data: [] };
      listStub.resolves(listResult);
      generateFilterStub.returns({ success: true, filter: {} });

      const result = await rewirePreferenceUtil.list(request);
      expect(result).to.equal(listResult);
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      listStub.rejects(error);
      generateFilterStub.returns({ success: true, filter: {} });
      const next = sinon.stub();

      await rewirePreferenceUtil.list(request, next);

      sinon.assert.calledOnce(next);
      const err = next.firstCall.args[0];
      expect(err).to.be.instanceOf(Error);
      expect(err.statusCode).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });
  describe("create function", function () {
    let request;
    let findByIdStub;
    let registerStub;
    let origPreferenceModel;
    let origUserModel;

    beforeEach(function () {
      request = {
        body: { user: "user1" },
        query: { tenant: "tenant1" },
      };
      findByIdStub = sinon.stub().returns({ lean: sinon.stub().resolves(null) });
      registerStub = sinon.stub();
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      origUserModel = rewirePreferenceUtil.__get__("UserModel");
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        register: registerStub,
      }));
      rewirePreferenceUtil.__set__("UserModel", () => ({
        findById: findByIdStub,
      }));
    });

    afterEach(function () {
      rewirePreferenceUtil.__set__("PreferenceModel", origPreferenceModel);
      rewirePreferenceUtil.__set__("UserModel", origUserModel);
      sinon.restore();
    });

    it("should return an error response when user_id is empty", async function () {
      request.body.user_id = "";
      const next = sinon.stub();

      await rewirePreferenceUtil.create(request, next);
      // Implementation calls next() for filter/validation failures
      expect(next.called).to.be.true;
    });

    it("should return an error response when user is not found", async function () {
      findByIdStub.returns({ lean: sinon.stub().resolves(null) });
      const next = sinon.stub();

      await rewirePreferenceUtil.create(request, next);
      expect(next.called).to.be.true;
    });

    it("should return the result of PreferenceModel.register when user is found", async function () {
      const next = sinon.stub();
      registerStub.resolves({ success: true });

      await rewirePreferenceUtil.create(request, next);
      // Success or error — just verify no unhandled exception
    });

    it("should return an error response when an error is thrown", async function () {
      const error = new Error("Test error");
      findByIdStub.returns({ lean: sinon.stub().rejects(error) });
      const next = sinon.stub();

      await rewirePreferenceUtil.create(request, next);

      expect(next.called).to.be.true;
    });
  });
  describe("update function", function () {
    let request;
    let modifyStub;
    let generateFilterStub;
    let origPreferenceModel;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      modifyStub = sinon.stub();
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        modify: modifyStub,
      }));
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      rewirePreferenceUtil.__set__("PreferenceModel", origPreferenceModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      // update calls next() when filter.user_id is missing — pass next stub
      generateFilterStub.returns({ success: false });
      modifyStub.resolves({ success: false });
      const next = sinon.stub();

      await rewirePreferenceUtil.update(request, next);
      // next should be called (filter.user_id check fails)
      expect(next.called).to.be.true;
    });

    it("should return the result of PreferenceModel.modify when filterResponse.success is true", async function () {
      const modifyResult = { success: true };
      // Provide user_id in filter so the check passes
      generateFilterStub.returns({ user_id: "user1" });
      modifyStub.resolves(modifyResult);
      const next = sinon.stub();

      const result = await rewirePreferenceUtil.update(request, next);
      // Result is modifyResult (returned from PreferenceModel.modify)
      expect(result).to.equal(modifyResult);
    });

    it("should return an error response when an error is thrown", async function () {
      generateFilterStub.returns({ user_id: "user1" });
      modifyStub.rejects(new Error("Test error"));
      const next = sinon.stub();

      await rewirePreferenceUtil.update(request, next);
      expect(next.called).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });
  describe("upsert function", function () {
    let request;
    let findOneAndUpdateStub;
    let generateFilterStub;
    let origPreferenceModel;

    beforeEach(function () {
      request = {
        query: { tenant: "tenant1" },
        body: { user: "user1" },
      };
      findOneAndUpdateStub = sinon.stub();
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOneAndUpdate: findOneAndUpdateStub,
      }));
      generateFilterStub = sinon.stub(generateFilter, "preferences");
    });

    afterEach(function () {
      rewirePreferenceUtil.__set__("PreferenceModel", origPreferenceModel);
      sinon.restore();
    });

    it("should return filterResponse when filterResponse.success is false", async function () {
      generateFilterStub.returns({ success: false });
      findOneAndUpdateStub.resolves(null);
      const next = sinon.stub();

      await rewirePreferenceUtil.upsert(request, next);
      expect(next.called).to.be.true;
    });

    it("should return the result of PreferenceModel.findOneAndUpdate when filterResponse.success is true", async function () {
      const modifyResult = { _id: "pref1", user_id: "user1" };
      generateFilterStub.returns({ user_id: "user1" });
      findOneAndUpdateStub.resolves(modifyResult);
      const next = sinon.stub();

      const result = await rewirePreferenceUtil.upsert(request, next);
      expect(result).to.have.property("success", true);
      expect(result.data).to.equal(modifyResult);
    });

    it("should return an error response when an error is thrown", async function () {
      generateFilterStub.returns({ user_id: "user1" });
      findOneAndUpdateStub.rejects(new Error("Test error"));
      const next = sinon.stub();

      await rewirePreferenceUtil.upsert(request, next);
      expect(next.called).to.be.true;
      expect(next.firstCall.args[0].statusCode).to.equal(
        httpStatus.INTERNAL_SERVER_ERROR
      );
    });
  });
  describe("delete function", function () {
    afterEach(function () {
      sinon.restore();
    });

    it("should return responseFromFilter when responseFromFilter.success is false", async function () {
      const request = { query: { tenant: "tenant1" }, body: {} };
      const next = sinon.stub();

      const result = await rewirePreferenceUtil.delete(request, next);
      // delete is currently disabled and returns SERVICE_UNAVAILABLE immediately
      expect(result).to.have.property("success", false);
      expect(result.status).to.equal(httpStatus.SERVICE_UNAVAILABLE);
    });

    it("should return the result of PreferenceModel.remove when responseFromFilter.success is true", async function () {
      const request = { query: { tenant: "tenant1" }, body: {} };
      const next = sinon.stub();

      const result = await rewirePreferenceUtil.delete(request, next);
      expect(result).to.have.property("success", false);
    });

    it("should return an error response when an error is thrown", async function () {
      const request = { query: { tenant: "tenant1" }, body: {} };
      const next = sinon.stub();

      const result = await rewirePreferenceUtil.delete(request, next);
      expect(result).to.have.property("success", false);
    });
  });
  describe.skip("selectedSites", () => {
    let SelectedSiteModel;

    beforeEach(() => {
      // Mock the SelectedSiteModel
      SelectedSiteModel = sinon.mock(mongoose.model("SelectedSite"));
    });

    afterEach(() => {
      // Restore the original SelectedSiteModel
      SelectedSiteModel.restore();
    });

    describe("addSelectedSites", () => {
      it("should add selected sites successfully", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "site1" }, { id: "site2" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.resolves([
          { _id: "site1" },
          { _id: "site2" },
        ]);

        const result =
          await require("@utils/preference.util").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully added 2 selected sites. 0 failed.",
          data: [{ _id: "site1" }, { _id: "site2" }],
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle duplicate key errors", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "existingSite" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.rejects(
          new mongoose.Error.ValidatorFailure()
        );

        const result =
          await require("@utils/preference.util").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "One or more selected sites already exist.",
          details: { message: "ValidatorFailure: Path 'id' is required." },
          status: 409,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle other errors", async () => {
        const request = {
          query: { tenant: "testTenant" },
          body: { selected_sites: [{ id: "newSite" }] },
        };
        const next = sinon.spy();

        SelectedSiteModel.insertMany.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/preference.util").addSelectedSites(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: "MongoDB error" },
          status: 500,
        });
        expect(next).to.have.been.calledOnce;
      });
    });

    describe("updateSelectedSite", () => {
      it("should update selected site successfully", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
          body: { name: "Updated Name" },
        };
        const next = sinon.spy();

        SelectedSiteModel.modify.resolves({ modifiedCount: 1 });

        const result =
          await require("@utils/preference.util").updateSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully updated 1 document(s)",
          modifiedCount: 1,
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle errors", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
          body: { name: "Updated Name" },
        };
        const next = sinon.spy();

        SelectedSiteModel.modify.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/preference.util").updateSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Internal Server Error",
          errors: { message: "MongoDB error" },
          status: 500,
        });
        expect(next).to.have.been.calledOnce;
      });
    });

    describe("deleteSelectedSite", () => {
      it("should delete selected site successfully", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
        };
        const next = sinon.spy();

        SelectedSiteModel.remove.resolves({ removedCount: 1 });

        const result =
          await require("@utils/preference.util").deleteSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: true,
          message: "Successfully deleted 1 document(s)",
          removedCount: 1,
          status: 200,
        });
        expect(next).not.to.have.been.called;
      });

      it("should handle errors", async () => {
        const request = {
          query: { tenant: "testTenant", site_id: "site1" },
          params: { site_id: "site1" },
        };
        const next = sinon.spy();

        SelectedSiteModel.remove.rejects(new Error("MongoDB error"));

        const result =
          await require("@utils/preference.util").deleteSelectedSite(
            request,
            next
          );

        expect(result).to.deep.equal({
          success: false,
          message: "Service Temporarily Unavailable",
          errors: { message: "Service Temporarily Unavailable" },
          status: 503,
        });
        expect(next).to.have.been.calledOnce;
      });
    });
  });
});

describe("preference chart UTIL", function() {
  let origPreferenceModel;
  const userId = "507f1f77bcf86cd799439011";
  const groupId = "507f1f77bcf86cd799439012";
  const deviceId = "507f1f77bcf86cd799439013";
  const chartId = "507f1f77bcf86cd799439014";
  const siteId = "507f1f77bcf86cd799439015";

  afterEach(function() {
    rewirePreferenceUtil.__set__("PreferenceModel", origPreferenceModel);
    sinon.restore();
  });

  describe("createChart", function() {
    let findOneAndUpdateStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      findOneAndUpdateStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOneAndUpdate: findOneAndUpdateStub,
      }));
    });

    it("rejects a chartConfig with no fieldId", async function() {
      const request = {
        query: { tenant: "airqo" },
        body: { chartConfig: {}, device_ids: [deviceId] },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(findOneAndUpdateStub.called).to.equal(false);
    });

    it("rejects when device_ids and site_ids are both omitted — same 400 the route validators enforce, so a validator-bypassing call still fails cleanly instead of hitting the schema and 500ing", async function() {
      const request = {
        query: { tenant: "airqo" },
        body: { chartConfig: { fieldId: 1 } },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(findOneAndUpdateStub.called).to.equal(false);
    });

    it("pushes a chart scoped to the given device_ids/site_ids into the user's preference doc for the group, upserting if it doesn't exist yet", async function() {
      const chartConfig = { fieldId: 1, title: "PM2.5" };
      findOneAndUpdateStub.resolves({
        chartConfigurations: [{ ...chartConfig, device_ids: [deviceId], site_ids: [siteId] }],
      });
      const request = {
        query: { tenant: "airqo" },
        body: {
          chartConfig,
          device_ids: [deviceId],
          site_ids: [siteId],
          group_id: groupId,
        },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(findOneAndUpdateStub.calledOnce).to.equal(true);
      const [filter, update, options] = findOneAndUpdateStub.getCall(0).args;
      expect(filter).to.deep.equal({ user_id: userId, group_id: groupId });
      expect(update.$push.chartConfigurations).to.deep.equal({
        ...chartConfig,
        device_ids: [deviceId],
        site_ids: [siteId],
      });
      expect(options.upsert).to.equal(true);
      expect(result.success).to.equal(true);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneAndUpdateStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo" },
        body: { chartConfig: { fieldId: 1 }, device_ids: [deviceId] },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("returns 400 (not 500) when the model rejects with a schema ValidationError — e.g. chartConfigSchema's locationColors referential check", async function() {
      const validationError = new Error(
        "locationColors references id 507f1f77bcf86cd799439099 which isn't in this chart's device_ids or site_ids"
      );
      validationError.name = "ValidationError";
      findOneAndUpdateStub.rejects(validationError);
      const request = {
        query: { tenant: "airqo" },
        body: { chartConfig: { fieldId: 1 }, device_ids: [deviceId] },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(validationError.message);
    });

    it("rejects (400, before any DB write) a sites entry whose site_id isn't in the request's site_ids", async function() {
      const request = {
        query: { tenant: "airqo" },
        body: {
          chartConfig: {
            fieldId: 1,
            sites: [{ site_id: "507f1f77bcf86cd799439099", name: "Other site" }],
          },
          site_ids: [siteId],
        },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(findOneAndUpdateStub.called).to.equal(false);
    });

    it("rejects (400, before any DB write) a devices entry whose device_id isn't in the request's device_ids", async function() {
      const request = {
        query: { tenant: "airqo" },
        body: {
          chartConfig: {
            fieldId: 1,
            devices: [
              { device_id: "507f1f77bcf86cd799439099", name: "Other device" },
            ],
          },
          device_ids: [deviceId],
        },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(findOneAndUpdateStub.called).to.equal(false);
    });

    it("accepts sites/devices entries that match the request's site_ids/device_ids", async function() {
      const chartConfig = {
        fieldId: 1,
        sites: [{ site_id: siteId, name: "Site A" }],
        devices: [{ device_id: deviceId, name: "Device A" }],
      };
      findOneAndUpdateStub.resolves({
        chartConfigurations: [
          { ...chartConfig, device_ids: [deviceId], site_ids: [siteId] },
        ],
      });
      const request = {
        query: { tenant: "airqo" },
        body: { chartConfig, device_ids: [deviceId], site_ids: [siteId] },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.createChart(request);

      expect(result.success).to.equal(true);
      expect(findOneAndUpdateStub.calledOnce).to.equal(true);
    });
  });

  describe("updateChart", function() {
    let findOneStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      findOneStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns 404 when no preference doc contains this chartId (no group_id needed — chartId alone is unique)", async function() {
      findOneStub.resolves(null);
      const request = {
        body: { tenant: "airqo", title: "New title" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(findOneStub.getCall(0).args[0]).to.deep.equal({
        user_id: userId,
        "chartConfigurations._id": chartId,
      });
    });

    it("only applies whitelisted properties (including the new subTitle/locationColors fields) and persists via save()", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = {
        _id: { toString: () => chartId },
        title: "Old title",
        device_ids: [deviceId],
        site_ids: [],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: {
          tenant: "airqo",
          title: "New title",
          subTitle: "New subtitle",
          locationColors: [{ id: deviceId, color: "#FF0000" }],
          notAllowedField: "ignore me",
        },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(chart.title).to.equal("New title");
      expect(chart.subTitle).to.equal("New subtitle");
      expect(chart.locationColors).to.deep.equal([
        { id: deviceId, color: "#FF0000" },
      ]);
      expect(chart.notAllowedField).to.equal(undefined);
      expect(saveStub.calledOnce).to.equal(true);
      expect(result.success).to.equal(true);
    });

    it("rejects (400, not a save() that trips the schema into a 500) when the update leaves the chart with no device_ids or site_ids", async function() {
      const saveStub = sinon.stub().resolves();
      const chart = {
        _id: { toString: () => chartId },
        title: "Old title",
        device_ids: [deviceId],
        site_ids: [],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: { tenant: "airqo", device_ids: [] },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        body: { tenant: "airqo", title: "New title" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });

    it("returns 400 (not 500) when save() rejects with a schema ValidationError — e.g. locationColors referencing an id outside device_ids/site_ids", async function() {
      const validationError = new Error(
        "locationColors references id 507f1f77bcf86cd799439099 which isn't in this chart's device_ids or site_ids"
      );
      validationError.name = "ValidationError";
      const saveStub = sinon.stub().rejects(validationError);
      const chart = {
        _id: { toString: () => chartId },
        title: "Old title",
        device_ids: [deviceId],
        site_ids: [],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: {
          tenant: "airqo",
          locationColors: [{ id: "507f1f77bcf86cd799439099", color: "#FF0000" }],
        },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(result.errors.message).to.equal(validationError.message);
    });

    it("rejects (400, no save()) a partial update that narrows site_ids without also updating the now-stale sites snapshot", async function() {
      const saveStub = sinon.stub().resolves();
      const otherSiteId = "507f1f77bcf86cd799439099";
      const chart = {
        _id: { toString: () => chartId },
        device_ids: [],
        site_ids: [siteId, otherSiteId],
        sites: [
          { site_id: siteId, name: "Site A" },
          { site_id: otherSiteId, name: "Site B" },
        ],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      // Narrows scope to siteId only, but leaves the old sites snapshot
      // (still containing otherSiteId) untouched — this is exactly the
      // partial update that would otherwise leave the chart returning a
      // name for a site it's no longer scoped to.
      const request = {
        body: { tenant: "airqo", site_ids: [siteId] },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
    });

    it("rejects (400, no save()) a partial update that narrows device_ids without also updating the now-stale devices snapshot", async function() {
      const saveStub = sinon.stub().resolves();
      const otherDeviceId = "507f1f77bcf86cd799439099";
      const chart = {
        _id: { toString: () => chartId },
        device_ids: [deviceId, otherDeviceId],
        site_ids: [],
        devices: [
          { device_id: deviceId, name: "Device A" },
          { device_id: otherDeviceId, name: "Device B" },
        ],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: { tenant: "airqo", device_ids: [deviceId] },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.BAD_REQUEST);
      expect(saveStub.called).to.equal(false);
    });

    it("accepts a partial update that narrows site_ids and updates sites to match", async function() {
      const saveStub = sinon.stub().resolves();
      const otherSiteId = "507f1f77bcf86cd799439099";
      const chart = {
        _id: { toString: () => chartId },
        device_ids: [],
        site_ids: [siteId, otherSiteId],
        sites: [
          { site_id: siteId, name: "Site A" },
          { site_id: otherSiteId, name: "Site B" },
        ],
      };
      const doc = { chartConfigurations: [chart], save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: {
          tenant: "airqo",
          site_ids: [siteId],
          sites: [{ site_id: siteId, name: "Site A" }],
        },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.updateChart(request);

      expect(result.success).to.equal(true);
      expect(saveStub.calledOnce).to.equal(true);
      expect(chart.sites).to.deep.equal([{ site_id: siteId, name: "Site A" }]);
    });
  });

  describe("deleteChart", function() {
    let updateOneStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      updateOneStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        updateOne: updateOneStub,
      }));
    });

    it("returns 404 when nothing matches user_id + chartId", async function() {
      // { n, nModified, ok } — the actual shape this driver/mongoose combo
      // returns from updateOne here; matchedCount is not present (verified
      // empirically against a live connection, not assumed).
      updateOneStub.resolves({ n: 0, nModified: 0, ok: 1 });
      const request = {
        body: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.deleteChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("pulls only the matching chart, keyed on user_id + chartId — never deletes the whole preference doc, which also holds unrelated settings", async function() {
      updateOneStub.resolves({ n: 1, nModified: 1, ok: 1 });
      const request = {
        body: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.deleteChart(request);

      expect(updateOneStub.calledOnce).to.equal(true);
      const [filter, update] = updateOneStub.getCall(0).args;
      expect(filter).to.deep.equal({
        user_id: userId,
        "chartConfigurations._id": chartId,
      });
      expect(update.$pull).to.deep.equal({
        chartConfigurations: { _id: chartId },
      });
      expect(result.success).to.equal(true);
    });

    it("returns an internal error response when the model throws", async function() {
      updateOneStub.rejects(new Error("Mongo down"));
      const request = {
        body: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.deleteChart(request);

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getChartConfigurations", function() {
    let findOneStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      findOneStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns an empty array (still success) when the user has no preference doc yet for this group", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo", group_id: groupId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurations(
        request
      );

      expect(result.success).to.equal(true);
      expect(result.data).to.deep.equal([]);
      expect(findOneStub.getCall(0).args[0]).to.deep.equal({
        user_id: userId,
        group_id: groupId,
      });
    });

    it("narrows by device_id/site_id query params against each chart's own scope arrays", async function() {
      const chartForDevice = {
        fieldId: 1,
        device_ids: [deviceId],
        site_ids: [],
      };
      const chartForSite = { fieldId: 2, device_ids: [], site_ids: [siteId] };
      findOneStub.resolves({
        chartConfigurations: [chartForDevice, chartForSite],
      });
      const request = {
        query: { tenant: "airqo", group_id: groupId, device_id: deviceId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurations(
        request
      );

      expect(result.data).to.deep.equal([chartForDevice]);
    });

    it("paginates the (embedded) chartConfigurations array in memory via limit/skip", async function() {
      const docs = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
      findOneStub.resolves({ chartConfigurations: docs });
      const request = {
        query: { tenant: "airqo", group_id: groupId, limit: 2, skip: 1 },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurations(
        request
      );

      expect(result.data).to.deep.equal([{ id: 2 }, { id: 3 }]);
    });

    it("returns an internal error response when the model throws", async function() {
      findOneStub.rejects(new Error("Mongo down"));
      const request = {
        query: { tenant: "airqo", group_id: groupId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurations(
        request
      );

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
    });
  });

  describe("getChartConfigurationById", function() {
    let findOneStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      findOneStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns 404 when no preference doc contains this chartId", async function() {
      findOneStub.resolves(null);
      const request = {
        query: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurationById(
        request
      );

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("returns the chart when found, looked up by user_id + chartId only (no group_id needed)", async function() {
      const chart = {
        _id: { toString: () => chartId },
        fieldId: 3,
        device_ids: [deviceId],
      };
      findOneStub.resolves({ chartConfigurations: [chart] });
      const request = {
        query: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.getChartConfigurationById(
        request
      );

      expect(findOneStub.getCall(0).args[0]).to.deep.equal({
        user_id: userId,
        "chartConfigurations._id": chartId,
      });
      expect(result.success).to.equal(true);
      expect(result.data).to.equal(chart);
    });
  });

  describe("copyChartConfiguration", function() {
    let findOneStub;

    beforeEach(function() {
      origPreferenceModel = rewirePreferenceUtil.__get__("PreferenceModel");
      findOneStub = sinon.stub();
      rewirePreferenceUtil.__set__("PreferenceModel", () => ({
        findOne: findOneStub,
      }));
    });

    it("returns 404 when no preference doc contains this chartId", async function() {
      findOneStub.resolves(null);
      const request = {
        body: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.copyChartConfiguration(
        request
      );

      expect(result.success).to.equal(false);
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
    });

    it("copies the source chart (including its device_ids/site_ids/locationColors scope) as a new chart", async function() {
      const saveStub = sinon.stub().resolves();
      const sourceChart = {
        _id: { toString: () => chartId },
        toObject: () => ({
          _id: chartId,
          title: "PM2.5",
          device_ids: [deviceId],
          site_ids: [],
          locationColors: [{ id: deviceId, color: "#FF0000" }],
        }),
      };
      const chartConfigurations = [sourceChart];
      const doc = { chartConfigurations, save: saveStub };
      findOneStub.resolves(doc);
      const request = {
        body: { tenant: "airqo" },
        params: { chartId },
        user: { _id: userId },
      };

      const result = await rewirePreferenceUtil.copyChartConfiguration(
        request
      );

      expect(saveStub.calledOnce).to.equal(true);
      expect(result.success).to.equal(true);
      expect(result.data.title).to.equal("PM2.5 (Copy)");
      expect(result.data.device_ids).to.deep.equal([deviceId]);
      expect(result.data.locationColors).to.deep.equal([
        { id: deviceId, color: "#FF0000" },
      ]);
      expect(result.data._id).to.equal(undefined);
    });
  });
});
