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
});
