require("module-alias/register");
process.env.NODE_ENV = "development";

const { expect } = require("chai");
const sinon = require("sinon");
const proxyquire = require("proxyquire");
const constants = require("@config/constants");
const { PM25_AQI_BREAKPOINTS } = constants;
const {
  calculatePm25Aqi,
  getAqiIndexMongoExpression,
  categoryFromConcentration,
  listRanges,
  isValidAqiRangesShape,
} = require("@utils/aqi.util");

// ---------------------------------------------------------------------------
// calculatePm25Aqi — JavaScript implementation
// ---------------------------------------------------------------------------
describe("calculatePm25Aqi", function() {
  // ── Invalid / guard inputs ──────────────────────────────────────────────
  describe("invalid inputs", function() {
    it("returns null for null", function() {
      expect(calculatePm25Aqi(null)).to.equal(null);
    });

    it("returns null for undefined", function() {
      expect(calculatePm25Aqi(undefined)).to.equal(null);
    });

    it("returns null for NaN", function() {
      expect(calculatePm25Aqi(NaN)).to.equal(null);
    });

    it("returns null for a string", function() {
      expect(calculatePm25Aqi("35.4")).to.equal(null);
    });

    it("returns null for negative concentration", function() {
      expect(calculatePm25Aqi(-1)).to.equal(null);
    });
  });

  // ── Truncation (NOT rounding) ───────────────────────────────────────────
  describe("truncation behaviour", function() {
    it("truncates to 1 decimal place — does not round up", function() {
      // 9.09 truncated → 9.0 (Good, AQI 50), NOT 9.1 (Moderate, AQI 51)
      expect(calculatePm25Aqi(9.09)).to.equal(50);
      expect(calculatePm25Aqi(9.09)).to.equal(calculatePm25Aqi(9.0));
    });

    it("treats 9.14 the same as 9.1 after truncation", function() {
      expect(calculatePm25Aqi(9.14)).to.equal(51);
      expect(calculatePm25Aqi(9.14)).to.equal(calculatePm25Aqi(9.1));
    });

    it("treats 35.49 the same as 35.4 after truncation", function() {
      expect(calculatePm25Aqi(35.49)).to.equal(100);
      expect(calculatePm25Aqi(35.49)).to.equal(calculatePm25Aqi(35.4));
    });
  });

  // ── Breakpoint boundaries ───────────────────────────────────────────────
  describe("breakpoint lower and upper bounds", function() {
    // Good  (0–50)
    it("PM2.5 0.0 → AQI 0 (Good lower bound)", function() {
      expect(calculatePm25Aqi(0.0)).to.equal(0);
    });

    it("PM2.5 9.0 → AQI 50 (Good upper bound)", function() {
      expect(calculatePm25Aqi(9.0)).to.equal(50);
    });

    // Moderate (51–100)
    it("PM2.5 9.1 → AQI 51 (Moderate lower bound)", function() {
      expect(calculatePm25Aqi(9.1)).to.equal(51);
    });

    it("PM2.5 35.4 → AQI 100 (Moderate upper bound)", function() {
      expect(calculatePm25Aqi(35.4)).to.equal(100);
    });

    // Unhealthy for Sensitive Groups (101–150)
    it("PM2.5 35.5 → AQI 101 (U4SG lower bound)", function() {
      expect(calculatePm25Aqi(35.5)).to.equal(101);
    });

    it("PM2.5 55.4 → AQI 150 (U4SG upper bound)", function() {
      expect(calculatePm25Aqi(55.4)).to.equal(150);
    });

    // Unhealthy (151–200)
    it("PM2.5 55.5 → AQI 151 (Unhealthy lower bound)", function() {
      expect(calculatePm25Aqi(55.5)).to.equal(151);
    });

    it("PM2.5 125.4 → AQI 200 (Unhealthy upper bound)", function() {
      expect(calculatePm25Aqi(125.4)).to.equal(200);
    });

    // Very Unhealthy (201–300)
    it("PM2.5 125.5 → AQI 201 (Very Unhealthy lower bound)", function() {
      expect(calculatePm25Aqi(125.5)).to.equal(201);
    });

    it("PM2.5 225.4 → AQI 300 (Very Unhealthy upper bound)", function() {
      expect(calculatePm25Aqi(225.4)).to.equal(300);
    });

    // Hazardous (301–500)
    it("PM2.5 225.5 → AQI 301 (Hazardous lower bound)", function() {
      expect(calculatePm25Aqi(225.5)).to.equal(301);
    });

    it("PM2.5 325.4 → AQI 500 (Hazardous upper bound)", function() {
      expect(calculatePm25Aqi(325.4)).to.equal(500);
    });
  });

  // ── Overflow capping ────────────────────────────────────────────────────
  describe("overflow capping", function() {
    it("PM2.5 325.5 → AQI 500 (first value above last breakpoint)", function() {
      expect(calculatePm25Aqi(325.5)).to.equal(500);
    });

    it("PM2.5 500.0 → AQI 500 (extreme value)", function() {
      expect(calculatePm25Aqi(500.0)).to.equal(500);
    });
  });

  // ── Representative known PM2.5→AQI pairs (EPA Equation 1 spot-checks) ──
  describe("known PM2.5 → AQI values", function() {
    it("PM2.5 5.0 → AQI ~28", function() {
      expect(calculatePm25Aqi(5.0)).to.equal(28);
    });

    it("PM2.5 20.0 → AQI ~71", function() {
      expect(calculatePm25Aqi(20.0)).to.equal(71);
    });

    it("PM2.5 45.0 → AQI ~125", function() {
      expect(calculatePm25Aqi(45.0)).to.equal(124);
    });

    it("PM2.5 90.0 → AQI ~175", function() {
      expect(calculatePm25Aqi(90.0)).to.equal(175);
    });

    it("PM2.5 175.0 → AQI ~251", function() {
      expect(calculatePm25Aqi(175.0)).to.equal(250);
    });

    it("PM2.5 275.0 → AQI ~401", function() {
      expect(calculatePm25Aqi(275.0)).to.equal(400);
    });
  });

  // ── Return type ─────────────────────────────────────────────────────────
  describe("return type", function() {
    it("always returns an integer (no fractional part) for valid input", function() {
      const cases = [0, 5.5, 20.3, 55.55, 100.1, 225.9, 300.0];
      cases.forEach((c) => {
        const result = calculatePm25Aqi(c);
        expect(result).to.be.a("number");
        expect(Number.isInteger(result)).to.equal(true, `expected integer for PM2.5=${c}`);
      });
    });

    it("result is within the valid AQI range 0–500 for any non-negative concentration", function() {
      const cases = [0, 1, 9, 9.1, 35.4, 35.5, 100, 225, 300, 325.4, 400];
      cases.forEach((c) => {
        const result = calculatePm25Aqi(c);
        expect(result).to.be.at.least(0);
        expect(result).to.be.at.most(500);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// PM25_AQI_BREAKPOINTS — canonical config table sanity checks
// ---------------------------------------------------------------------------
describe("PM25_AQI_BREAKPOINTS (config/global/aqi)", function() {
  it("is an array of 6 breakpoints", function() {
    expect(PM25_AQI_BREAKPOINTS).to.be.an("array").with.lengthOf(6);
  });

  it("each entry has cLow, cHigh, aqiLow, aqiHigh", function() {
    PM25_AQI_BREAKPOINTS.forEach((bp) => {
      expect(bp).to.have.all.keys("cLow", "cHigh", "aqiLow", "aqiHigh");
    });
  });

  it("each entry has valid numeric values with cHigh > cLow and aqiHigh > aqiLow", function() {
    PM25_AQI_BREAKPOINTS.forEach(({ cLow, cHigh, aqiLow, aqiHigh }, i) => {
      const msg = `breakpoint[${i}]`;
      expect(cLow,   `${msg} cLow`).to.be.a("number").and.be.at.least(0);
      expect(cHigh,  `${msg} cHigh`).to.be.a("number").and.be.at.least(0);
      expect(aqiLow, `${msg} aqiLow`).to.be.a("number").and.be.at.least(0);
      expect(aqiHigh,`${msg} aqiHigh`).to.be.a("number").and.be.at.least(0);
      expect(cHigh).to.be.above(cLow,   `${msg}: cHigh must be > cLow`);
      expect(aqiHigh).to.be.above(aqiLow, `${msg}: aqiHigh must be > aqiLow`);
    });
  });

  it("breakpoints are contiguous — no gaps between ranges", function() {
    for (let i = 1; i < PM25_AQI_BREAKPOINTS.length; i++) {
      const prev = PM25_AQI_BREAKPOINTS[i - 1];
      const curr = PM25_AQI_BREAKPOINTS[i];
      // Gap check: curr.cLow should be exactly 0.1 above prev.cHigh
      expect(curr.cLow).to.be.closeTo(prev.cHigh + 0.1, 0.001,
        `gap between breakpoint ${i - 1} and ${i}`);
    }
  });

  it("AQI ranges are increasing and non-overlapping", function() {
    for (let i = 1; i < PM25_AQI_BREAKPOINTS.length; i++) {
      const prev = PM25_AQI_BREAKPOINTS[i - 1];
      const curr = PM25_AQI_BREAKPOINTS[i];
      expect(curr.aqiLow).to.equal(prev.aqiHigh + 1,
        `AQI ranges should be adjacent at breakpoint ${i}`);
    }
  });
});

// ---------------------------------------------------------------------------
// getAqiIndexMongoExpression — structural validation
// ---------------------------------------------------------------------------
describe("getAqiIndexMongoExpression", function() {
  it("returns an object with a $cond key", function() {
    const expr = getAqiIndexMongoExpression();
    expect(expr).to.be.an("object").that.has.key("$cond");
  });

  it("uses the default field path $pm2_5.value when no argument provided", function() {
    const expr = getAqiIndexMongoExpression();
    expect(expr.$cond.if.$and[0].$ne[0]).to.equal("$pm2_5.value");
  });

  it("accepts a custom field path", function() {
    const expr = getAqiIndexMongoExpression("$average_pm2_5.value");
    expect(expr.$cond.if.$and[0].$ne[0]).to.equal("$average_pm2_5.value");
  });

  it("the then branch contains a $let with variable c", function() {
    const expr = getAqiIndexMongoExpression();
    expect(expr.$cond.then).to.have.key("$let");
    expect(expr.$cond.then.$let.vars).to.have.key("c");
  });

  it("the $switch inside $let has the correct number of branches", function() {
    const expr = getAqiIndexMongoExpression();
    const switchExpr = expr.$cond.then.$let.in.$switch;
    // PM25_AQI_BREAKPOINTS.length breakpoints + 1 overflow branch
    expect(switchExpr.branches).to.have.lengthOf(PM25_AQI_BREAKPOINTS.length + 1);
  });

  it("the else branch returns null for invalid values", function() {
    const expr = getAqiIndexMongoExpression();
    expect(expr.$cond.else).to.equal(null);
  });
});

// ---------------------------------------------------------------------------
// categoryFromConcentration — maps an averaged PM2.5 value to a category key
// ---------------------------------------------------------------------------
describe("categoryFromConcentration", function() {
  describe("invalid inputs", function() {
    it("returns null for null", function() {
      expect(categoryFromConcentration(null)).to.equal(null);
    });

    it("returns null for undefined", function() {
      expect(categoryFromConcentration(undefined)).to.equal(null);
    });

    it("returns null for NaN", function() {
      expect(categoryFromConcentration(NaN)).to.equal(null);
    });

    it("returns null for a string", function() {
      expect(categoryFromConcentration("20")).to.equal(null);
    });

    it("returns null for negative concentration", function() {
      expect(categoryFromConcentration(-5)).to.equal(null);
    });
  });

  describe("category boundaries (mirrors AQI_RANGES)", function() {
    it("0 -> good", function() {
      expect(categoryFromConcentration(0)).to.equal("good");
    });

    it("9.1 -> good (upper bound)", function() {
      expect(categoryFromConcentration(9.1)).to.equal("good");
    });

    it("9.101 -> moderate (lower bound)", function() {
      expect(categoryFromConcentration(9.101)).to.equal("moderate");
    });

    it("35.49 -> moderate (upper bound)", function() {
      expect(categoryFromConcentration(35.49)).to.equal("moderate");
    });

    it("35.491 -> u4sg (lower bound)", function() {
      expect(categoryFromConcentration(35.491)).to.equal("u4sg");
    });

    it("125.49 -> unhealthy (upper bound)", function() {
      expect(categoryFromConcentration(125.49)).to.equal("unhealthy");
    });

    it("225.491 -> hazardous (lower bound, unbounded max)", function() {
      expect(categoryFromConcentration(225.491)).to.equal("hazardous");
    });

    it("a very large value still resolves to hazardous", function() {
      expect(categoryFromConcentration(10000)).to.equal("hazardous");
    });
  });

  // AQI_RANGES has thousandths-place gaps between adjacent categories
  // (e.g. good max 9.1, moderate min 9.101). Averaged values can land in
  // these gaps — every one must still resolve to the next (higher) category,
  // never null.
  describe("boundary-gap regression (values between adjacent max/min)", function() {
    it("9.1005 (between good's max and moderate's min) -> moderate", function() {
      expect(categoryFromConcentration(9.1005)).to.equal("moderate");
    });

    it("35.4905 (between moderate's max and u4sg's min) -> u4sg", function() {
      expect(categoryFromConcentration(35.4905)).to.equal("u4sg");
    });

    it("55.4905 (between u4sg's max and unhealthy's min) -> unhealthy", function() {
      expect(categoryFromConcentration(55.4905)).to.equal("unhealthy");
    });

    it("125.4905 (between unhealthy's max and very_unhealthy's min) -> very_unhealthy", function() {
      expect(categoryFromConcentration(125.4905)).to.equal("very_unhealthy");
    });

    it("225.4905 (between very_unhealthy's max and hazardous's min) -> hazardous", function() {
      expect(categoryFromConcentration(225.4905)).to.equal("hazardous");
    });
  });
});

// ---------------------------------------------------------------------------
// listRanges — assembles the dynamic AQI legend response
// ---------------------------------------------------------------------------
describe("listRanges", function() {
  it("returns a success envelope with a standard identifier", function() {
    const result = listRanges();
    expect(result.success).to.equal(true);
    expect(result.data.standard).to.be.a("string").and.not.be.empty;
  });

  it("returns one range entry per AQI_CATEGORY_KEYS, in order", function() {
    const result = listRanges();
    expect(result.data.ranges)
      .to.be.an("array")
      .with.lengthOf(constants.AQI_CATEGORY_KEYS.length);
    result.data.ranges.forEach((range, index) => {
      expect(range.key).to.equal(constants.AQI_CATEGORY_KEYS[index]);
      expect(range.display_order).to.equal(index + 1);
    });
  });

  it("each range has a label, numeric min_value, color, and color_name matching constants", function() {
    const result = listRanges();
    result.data.ranges.forEach((range) => {
      const key = range.key;
      expect(range.label).to.equal(constants.AQI_CATEGORIES[key]);
      expect(range.min_value).to.equal(constants.AQI_RANGES[key].min);
      expect(range.max_value).to.equal(constants.AQI_RANGES[key].max);
      expect(range.color).to.equal(`#${constants.AQI_COLORS[key]}`);
      expect(range.color_name).to.equal(constants.AQI_COLOR_NAMES[key]);
    });
  });

  it("the last range (hazardous) has a null max_value (unbounded)", function() {
    const result = listRanges();
    const hazardous = result.data.ranges[result.data.ranges.length - 1];
    expect(hazardous.key).to.equal("hazardous");
    expect(hazardous.max_value).to.equal(null);
  });
});

// ---------------------------------------------------------------------------
// categoryFromConcentration / listRanges — with an injected "resolved"
// override (the shape resolveActiveAqiRanges produces from a custom
// SystemConfig doc), proving the admin-editable path actually changes output
// and never falls back to the hardcoded defaults when an override is given.
// ---------------------------------------------------------------------------
describe("categoryFromConcentration / listRanges with a resolved override", function() {
  const customResolved = {
    AQI_RANGES: {
      good: { min: 0, max: 5 },
      moderate: { min: 5, max: 20 },
      u4sg: { min: 20, max: 40 },
      unhealthy: { min: 40, max: 80 },
      very_unhealthy: { min: 80, max: 150 },
      hazardous: { min: 150, max: null },
    },
    AQI_CATEGORIES: {
      good: "Great",
      moderate: "OK",
      u4sg: "Caution",
      unhealthy: "Bad",
      very_unhealthy: "Very Bad",
      hazardous: "Severe",
    },
    AQI_COLORS: {
      good: "00FF00",
      moderate: "FFFF00",
      u4sg: "FFA500",
      unhealthy: "FF0000",
      very_unhealthy: "800080",
      hazardous: "000000",
    },
    AQI_COLOR_NAMES: {
      good: "Green",
      moderate: "Yellow",
      u4sg: "Orange",
      unhealthy: "Red",
      very_unhealthy: "Purple",
      hazardous: "Black",
    },
    AQI_CATEGORY_KEYS: [
      "good",
      "moderate",
      "u4sg",
      "unhealthy",
      "very_unhealthy",
      "hazardous",
    ],
    source: "custom",
  };

  it("categoryFromConcentration classifies against the override, not the defaults", function() {
    // 6 would be "moderate" under this override (good's max is 5) but is
    // still well within default "good" (max 9.1) — proves the override wins.
    expect(categoryFromConcentration(6, customResolved)).to.equal("moderate");
    expect(categoryFromConcentration(6)).to.equal("good");
  });

  it("categoryFromConcentration with no override still uses the hardcoded defaults (backward compatible)", function() {
    expect(categoryFromConcentration(20)).to.equal("moderate");
  });

  it("listRanges reflects the override's labels, colors, and source: custom", function() {
    const result = listRanges(customResolved);
    expect(result.data.source).to.equal("custom");
    const good = result.data.ranges[0];
    expect(good.label).to.equal("Great");
    expect(good.max_value).to.equal(5);
    expect(good.color).to.equal("#00FF00");
  });

  it("listRanges with no override reports source: default", function() {
    const result = listRanges();
    expect(result.data.source).to.equal("default");
  });
});

// ---------------------------------------------------------------------------
// isValidAqiRangesShape — defensive re-validation of a stored/candidate value
// ---------------------------------------------------------------------------
describe("isValidAqiRangesShape", function() {
  const validRanges = constants.AQI_CATEGORY_KEYS.map((key, index, arr) => ({
    key,
    label: constants.AQI_CATEGORIES[key],
    max_value: index === arr.length - 1 ? null : (index + 1) * 10,
    color: "34C759",
  }));

  it("accepts a well-formed value", function() {
    expect(isValidAqiRangesShape({ ranges: validRanges })).to.equal(true);
  });

  it("rejects a missing/non-object value", function() {
    expect(isValidAqiRangesShape(null)).to.equal(false);
    expect(isValidAqiRangesShape(undefined)).to.equal(false);
    expect(isValidAqiRangesShape("not an object")).to.equal(false);
  });

  it("rejects the wrong number of categories", function() {
    expect(isValidAqiRangesShape({ ranges: validRanges.slice(0, 5) })).to.equal(false);
  });

  it("rejects out-of-order keys", function() {
    const reordered = [...validRanges].reverse();
    expect(isValidAqiRangesShape({ ranges: reordered })).to.equal(false);
  });

  it("rejects a non-increasing max_value", function() {
    const broken = validRanges.map((r, i) => (i === 2 ? { ...r, max_value: 5 } : r));
    expect(isValidAqiRangesShape({ ranges: broken })).to.equal(false);
  });

  it("rejects a non-null max_value on the last category", function() {
    const broken = validRanges.map((r, i, arr) =>
      i === arr.length - 1 ? { ...r, max_value: 999 } : r
    );
    expect(isValidAqiRangesShape({ ranges: broken })).to.equal(false);
  });

  it("rejects an invalid color", function() {
    const broken = validRanges.map((r, i) => (i === 0 ? { ...r, color: "notahex" } : r));
    expect(isValidAqiRangesShape({ ranges: broken })).to.equal(false);
  });

  it("rejects an empty label", function() {
    const broken = validRanges.map((r, i) => (i === 0 ? { ...r, label: "  " } : r));
    expect(isValidAqiRangesShape({ ranges: broken })).to.equal(false);
  });
});

// ---------------------------------------------------------------------------
// resolveActiveAqiRanges / invalidateAqiRangesCache — proxied so no real
// Mongoose model is touched. Each test re-proxies aqi.util fresh (proxyquire
// gives a new module instance, so the in-memory cache never leaks between
// tests).
// ---------------------------------------------------------------------------
describe("resolveActiveAqiRanges / invalidateAqiRangesCache", function() {
  let findOneStub;
  let proxiedAqiUtil;

  const mockFindOneChain = (doc) => ({
    lean: () => Promise.resolve(doc),
  });

  beforeEach(function() {
    findOneStub = sinon.stub();
    // @noCallThru: proxyquire otherwise falls back to the real module for
    // anything this stub doesn't provide — irrelevant in practice since the
    // stub is a full function replacement, not a partial object override,
    // but explicit here so this test can never accidentally reach the real,
    // unconnected SystemConfig model.
    const systemConfigStub = () => ({ findOne: findOneStub });
    systemConfigStub["@noCallThru"] = true;
    proxiedAqiUtil = proxyquire("../aqi.util", {
      "@models/SystemConfig": systemConfigStub,
    });
  });

  afterEach(function() {
    sinon.restore();
  });

  it("returns the defaults when no override document exists", async function() {
    findOneStub.returns(mockFindOneChain(null));
    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(resolved.source).to.equal("default");
    expect(resolved.AQI_RANGES).to.deep.equal(constants.AQI_RANGES);
  });

  it("does not mutate constants.AQI_RANGES when returning the defaults", async function() {
    const before = JSON.stringify(constants.AQI_RANGES);
    findOneStub.returns(mockFindOneChain(null));
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(JSON.stringify(constants.AQI_RANGES)).to.equal(before);
  });

  it("returns a custom config built from a valid stored document", async function() {
    const storedValue = {
      ranges: constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        min_value: i === 0 ? 0 : i * 10,
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "ABCDEF",
      })),
    };
    findOneStub.returns(mockFindOneChain({ value: storedValue }));

    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(resolved.source).to.equal("custom");
    expect(resolved.AQI_CATEGORIES.good).to.equal("Custom good");
    expect(resolved.AQI_COLORS.good).to.equal("ABCDEF");
  });

  it("derives min_value from the previous category's max_value rather than trusting a stored min_value", async function() {
    // isValidAqiRangesShape doesn't check min_value at all, so a doc that was
    // hand-edited outside the API (bypassing the controller's own derivation)
    // could carry a bogus/missing min_value. The resolved config must never
    // surface it as-is.
    const storedValue = {
      ranges: constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        min_value: 99999, // deliberately wrong on every entry
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "ABCDEF",
      })),
    };
    findOneStub.returns(mockFindOneChain({ value: storedValue }));

    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    const keys = constants.AQI_CATEGORY_KEYS;
    expect(resolved.AQI_RANGES[keys[0]].min).to.equal(0);
    expect(resolved.AQI_RANGES[keys[1]].min).to.equal(resolved.AQI_RANGES[keys[0]].max);
    expect(resolved.AQI_RANGES[keys[2]].min).to.equal(resolved.AQI_RANGES[keys[1]].max);
  });

  it("falls back to the default color_name when the stored one is not a string", async function() {
    const storedValue = {
      ranges: constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        min_value: 0,
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "ABCDEF",
        color_name: { not: "a string" },
      })),
    };
    findOneStub.returns(mockFindOneChain({ value: storedValue }));

    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    const goodKey = constants.AQI_CATEGORY_KEYS[0];
    expect(resolved.AQI_COLOR_NAMES[goodKey]).to.equal(constants.AQI_COLOR_NAMES[goodKey]);
  });

  it("falls back to the default color_name when the stored one is an empty/whitespace string", async function() {
    const storedValue = {
      ranges: constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        min_value: 0,
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "ABCDEF",
        color_name: "   ",
      })),
    };
    findOneStub.returns(mockFindOneChain({ value: storedValue }));

    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    const goodKey = constants.AQI_CATEGORY_KEYS[0];
    expect(resolved.AQI_COLOR_NAMES[goodKey]).to.equal(constants.AQI_COLOR_NAMES[goodKey]);
  });

  it("uses a valid stored color_name, trimmed", async function() {
    const storedValue = {
      ranges: constants.AQI_CATEGORY_KEYS.map((key, i, arr) => ({
        key,
        label: "Custom " + key,
        min_value: 0,
        max_value: i === arr.length - 1 ? null : (i + 1) * 10,
        color: "ABCDEF",
        color_name: "  Emerald  ",
      })),
    };
    findOneStub.returns(mockFindOneChain({ value: storedValue }));

    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    const goodKey = constants.AQI_CATEGORY_KEYS[0];
    expect(resolved.AQI_COLOR_NAMES[goodKey]).to.equal("Emerald");
  });

  it("falls back to defaults when the stored document is malformed", async function() {
    findOneStub.returns(mockFindOneChain({ value: { ranges: [{ key: "not-enough" }] } }));
    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(resolved.source).to.equal("default");
  });

  it("falls back to defaults (does not throw) when the query fails", async function() {
    findOneStub.returns({ lean: () => Promise.reject(new Error("Mongo error")) });
    const resolved = await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(resolved.source).to.equal("default");
  });

  it("serves from cache on a second call within the TTL — does not re-query", async function() {
    findOneStub.returns(mockFindOneChain(null));
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(findOneStub.calledOnce).to.equal(true);
  });

  it("invalidateAqiRangesCache forces a re-query on the next call", async function() {
    findOneStub.returns(mockFindOneChain(null));
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    proxiedAqiUtil.invalidateAqiRangesCache("airqo");
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    expect(findOneStub.calledTwice).to.equal(true);
  });

  it("caches per tenant independently", async function() {
    findOneStub.returns(mockFindOneChain(null));
    await proxiedAqiUtil.resolveActiveAqiRanges("airqo");
    await proxiedAqiUtil.resolveActiveAqiRanges("kcca");
    expect(findOneStub.calledTwice).to.equal(true);
  });
});
