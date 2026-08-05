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
