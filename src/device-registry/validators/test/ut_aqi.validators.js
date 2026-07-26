require("module-alias/register");
process.env.NODE_ENV = "development";
const { expect } = require("chai");

const constants = require("@config/constants");
const aqiValidations = require("@validators/aqi.validators");

const mockRequest = (body = {}, query = {}) => ({ body, query, params: {} });

// Runs an array-style validator chain (as used directly as Express route
// middleware, e.g. router.put("/", aqiValidations.updateRanges, ...)) and
// resolves with whatever the final next() call received: undefined if every
// middleware passed, or the HttpError instance passed by validate/requireAdminSecret
// on the first failure.
const runChain = (chain, req) =>
  new Promise((resolve) => {
    const res = {};
    let index = 0;
    const runNext = (err) => {
      if (err || index >= chain.length) {
        resolve(err);
        return;
      }
      const middleware = chain[index++];
      Promise.resolve(middleware(req, res, runNext)).catch(runNext);
    };
    runNext();
  });

const TEST_SECRET = "test-admin-secret-value";

const validRanges = () =>
  constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
    key,
    label: "Custom " + key,
    max_value: i === arr.length - 1 ? null : (i + 1) * 10,
    color: "#ABCDEF",
  }));

describe("aqiValidations.updateRanges / deleteRanges", () => {
  let originalSecret;

  beforeEach(() => {
    originalSecret = constants.ADMIN_SETUP_SECRET;
  });

  afterEach(() => {
    constants.ADMIN_SETUP_SECRET = originalSecret;
  });

  describe("when ADMIN_SETUP_SECRET is not configured on the server", () => {
    beforeEach(() => {
      constants.ADMIN_SETUP_SECRET = "";
    });

    it("rejects with 500, distinct from a wrong-secret 403", async () => {
      const req = mockRequest({ ranges: validRanges(), admin_secret: "anything" });
      const err = await runChain(aqiValidations.updateRanges, req);

      expect(err).to.exist;
      expect(err.statusCode).to.equal(500);
    });
  });

  describe("with ADMIN_SETUP_SECRET configured", () => {
    beforeEach(() => {
      constants.ADMIN_SETUP_SECRET = TEST_SECRET;
    });

    it("accepts a well-formed body with the correct admin_secret", async () => {
      const req = mockRequest({ ranges: validRanges(), admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err).to.be.undefined;
    });

    it("rejects a missing admin_secret with 403 (auth runs before field validation, so no schema details leak to unauthenticated callers)", async () => {
      const req = mockRequest({ ranges: validRanges() });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(403);
    });

    it("rejects a wrong admin_secret with 403", async () => {
      const req = mockRequest({ ranges: validRanges(), admin_secret: "wrong-secret" });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(403);
    });

    it("rejects a non-string admin_secret (e.g. a number) with 403 rather than crashing on Buffer.from", async () => {
      const req = mockRequest({ ranges: validRanges(), admin_secret: 123456 });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(403);
    });

    it("still rejects a malformed ranges body with 400 once authenticated", async () => {
      const ranges = validRanges();
      ranges[0].label = "   "; // empty after trim
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects the wrong number of categories", async () => {
      const req = mockRequest({
        ranges: validRanges().slice(0, 5),
        admin_secret: TEST_SECRET,
      });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects out-of-order keys", async () => {
      const req = mockRequest({
        ranges: [...validRanges()].reverse(),
        admin_secret: TEST_SECRET,
      });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects a non-increasing max_value", async () => {
      const ranges = validRanges();
      ranges[2].max_value = ranges[1].max_value; // not strictly greater
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects a non-null max_value on the last (hazardous) category", async () => {
      const ranges = validRanges();
      ranges[ranges.length - 1].max_value = 999;
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects an invalid hex color", async () => {
      const ranges = validRanges();
      ranges[0].color = "not-a-color";
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects a color missing the leading #", async () => {
      const ranges = validRanges();
      ranges[0].color = "ABCDEF";
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects an empty label", async () => {
      const ranges = validRanges();
      ranges[0].label = "   ";
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("does not require min_value in the request body", async () => {
      const ranges = validRanges(); // no min_value on any entry
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err).to.be.undefined;
    });

    it("accepts a well-formed color_name when provided", async () => {
      const ranges = validRanges();
      ranges[0].color_name = "Emerald";
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err).to.be.undefined;
    });

    it("rejects a non-string color_name", async () => {
      const ranges = validRanges();
      ranges[0].color_name = { not: "a string" };
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("rejects an empty/whitespace color_name", async () => {
      const ranges = validRanges();
      ranges[0].color_name = "   ";
      const req = mockRequest({ ranges, admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.updateRanges, req);
      expect(err.statusCode).to.equal(400);
    });

    it("deleteRanges accepts the correct admin_secret via query", async () => {
      const req = mockRequest({}, { admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.deleteRanges, req);
      expect(err).to.be.undefined;
    });

    it("deleteRanges rejects a wrong admin_secret with 403", async () => {
      const req = mockRequest({}, { admin_secret: "wrong" });
      const err = await runChain(aqiValidations.deleteRanges, req);
      expect(err.statusCode).to.equal(403);
    });

    it("deleteRanges rejects a non-string admin_secret (e.g. a number) with 403 rather than crashing on Buffer.from", async () => {
      const req = mockRequest({}, { admin_secret: 123456 });
      const err = await runChain(aqiValidations.deleteRanges, req);
      expect(err.statusCode).to.equal(403);
    });

    it("deleteRanges accepts the correct admin_secret via body too", async () => {
      const req = mockRequest({ admin_secret: TEST_SECRET });
      const err = await runChain(aqiValidations.deleteRanges, req);
      expect(err).to.be.undefined;
    });
  });
});
