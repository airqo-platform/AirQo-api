require("module-alias/register");
const { expect } = require("chai");
const { validationResult } = require("express-validator");
const siteValidator = require("@validators/site.validators");

const mockRequest = (query = {}, body = {}, params = {}) => ({
  query,
  body,
  params,
  headers: {},
  get(header) {
    return this.headers[header];
  },
});

// Runs every chain in a validator array against the request.
const runChains = async (chains, req) => {
  for (const chain of chains) {
    await chain.run(req);
  }
  return validationResult(req);
};

const errorFields = (result) => result.array().map((e) => e.param);

describe("Site Validator", () => {
  describe("validateNearestSite", () => {
    const baseQuery = { latitude: "0.34760", longitude: "32.58250", radius: "5" };

    it("accepts the existing documented request unchanged", async () => {
      const req = mockRequest({ ...baseQuery });
      const result = await runChains(siteValidator.validateNearestSite, req);
      expect(result.isEmpty()).to.equal(true);
    });

    it("accepts latitude=0.247000 (trailing zeros no longer count against precision)", async () => {
      const req = mockRequest({ ...baseQuery, latitude: "0.247000" });
      const result = await runChains(siteValidator.validateNearestSite, req);
      expect(result.isEmpty()).to.equal(true);
    });

    it("accepts low-precision and integer coordinates", async () => {
      const req = mockRequest({ ...baseQuery, latitude: "0.3", longitude: "32" });
      const result = await runChains(siteValidator.validateNearestSite, req);
      expect(result.isEmpty()).to.equal(true);
    });

    it("still rejects out-of-range or malformed coordinates", async () => {
      const outOfRange = mockRequest({ ...baseQuery, latitude: "91.0" });
      const malformed = mockRequest({ ...baseQuery, longitude: "abc" });
      expect(
        errorFields(
          await runChains(siteValidator.validateNearestSite, outOfRange)
        )
      ).to.include("latitude");
      expect(
        errorFields(
          await runChains(siteValidator.validateNearestSite, malformed)
        )
      ).to.include("longitude");
    });

    describe("active_within_days", () => {
      it("is optional", async () => {
        const req = mockRequest({ ...baseQuery });
        await runChains(siteValidator.validateNearestSite, req);
        expect(req.query).to.not.have.property("active_within_days");
      });

      it("accepts and converts a positive integer", async () => {
        const req = mockRequest({ ...baseQuery, active_within_days: "7" });
        const result = await runChains(siteValidator.validateNearestSite, req);
        expect(result.isEmpty()).to.equal(true);
        expect(req.query.active_within_days).to.equal(7);
      });

      it("accepts the 365 maximum", async () => {
        const req = mockRequest({ ...baseQuery, active_within_days: "365" });
        const result = await runChains(siteValidator.validateNearestSite, req);
        expect(result.isEmpty()).to.equal(true);
      });

      ["0", "-1", "366", "1.5", "abc"].forEach((value) => {
        it(`rejects ${value}`, async () => {
          const req = mockRequest({ ...baseQuery, active_within_days: value });
          const result = await runChains(
            siteValidator.validateNearestSite,
            req
          );
          expect(errorFields(result)).to.include("active_within_days");
        });
      });
    });

    describe("summary", () => {
      it("accepts true and converts it to a boolean", async () => {
        const req = mockRequest({ ...baseQuery, summary: "true" });
        const result = await runChains(siteValidator.validateNearestSite, req);
        expect(result.isEmpty()).to.equal(true);
        expect(req.query.summary).to.equal(true);
      });

      it("accepts false and converts it to a boolean", async () => {
        const req = mockRequest({ ...baseQuery, summary: "false" });
        const result = await runChains(siteValidator.validateNearestSite, req);
        expect(result.isEmpty()).to.equal(true);
        expect(req.query.summary).to.equal(false);
      });

      it("rejects a non-boolean value", async () => {
        const req = mockRequest({ ...baseQuery, summary: "yes please" });
        const result = await runChains(siteValidator.validateNearestSite, req);
        expect(errorFields(result)).to.include("summary");
      });
    });
  });

  describe("validateCreateSite", () => {
    it("still rejects latitude=0.247000 (site creation keeps its 5-decimal rule)", async () => {
      const req = mockRequest(
        {},
        { latitude: "0.247000", longitude: "32.582501", name: "kampala_road" }
      );
      const result = await runChains(siteValidator.validateCreateSite, req);
      expect(errorFields(result)).to.include("latitude");
      expect(errorFields(result)).to.not.include("longitude");
    });
  });
});
