require("module-alias/register");
const { expect } = require("chai");
const sinon = require("sinon");
const sinonChai = require("sinon-chai");
const chai = require("chai");
chai.use(sinonChai);
const httpStatus = require("http-status");
const proxyquire = require("proxyquire");

describe("networkStatusUtil", () => {
  let networkStatusUtil;
  let NetworkStatusAlertModelStub;
  let modelInstance;

  beforeEach(() => {
    modelInstance = {
      register: sinon.stub(),
      list: sinon.stub(),
      getStatistics: sinon.stub(),
      getStatisticsByNetwork: sinon.stub(),
      getHourlyTrends: sinon.stub(),
      getHourlyTrendsByNetwork: sinon.stub(),
      getUptimeSummaryByNetwork: sinon.stub(),
      executeAggregation: sinon.stub(),
    };

    NetworkStatusAlertModelStub = sinon.stub().returns(modelInstance);

    networkStatusUtil = proxyquire("@utils/network-status.util", {
      "@models/NetworkStatusAlert": NetworkStatusAlertModelStub,
      kafkajs: {
        Kafka: class {
          constructor() {}
          producer() {
            return {
              connect: sinon.stub().resolves(),
              send: sinon.stub().resolves(),
              disconnect: sinon.stub().resolves(),
            };
          }
        },
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe("createAlert", () => {
    it("should enrich alert data and call model.register", async () => {
      const fakeResponse = {
        success: true,
        data: { _id: "alert-1" },
        status: httpStatus.CREATED,
        message: "Network status alert created",
      };
      modelInstance.register.resolves(fakeResponse);
      const next = sinon.spy();

      const result = await networkStatusUtil.createAlert(
        {
          alertData: {
            checked_at: new Date(),
            total_deployed_devices: 100,
            not_transmitting_devices_count: 10,
            not_transmitting_percentage: 10,
            status: "OK",
            message: "ok",
            threshold_exceeded: false,
            threshold_value: 35,
          },
          tenant: "airqo",
        },
        next
      );

      expect(result.success).to.be.true;
      expect(modelInstance.register.calledOnce).to.be.true;
      const callArgs = modelInstance.register.firstCall.args[0];
      expect(callArgs).to.have.property("tenant", "airqo");
      expect(callArgs).to.have.property("day_of_week");
      expect(callArgs).to.have.property("hour_of_day");
    });

    it("should assign severity HIGH when not_transmitting_percentage >= 50", async () => {
      modelInstance.register.resolves({ success: true, data: {} });
      const next = sinon.spy();

      await networkStatusUtil.createAlert(
        {
          alertData: {
            not_transmitting_percentage: 60,
            status: "CRITICAL",
            message: "bad",
            threshold_exceeded: true,
            threshold_value: 35,
            checked_at: new Date(),
            total_deployed_devices: 100,
            not_transmitting_devices_count: 60,
          },
          tenant: "airqo",
        },
        next
      );

      const callArgs = modelInstance.register.firstCall.args[0];
      expect(callArgs.severity).to.equal("HIGH");
    });

    it("should assign severity MEDIUM when not_transmitting_percentage >= 35 and < 50", async () => {
      modelInstance.register.resolves({ success: true, data: {} });
      const next = sinon.spy();

      await networkStatusUtil.createAlert(
        {
          alertData: {
            not_transmitting_percentage: 40,
            status: "WARNING",
            message: "warn",
            threshold_exceeded: true,
            threshold_value: 35,
            checked_at: new Date(),
            total_deployed_devices: 100,
            not_transmitting_devices_count: 40,
          },
          tenant: "airqo",
        },
        next
      );

      const callArgs = modelInstance.register.firstCall.args[0];
      expect(callArgs.severity).to.equal("MEDIUM");
    });

    it("should assign severity LOW when not_transmitting_percentage < 35", async () => {
      modelInstance.register.resolves({ success: true, data: {} });
      const next = sinon.spy();

      await networkStatusUtil.createAlert(
        {
          alertData: {
            not_transmitting_percentage: 20,
            status: "OK",
            message: "ok",
            threshold_exceeded: false,
            threshold_value: 35,
            checked_at: new Date(),
            total_deployed_devices: 100,
            not_transmitting_devices_count: 20,
          },
          tenant: "airqo",
        },
        next
      );

      const callArgs = modelInstance.register.firstCall.args[0];
      expect(callArgs.severity).to.equal("LOW");
    });

    it("should call next on unexpected error", async () => {
      modelInstance.register.rejects(new Error("unexpected"));
      const next = sinon.spy();

      await networkStatusUtil.createAlert({ alertData: {}, tenant: "airqo" }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("list", () => {
    it("should pass filter to model.list and return result", async () => {
      const fakeAlerts = [{ _id: "a1" }];
      modelInstance.list.resolves({
        success: true,
        data: fakeAlerts,
        status: httpStatus.OK,
      });
      const next = sinon.spy();

      const result = await networkStatusUtil.list(
        { query: { tenant: "airqo", limit: "10", skip: "0" } },
        next
      );

      expect(result.success).to.be.true;
      expect(result.data).to.deep.equal(fakeAlerts);
      expect(modelInstance.list.calledOnce).to.be.true;
    });

    it("should build date filter when start_date and end_date are provided", async () => {
      modelInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.list(
        {
          query: {
            tenant: "airqo",
            start_date: "2025-01-01",
            end_date: "2025-01-31",
          },
        },
        next
      );

      const passedArgs = modelInstance.list.firstCall.args[0];
      expect(passedArgs.filter).to.have.property("checked_at");
      expect(passedArgs.filter.checked_at).to.have.property("$gte");
      expect(passedArgs.filter.checked_at).to.have.property("$lte");
    });

    it("should add network elemMatch filter when network query param is provided", async () => {
      modelInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.list(
        { query: { tenant: "airqo", network: "airqo" } },
        next
      );

      const passedArgs = modelInstance.list.firstCall.args[0];
      expect(passedArgs.filter).to.have.property("network_breakdown");
    });

    it("should call next on error", async () => {
      modelInstance.list.rejects(new Error("db error"));
      const next = sinon.spy();

      await networkStatusUtil.list({ query: { tenant: "airqo" } }, next);

      expect(next.calledOnce).to.be.true;
    });
  });

  describe("getStatistics", () => {
    it("should call getStatistics on model when no network filter", async () => {
      modelInstance.getStatistics.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getStatistics({ query: { tenant: "airqo" } }, next);

      expect(modelInstance.getStatistics.calledOnce).to.be.true;
    });

    it("should call getStatisticsByNetwork when network query param is provided", async () => {
      modelInstance.getStatisticsByNetwork.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getStatistics(
        { query: { tenant: "airqo", network: "airqo" } },
        next
      );

      expect(modelInstance.getStatisticsByNetwork.calledOnce).to.be.true;
    });
  });

  describe("getHourlyTrends", () => {
    it("should call getHourlyTrends on model when no network filter", async () => {
      modelInstance.getHourlyTrends.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getHourlyTrends({ query: { tenant: "airqo" } }, next);

      expect(modelInstance.getHourlyTrends.calledOnce).to.be.true;
    });

    it("should call getHourlyTrendsByNetwork when network is specified", async () => {
      modelInstance.getHourlyTrendsByNetwork.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getHourlyTrends(
        { query: { tenant: "airqo", network: "iqair" } },
        next
      );

      expect(modelInstance.getHourlyTrendsByNetwork.calledOnce).to.be.true;
    });
  });

  describe("getRecentAlerts", () => {
    it("should filter by threshold_exceeded when no network specified", async () => {
      modelInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getRecentAlerts(
        { query: { tenant: "airqo", hours: "24" } },
        next
      );

      const passedArgs = modelInstance.list.firstCall.args[0];
      expect(passedArgs.filter).to.have.property("threshold_exceeded", true);
    });

    it("should add network breakdown elemMatch filter when network is provided", async () => {
      modelInstance.list.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getRecentAlerts(
        { query: { tenant: "airqo", network: "airqo" } },
        next
      );

      const passedArgs = modelInstance.list.firstCall.args[0];
      expect(passedArgs.filter).to.have.property("network_breakdown");
    });
  });

  describe("getUptimeSummary", () => {
    it("should call getUptimeSummaryByNetwork when network is provided", async () => {
      modelInstance.getUptimeSummaryByNetwork.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getUptimeSummary(
        { query: { tenant: "airqo", days: "7", network: "airqo" } },
        next
      );

      expect(modelInstance.getUptimeSummaryByNetwork.calledOnce).to.be.true;
    });

    it("should call executeAggregation for global uptime when no network", async () => {
      modelInstance.executeAggregation.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getUptimeSummary(
        { query: { tenant: "airqo", days: "7" } },
        next
      );

      expect(modelInstance.executeAggregation.calledOnce).to.be.true;
    });
  });

  describe("getNetworkBreakdown", () => {
    it("should call getStatisticsByNetwork without a specific network", async () => {
      modelInstance.getStatisticsByNetwork.resolves({ success: true, data: [] });
      const next = sinon.spy();

      await networkStatusUtil.getNetworkBreakdown(
        { query: { tenant: "airqo" } },
        next
      );

      expect(modelInstance.getStatisticsByNetwork.calledOnce).to.be.true;
    });
  });
});
