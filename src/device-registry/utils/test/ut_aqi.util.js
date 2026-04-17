require("module-alias/register");
process.env.NODE_ENV = "development";

const { expect } = require("chai");
const { PM25_AQI_BREAKPOINTS } = require("@config/constants");
const { calculatePm25Aqi, getAqiIndexMongoExpression } = require("@utils/aqi.util");

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
      expect(calculatePm25Aqi(45.0)).to.equal(125);
    });

    it("PM2.5 90.0 → AQI ~175", function() {
      expect(calculatePm25Aqi(90.0)).to.equal(175);
    });

    it("PM2.5 175.0 → AQI ~251", function() {
      expect(calculatePm25Aqi(175.0)).to.equal(251);
    });

    it("PM2.5 275.0 → AQI ~401", function() {
      expect(calculatePm25Aqi(275.0)).to.equal(401);
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
