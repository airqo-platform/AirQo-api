require("module-alias/register");
const { expect } = require("chai");
const generateFilter = require("@utils/common/generate-filter");

// Helper to mock the request object
const mockRequest = (query = {}, params = {}) => ({
  query,
  params,
});

describe("generateFilter Util", () => {
  describe("devices", () => {
    it("should return an empty filter if no query params are provided", () => {
      const req = mockRequest();
      const result = generateFilter.devices(req);
      expect(result).to.be.an("object").that.is.empty;
    });

    it("should correctly create a filter for a single tag", () => {
      const req = mockRequest({ tags: "school" });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        tags: { $in: ["school"] },
      });
    });

    it("should correctly create a filter for multiple comma-separated tags", () => {
      const req = mockRequest({ tags: "school,public,urban" });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        tags: { $in: ["school", "public", "urban"] },
      });
    });

    it("should trim whitespace from tags", () => {
      const req = mockRequest({ tags: " school , public " });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        tags: { $in: ["school", "public"] },
      });
    });

    it("should convert tags to lowercase", () => {
      const req = mockRequest({ tags: "School,PUBLIC" });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        tags: { $in: ["school", "public"] },
      });
    });

    it("should handle a mix of casing and whitespace", () => {
      const req = mockRequest({ tags: "  School , Public-Area  " });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        tags: { $in: ["school", "public-area"] },
      });
    });

    it("should correctly combine tags filter with other filters like 'name'", () => {
      const req = mockRequest({ tags: "school,public", name: "aq_device_1" });
      const result = generateFilter.devices(req);
      expect(result).to.deep.equal({
        name: { $in: ["AQ_DEVICE_1", "aq_device_1"] },
        tags: { $in: ["school", "public"] },
      });
    });
  });

  // Nexus follow-up: sites summary needed to filter by more than one site
  // at a time (previously site_ids wasn't read at all, so multi-site
  // requests silently fell back to the unfiltered fleet).
  describe("sites — site_ids filtering", () => {
    it("should return an empty filter if no query params are provided", () => {
      const req = mockRequest();
      const result = generateFilter.sites(req);
      expect(result).to.be.an("object").that.is.empty;
    });

    it("should build an $in filter from repeated site_ids query params", () => {
      const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];
      const req = mockRequest({ site_ids: ids });
      const result = generateFilter.sites(req);
      expect(result._id.$in).to.have.lengthOf(2);
      result._id.$in.forEach((id, i) =>
        expect(id.toString()).to.equal(ids[i])
      );
    });

    it("should build an $in filter from a comma-separated site_ids string", () => {
      const ids = ["507f1f77bcf86cd799439011", "507f1f77bcf86cd799439012"];
      const req = mockRequest({ site_ids: ids.join(",") });
      const result = generateFilter.sites(req);
      expect(result._id.$in).to.have.lengthOf(2);
      result._id.$in.forEach((id, i) =>
        expect(id.toString()).to.equal(ids[i])
      );
    });

    it("should trim whitespace around comma-separated site_ids", () => {
      const req = mockRequest({
        site_ids: " 507f1f77bcf86cd799439011 , 507f1f77bcf86cd799439012 ",
      });
      const result = generateFilter.sites(req);
      expect(result._id.$in).to.have.lengthOf(2);
    });

    it("should drop malformed IDs instead of throwing", () => {
      const req = mockRequest({
        site_ids: "507f1f77bcf86cd799439011,not-an-id",
      });
      const result = generateFilter.sites(req);
      expect(result._id.$in).to.have.lengthOf(1);
      expect(result._id.$in[0].toString()).to.equal(
        "507f1f77bcf86cd799439011"
      );
    });

    it("should leave the filter untouched if every site_id is malformed", () => {
      const req = mockRequest({ site_ids: "not-an-id,also-not-an-id" });
      const result = generateFilter.sites(req);
      expect(result._id).to.be.undefined;
    });

    it("should let site_ids take precedence over a singular site_id", () => {
      const req = mockRequest({
        site_id: "507f1f77bcf86cd799439099",
        site_ids: "507f1f77bcf86cd799439011,507f1f77bcf86cd799439012",
      });
      const result = generateFilter.sites(req);
      expect(result._id.$in).to.have.lengthOf(2);
    });
  });

  // Nexus follow-up: events/fetch's ?index=<category> filter now accepts an
  // optional trailing `resolved` config (see utils/aqi.util.js's
  // resolveActiveAqiRanges) so an admin-set custom AQI range narrows the
  // filter the same way the hardcoded defaults always have.
  const customResolved = {
    AQI_RANGES: {
      good: { min: 0, max: 5 },
      moderate: { min: 5, max: 20 },
      u4sg: { min: 20, max: 40 },
      unhealthy: { min: 40, max: 80 },
      very_unhealthy: { min: 80, max: 150 },
      hazardous: { min: 150, max: null },
    },
  };

  describe("events — index filtering", () => {
    it("uses the hardcoded defaults when no resolved config is passed (backward compatible)", () => {
      const req = mockRequest({ index: "good" });
      const result = generateFilter.events(req, null);
      expect(result["values.pm2_5.value"]).to.deep.equal({ $gte: 0, $lte: 9.1 });
    });

    it("uses a resolved custom config's boundaries when one is passed", () => {
      const req = mockRequest({ index: "good" });
      const result = generateFilter.events(req, null, customResolved);
      expect(result["values.pm2_5.value"]).to.deep.equal({ $gte: 0, $lte: 5 });
    });

    it("omits $lte for the unbounded last category under a custom config", () => {
      const req = mockRequest({ index: "hazardous" });
      const result = generateFilter.events(req, null, customResolved);
      expect(result["values.pm2_5.value"]).to.deep.equal({ $gte: 150 });
    });

    it("drops the pm2_5 filter entirely for an index not present in the resolved config", () => {
      const req = mockRequest({ index: "not-a-real-category" });
      const result = generateFilter.events(req, null, customResolved);
      expect(result).to.not.have.property("values.pm2_5.value");
    });
  });

  describe("fetch — index filtering", () => {
    it("uses the hardcoded defaults when no resolved config is passed (backward compatible)", () => {
      const req = mockRequest({ index: "moderate" });
      const result = generateFilter.fetch(req, null);
      expect(result["values.pm2_5.value"]).to.deep.equal({
        $gte: 9.101,
        $lte: 35.49,
      });
    });

    it("uses a resolved custom config's boundaries when one is passed", () => {
      const req = mockRequest({ index: "moderate" });
      const result = generateFilter.fetch(req, null, customResolved);
      expect(result["values.pm2_5.value"]).to.deep.equal({ $gte: 5, $lte: 20 });
    });
  });
});
