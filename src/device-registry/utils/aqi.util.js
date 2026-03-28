/**
 * AQI Utility — US EPA PM2.5 Air Quality Index calculation
 *
 * Formula reference:
 *   US EPA Technical Assistance Document for the Reporting of Daily Air Quality –
 *   the Air Quality Index (AQI), EPA-454/B-24-002 (2024 revision).
 *   https://www.airnow.gov/sites/default/files/2024-02/aqi-technical-assistance-document-sept2018.pdf
 *
 * Equation 1 (piecewise linear interpolation):
 *   AQI_p = round( ((AQI_Hi - AQI_Lo) / (BP_Hi - BP_Lo)) * (C_p - BP_Lo) + AQI_Lo )
 *
 * Where:
 *   C_p   = PM2.5 concentration truncated to 1 decimal place (µg/m³)
 *   BP_Lo = lower breakpoint concentration ≤ C_p
 *   BP_Hi = upper breakpoint concentration ≥ C_p
 *   AQI_Lo = AQI value corresponding to BP_Lo
 *   AQI_Hi = AQI value corresponding to BP_Hi
 *
 * Breakpoints follow the 2024 EPA NAAQS PM2.5 annual standard revision (9 µg/m³).
 * The canonical breakpoint table lives in @config/global/aqi — import from there;
 * do NOT redefine it locally.
 */

// Single source of truth for PM2.5 AQI breakpoints
const { PM25_AQI_BREAKPOINTS } = require("@config/constants");

// Fail fast at module load time if the breakpoint table is misconfigured.
// This prevents Infinity/NaN slopes from silently propagating into the
// MongoDB expression and the JS formula.
PM25_AQI_BREAKPOINTS.forEach(({ cLow, cHigh, aqiLow, aqiHigh }, i) => {
  if (cHigh <= cLow) {
    throw new Error(
      `PM25_AQI_BREAKPOINTS[${i}]: cHigh (${cHigh}) must be greater than cLow (${cLow})`
    );
  }
  if (aqiHigh <= aqiLow) {
    throw new Error(
      `PM25_AQI_BREAKPOINTS[${i}]: aqiHigh (${aqiHigh}) must be greater than aqiLow (${aqiLow})`
    );
  }
});

const PM25_MAX_AQI = 500;
// Concentrations above this threshold are capped at AQI 500 per EPA guidance
const PM25_OVERFLOW_THRESHOLD =
  PM25_AQI_BREAKPOINTS[PM25_AQI_BREAKPOINTS.length - 1].cHigh;

/**
 * Calculate the numeric AQI value from a PM2.5 concentration using the EPA formula.
 *
 * @param {number|null|undefined} concentration - Raw PM2.5 concentration in µg/m³
 * @returns {number|null} Integer AQI value (0–500), or null if input is invalid
 */
function calculatePm25Aqi(concentration) {
  if (
    concentration === null ||
    concentration === undefined ||
    typeof concentration !== "number" ||
    isNaN(concentration) ||
    concentration < 0
  ) {
    return null;
  }

  // Truncate to 1 decimal place (EPA standard — do NOT round)
  const c = Math.trunc(concentration * 10) / 10;

  // Values above the last breakpoint upper bound are capped at AQI 500
  if (c > PM25_OVERFLOW_THRESHOLD) {
    return PM25_MAX_AQI;
  }

  const bp = PM25_AQI_BREAKPOINTS.find((b) => c >= b.cLow && c <= b.cHigh);
  if (!bp) return null;

  const aqi =
    ((bp.aqiHigh - bp.aqiLow) / (bp.cHigh - bp.cLow)) * (c - bp.cLow) +
    bp.aqiLow;

  return Math.round(aqi);
}

/**
 * Build a MongoDB aggregation expression that computes a numeric AQI value
 * from the PM2.5 concentration at a given field path.
 *
 * The expression implements the same EPA formula as calculatePm25Aqi() but
 * executes inside a MongoDB aggregation pipeline ($addFields stage).
 * Branches are generated programmatically from PM25_AQI_BREAKPOINTS so that
 * the JS and Mongo implementations share a single source of truth.
 *
 * @param {string} [fieldPath="$pm2_5.value"] - MongoDB field reference for PM2.5 concentration
 * @returns {Object} MongoDB expression object (suitable for use in $addFields)
 */
function getAqiIndexMongoExpression(fieldPath = "$pm2_5.value") {
  // Build the $switch branches at call-time from the canonical breakpoint table.
  // Arithmetic (aqiHigh-aqiLow, cHigh-cLow) is evaluated in Node.js, not in Mongo,
  // so the pipeline receives pre-computed constant ratios — no runtime overhead.
  const switchBranches = PM25_AQI_BREAKPOINTS.map(
    ({ cLow, cHigh, aqiLow, aqiHigh }) => ({
      case: {
        $and: [{ $gte: ["$$c", cLow] }, { $lte: ["$$c", cHigh] }],
      },
      then: {
        $round: [
          {
            $add: [
              aqiLow,
              {
                $multiply: [
                  (aqiHigh - aqiLow) / (cHigh - cLow), // pre-computed slope constant
                  { $subtract: ["$$c", cLow] },
                ],
              },
            ],
          },
          0,
        ],
      },
    })
  );

  // Append the overflow branch: values above the last breakpoint cap at AQI 500
  switchBranches.push({
    case: { $gt: ["$$c", PM25_OVERFLOW_THRESHOLD] },
    then: PM25_MAX_AQI,
  });

  // Guard: return null if value is missing, non-numeric, or negative
  return {
    $cond: {
      if: {
        $and: [
          { $ne: [fieldPath, null] },
          { $isNumber: fieldPath },
          { $gte: [fieldPath, 0] },
        ],
      },
      then: {
        // Use $let to compute the truncated concentration once and reuse
        // across all branches: floor(C * 10) / 10
        $let: {
          vars: {
            c: {
              $divide: [{ $trunc: { $multiply: [fieldPath, 10] } }, 10],
            },
          },
          in: {
            $switch: {
              branches: switchBranches,
              default: null,
            },
          },
        },
      },
      else: null,
    },
  };
}

module.exports = {
  calculatePm25Aqi,
  getAqiIndexMongoExpression,
};
