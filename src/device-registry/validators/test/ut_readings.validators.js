require("module-alias/register");
process.env.NODE_ENV = "development";
const { expect } = require("chai");

const readingsValidations = require("@validators/readings.validators");

const mockRequest = (query = {}) => ({ query, params: {}, body: {} });
const mockBodyRequest = (body = {}) => ({ query: {}, params: {}, body });

// Resolves once either next() is called (validation passed) or res.json() is
// called (validation failed — the shared middleware responds directly with
// 400 rather than calling next() with an error, see createValidationMiddleware
// in readings.validators.js).
const runValidation = (query) =>
  new Promise((resolve) => {
    const req = mockRequest(query);
    const res = {};
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (body) => {
      res.body = body;
      settle({ res, passed: false });
      return res;
    };
    const next = () => settle({ res, passed: true });

    readingsValidations.rankingsHistory(req, res, next);
  });

// Same settle-on-next-or-res.json shape as runValidation above, but drives
// recentBySiteIds off req.body instead of req.query, and returns req so tests
// can assert the site_ids -> query.site_id copy that the POST /recent route
// relies on to reuse generateFilter.telemetry unchanged.
const runBodyValidation = (body) =>
  new Promise((resolve) => {
    const req = mockBodyRequest(body);
    const res = {};
    let settled = false;
    const settle = (result) => {
      if (!settled) {
        settled = true;
        resolve(result);
      }
    };
    res.status = (code) => {
      res.statusCode = code;
      return res;
    };
    res.json = (responseBody) => {
      res.body = responseBody;
      settle({ req, res, passed: false });
      return res;
    };
    const next = () => settle({ req, res, passed: true });

    readingsValidations.recentBySiteIds(req, res, next);
  });

// rankingsHistory's 5-year span cap: exercises the exact off-by-one this
// regression targets — a start_year/end_year pair 5 years apart (inclusive of
// both ends, 6 years of data) must be rejected; 4 years apart (5 years of
// data) must be accepted.
describe("readingsValidations.rankingsHistory", () => {
  it("rejects a start_year/end_year span of exactly 5 years (6 inclusive years)", async () => {
    const { res, passed } = await runValidation({
      level: "country",
      start_year: "2020",
      end_year: "2025",
    });

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
    expect(res.body.success).to.equal(false);
  });

  it("accepts a start_year/end_year span of 4 years (5 inclusive years)", async () => {
    const { passed } = await runValidation({
      level: "country",
      start_year: "2020",
      end_year: "2024",
    });

    expect(passed).to.equal(true);
  });

  it("rejects end_year earlier than start_year", async () => {
    const { passed, res } = await runValidation({
      level: "country",
      start_year: "2024",
      end_year: "2020",
    });

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
  });

  it("rejects a request missing start_year/end_year", async () => {
    const { passed, res } = await runValidation({ level: "country" });

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
  });
});

// POST /recent's body-based alternative to comma-separated ?site_id=. Confirms
// the array is required/non-empty/all-valid-ObjectId, and that on success it's
// copied onto req.query.site_id so generateFilter.telemetry (query/params only)
// picks it up without any change to the existing GET /recent code path.
describe("readingsValidations.recentBySiteIds", () => {
  const validId1 = "624d2f9a994194001ddccbb6";
  const validId2 = "623d84340e8054001eaaaa13";

  it("rejects a request missing site_ids", async () => {
    const { passed, res } = await runBodyValidation({});

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
  });

  it("rejects an empty site_ids array", async () => {
    const { passed, res } = await runBodyValidation({ site_ids: [] });

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
  });

  it("rejects site_ids containing an invalid ObjectId", async () => {
    const { passed, res } = await runBodyValidation({
      site_ids: [validId1, "not-an-object-id"],
    });

    expect(passed).to.equal(false);
    expect(res.statusCode).to.equal(400);
  });

  it("accepts a valid site_ids array and copies it onto req.query.site_id", async () => {
    const { passed, req } = await runBodyValidation({
      site_ids: [validId1, validId2],
    });

    expect(passed).to.equal(true);
    expect(req.query.site_id).to.deep.equal([validId1, validId2]);
  });
});
