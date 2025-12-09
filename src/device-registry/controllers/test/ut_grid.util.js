require("module-alias/register");
const chai = require("chai");
const sinon = require("sinon");
const { expect } = chai;
const httpStatus = require("http-status");
const gridUtil = require("@utils/grid.util");
const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const GridModel = require("@models/Grid");

describe("Grid Util", () => {
  describe("listCountries", () => {
    let sandbox;

    beforeEach(() => {
      sandbox = sinon.createSandbox();
    });

    afterEach(() => {
      sandbox.restore();
    });

    it("should return a list of countries without cohort filtering", async () => {
      const request = { query: { tenant: "airqo" } };
      sandbox.stub(CohortModel.prototype, "aggregate").resolves([]);
      sandbox
        .stub(GridModel.prototype, "aggregate")
        .resolves([
          { country: "uganda", sites: 10 },
          { country: "kenya", sites: 5 },
        ]);

      const result = await gridUtil.listCountries(request);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(2);
      expect(result.data[0].country).to.equal("uganda");
    });

    it("should filter countries by a single cohort_id", async () => {
      const cohortId = "620f8b9a9b7e4b001f7e8b1a";
      const request = { query: { tenant: "airqo", cohort_id: cohortId } };

      sandbox.stub(CohortModel.prototype, "aggregate").resolves([]);
      const deviceModelStub = sandbox.stub(DeviceModel.prototype, "find");
      deviceModelStub.returns({
        distinct: sandbox.stub().resolves(["site_id_1"]),
      });
      sandbox
        .stub(GridModel.prototype, "aggregate")
        .resolves([{ country: "uganda", sites: 1 }]);

      const result = await gridUtil.listCountries(request);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(1);
      expect(result.data[0].country).to.equal("uganda");
      sinon.assert.calledWith(deviceModelStub, {
        cohorts: { $in: [cohortId] },
        site_id: { $ne: null },
      });
    });

    it("should filter countries by multiple comma-separated cohort_ids", async () => {
      const cohortIds = [
        "620f8b9a9b7e4b001f7e8b1a",
        "620f8b9a9b7e4b001f7e8b1b",
      ];
      const request = {
        query: { tenant: "airqo", cohort_id: cohortIds },
      };

      sandbox.stub(CohortModel.prototype, "aggregate").resolves([]);
      const deviceModelStub = sandbox.stub(DeviceModel.prototype, "find");
      deviceModelStub.returns({
        distinct: sandbox.stub().resolves(["site_id_1", "site_id_2"]),
      });
      sandbox
        .stub(GridModel.prototype, "aggregate")
        .resolves([
          { country: "uganda", sites: 1 },
          { country: "kenya", sites: 1 },
        ]);

      const result = await gridUtil.listCountries(request);

      expect(result.success).to.be.true;
      expect(result.data)
        .to.be.an("array")
        .with.lengthOf(2);
      sinon.assert.calledWith(deviceModelStub, {
        cohorts: { $in: cohortIds },
        site_id: { $ne: null },
      });
    });

    it("should return an empty array if cohort has no sites", async () => {
      const cohortId = "620f8b9a9b7e4b001f7e8b1c";
      const request = { query: { tenant: "airqo", cohort_id: cohortId } };

      sandbox.stub(CohortModel.prototype, "aggregate").resolves([]);
      const deviceModelStub = sandbox.stub(DeviceModel.prototype, "find");
      deviceModelStub.returns({
        distinct: sandbox.stub().resolves([]), // No sites found
      });
      const gridAggregateStub = sandbox.stub(GridModel.prototype, "aggregate");

      const result = await gridUtil.listCountries(request);

      expect(result.success).to.be.true;
      expect(result.data).to.be.an("array").that.is.empty;
      expect(result.message).to.equal(
        "No countries found for the specified cohort."
      );
      // Ensure the main aggregation is not called if no sites are found
      expect(gridAggregateStub.called).to.be.false;
    });
  });
});
