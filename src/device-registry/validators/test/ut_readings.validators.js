require("module-alias/register");
process.env.NODE_ENV = "development";
const { expect } = require("chai");

const readingsValidations = require("@validators/readings.validators");

const mockRequest = (query = {}) => ({ query, params: {}, body: {} });

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
