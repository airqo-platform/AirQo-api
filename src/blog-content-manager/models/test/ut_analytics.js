require("module-alias/register");
const chai = require("chai");
const expect = chai.expect;
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const AnalyticsModel = require("@models/Analytics");

describe("Analytics Model", () => {
  let sandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe("create method", () => {
    it("should create a new analytics entry", async () => {
      const mockGetModelByTenant = sandbox
        .stub(getModelByTenant, "get")
        .resolves(mongoose.Model);

      const result = await AnalyticsModel.create({
        metricName: "test_metric",
        value: 100,
        type: "pageviews",
        category: "website",
        status: "active",
      });

      expect(result.success).to.be.true;
      expect(result.data).to.exist;
      expect(result.message).to.equal("Analytics entry created successfully");
      expect(result.status).to.equal(httpStatus.CREATED);
      expect(mockGetModelByTenant).to.have.been.calledOnceWith(
        "analytics",
        AnalyticsSchema
      );
    });

    it("should fail to create when required fields are missing", async () => {
      const mockGetModelByTenant = sandbox
        .stub(getModelByTenant, "get")
        .resolves(mongoose.Model);

      const result = await AnalyticsModel.create({
        metricName: "test_metric",
        value: 100,
        type: "pageviews",
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Failed to create analytics entry");
      expect(result.status).to.equal(httpStatus.INTERNAL_SERVER_ERROR);
      expect(mockGetModelByTenant).to.have.been.calledOnceWith(
        "analytics",
        AnalyticsSchema
      );
    });
  });

  describe("list method", () => {
    it("should list analytics entries", async () => {
      const mockFind = sandbox
        .stub(mongoose.Model.prototype.find, "exec")
        .resolves([
          { _id: "123", metricName: "test_metric" },
          { _id: "456", metricName: "another_metric" },
        ]);

      const result = await AnalyticsModel.list({});

      expect(result.success).to.be.true;
      expect(result.data).to.have.lengthOf(2);
      expect(result.total).to.equal(2);
      expect(mockFind).to.have.been.calledOnceWith({});
    });

    it("should sort analytics entries by timestamp", async () => {
      const mockFind = sandbox
        .stub(mongoose.Model.prototype.find, "exec")
        .resolves([
          {
            _id: "123",
            metricName: "test_metric",
            timestamp: new Date("2023-01-01"),
          },
          {
            _id: "456",
            metricName: "another_metric",
            timestamp: new Date("2023-01-02"),
          },
        ]);

      const result = await AnalyticsModel.list({}, {}, { skip: 0, limit: 2 });

      expect(result.data[0].timestamp).to.be.after(result.data[1].timestamp);
    });

    it("should apply filters correctly", async () => {
      const mockFind = sandbox
        .stub(mongoose.Model.prototype.find, "exec")
        .resolves([
          { _id: "123", metricName: "test_metric", category: "website" },
          { _id: "456", metricName: "test_metric", category: "mobile" },
        ]);

      const result = await AnalyticsModel.list({ category: "website" });

      expect(result.data).to.have.lengthOf(1);
      expect(result.data[0].metricName).to.equal("test_metric");
      expect(result.data[0].category).to.equal("website");
      expect(mockFind).to.have.been.calledWith({ category: "website" });
    });
  });

  describe("findById method", () => {
    it("should find an analytics entry by ID", async () => {
      const mockFindOne = sandbox
        .stub(mongoose.Model.prototype.findOne, "exec")
        .resolves({ _id: "123", metricName: "test_metric" });

      const result = await AnalyticsModel.findById("123");

      expect(result.success).to.be.true;
      expect(result.data._id).to.equal("123");
      expect(result.data.metricName).to.equal("test_metric");
      expect(mockFindOne).to.have.been.calledWith({ _id: "123" });
    });

    it("should return not found when no entry exists", async () => {
      const mockFindOne = sandbox
        .stub(mongoose.Model.prototype.findOne, "exec")
        .rejects(new Error("Not Found"));

      const result = await AnalyticsModel.findById("nonexistent_id");

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Analytics entry not found");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(mockFindOne).to.have.been.calledWith({ _id: "nonexistent_id" });
    });
  });

  describe("update method", () => {
    it("should update an existing analytics entry", async () => {
      const mockUpdateByIdAndUpdate = sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
        .resolves({ _id: "123", metricName: "updated_metric" });

      const result = await AnalyticsModel.update({
        id: "123",
        update: { metricName: "updated_metric" },
      });

      expect(result.success).to.be.true;
      expect(result.data._id).to.equal("123");
      expect(result.data.metricName).to.equal("updated_metric");
      expect(mockUpdateByIdAndUpdate).to.have.been.calledWith("123", {
        metricName: "updated_metric",
      });
    });

    it("should return not found when no entry exists", async () => {
      const mockUpdateByIdAndUpdate = sandbox
        .stub(mongoose.Model.prototype.findByIdAndUpdate, "exec")
        .rejects(new Error("Not Found"));

      const result = await AnalyticsModel.update({
        id: "nonexistent_id",
        update: { metricName: "new_metric" },
      });

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Analytics entry not found");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(mockUpdateByIdAndUpdate).to.have.been.calledWith(
        "nonexistent_id",
        { metricName: "new_metric" }
      );
    });
  });

  describe("remove method", () => {
    it("should remove an analytics entry", async () => {
      const mockRemoveByIdAndRemove = sandbox
        .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
        .resolves({ _id: "123", metricName: "test_metric" });

      const result = await AnalyticsModel.remove("123");

      expect(result.success).to.be.true;
      expect(result.data._id).to.equal("123");
      expect(result.data.metricName).to.equal("test_metric");
      expect(mockRemoveByIdAndRemove).to.have.been.calledWith("123");
    });

    it("should return not found when no entry exists", async () => {
      const mockRemoveByIdAndRemove = sandbox
        .stub(mongoose.Model.prototype.findByIdAndRemove, "exec")
        .rejects(new Error("Not Found"));

      const result = await AnalyticsModel.remove("nonexistent_id");

      expect(result.success).to.be.false;
      expect(result.message).to.equal("Analytics entry not found");
      expect(result.status).to.equal(httpStatus.NOT_FOUND);
      expect(mockRemoveByIdAndRemove).to.have.been.calledWith("nonexistent_id");
    });
  });

  describe("getMetricStats method", () => {
    it("should calculate metric statistics", async () => {
      const mockFind = sandbox
        .stub(mongoose.Model.prototype.find, "exec")
        .resolves([
          {
            _id: "1",
            metricName: "test_metric",
            value: 10,
            type: "pageviews",
            category: "website",
          },
          {
            _id: "2",
            metricName: "test_metric",
            value: 15,
            type: "pageviews",
            category: "website",
          },
          {
            _id: "3",
            metricName: "test_metric",
            value: 12,
            type: "uniquevisitors",
            category: "website",
          },
        ]);

      const result = await AnalyticsModel.getMetricStats(
        "test_metric",
        "website"
      );

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({
        pageviews: 25,
        uniquevisitors: 12,
      });
      expect(result.message).to.equal(
        "Successfully retrieved metric statistics"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(mockFind).to.have.been.calledWith({
        metricName: "test_metric",
        category: "website",
      });
    });

    it("should handle empty results", async () => {
      const mockFind = sandbox
        .stub(mongoose.Model.prototype.find, "exec")
        .resolves([]);

      const result = await AnalyticsModel.getMetricStats(
        "nonexistent_metric",
        "invalid_category"
      );

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal({});
      expect(result.message).to.equal(
        "Successfully retrieved metric statistics"
      );
      expect(result.status).to.equal(httpStatus.OK);
      expect(mockFind).to.have.been.calledWith({
        metricName: "nonexistent_metric",
        category: "invalid_category",
      });
    });
  });

  describe("model initialization", () => {
    it("should initialize the model correctly", () => {
      const mockGetModelByTenant = sandbox
        .stub(getModelByTenant, "get")
        .resolves(mongoose.Model);

      const analyticsModel = AnalyticsModel("tenant1");

      expect(analyticsModel).to.exist;
      expect(mockGetModelByTenant).to.have.been.calledOnceWith(
        "analytics",
        AnalyticsSchema
      );
    });

    it("should fall back to default model if tenant fails", () => {
      const mockGetModelByTenant = sandbox
        .stub(getModelByTenant, "get")
        .rejects(new Error("Tenant not found"));

      const analyticsModel = AnalyticsModel("nonexistent_tenant");

      expect(analyticsModel).to.exist;
      expect(mockGetModelByTenant).to.have.been.calledOnceWith(
        "analytics",
        AnalyticsSchema
      );
    });
  });
});
