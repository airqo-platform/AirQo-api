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
 */

/**
 * PM2.5 24-hour AQI breakpoints (2024 EPA revision).
 * Each entry maps a concentration range [cLow, cHigh] to an AQI range [aqiLow, aqiHigh].
 */
const PM25_AQI_BREAKPOINTS = [
  { cLow: 0.0, cHigh: 9.0, aqiLow: 0, aqiHigh: 50 }, // Good
  { cLow: 9.1, cHigh: 35.4, aqiLow: 51, aqiHigh: 100 }, // Moderate
  { cLow: 35.5, cHigh: 55.4, aqiLow: 101, aqiHigh: 150 }, // Unhealthy for Sensitive Groups
  { cLow: 55.5, cHigh: 125.4, aqiLow: 151, aqiHigh: 200 }, // Unhealthy
  { cLow: 125.5, cHigh: 225.4, aqiLow: 201, aqiHigh: 300 }, // Very Unhealthy
  { cLow: 225.5, cHigh: 325.4, aqiLow: 301, aqiHigh: 500 }, // Hazardous
];

const PM25_MAX_AQI = 500;
const PM25_OVERFLOW_THRESHOLD = 325.4; // concentrations above this are capped at AQI 500

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
 *
 * @param {string} [fieldPath="$pm2_5.value"] - MongoDB field reference for PM2.5 concentration
 * @returns {Object} MongoDB expression object (suitable for use in $addFields)
 */
function getAqiIndexMongoExpression(fieldPath = "$pm2_5.value") {
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
        // Use $let to compute the truncated concentration once and reuse across all branches
        $let: {
          vars: {
            // Truncate to 1 decimal place: floor(c * 10) / 10
            c: {
              $divide: [{ $trunc: { $multiply: [fieldPath, 10] } }, 10],
            },
          },
          in: {
            $switch: {
              branches: [
                // Good: 0.0 – 9.0 → AQI 0–50
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 0.0] },
                      { $lte: ["$$c", 9.0] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          0,
                          {
                            $multiply: [
                              { $divide: [50, 9.0] },
                              { $subtract: ["$$c", 0.0] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Moderate: 9.1 – 35.4 → AQI 51–100
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 9.1] },
                      { $lte: ["$$c", 35.4] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          51,
                          {
                            $multiply: [
                              { $divide: [49, 26.3] }, // (100-51)/(35.4-9.1)
                              { $subtract: ["$$c", 9.1] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Unhealthy for Sensitive Groups: 35.5 – 55.4 → AQI 101–150
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 35.5] },
                      { $lte: ["$$c", 55.4] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          101,
                          {
                            $multiply: [
                              { $divide: [49, 19.9] }, // (150-101)/(55.4-35.5)
                              { $subtract: ["$$c", 35.5] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Unhealthy: 55.5 – 125.4 → AQI 151–200
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 55.5] },
                      { $lte: ["$$c", 125.4] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          151,
                          {
                            $multiply: [
                              { $divide: [49, 69.9] }, // (200-151)/(125.4-55.5)
                              { $subtract: ["$$c", 55.5] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Very Unhealthy: 125.5 – 225.4 → AQI 201–300
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 125.5] },
                      { $lte: ["$$c", 225.4] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          201,
                          {
                            $multiply: [
                              { $divide: [99, 99.9] }, // (300-201)/(225.4-125.5)
                              { $subtract: ["$$c", 125.5] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Hazardous: 225.5 – 325.4 → AQI 301–500
                {
                  case: {
                    $and: [
                      { $gte: ["$$c", 225.5] },
                      { $lte: ["$$c", 325.4] },
                    ],
                  },
                  then: {
                    $round: [
                      {
                        $add: [
                          301,
                          {
                            $multiply: [
                              { $divide: [199, 99.9] }, // (500-301)/(325.4-225.5)
                              { $subtract: ["$$c", 225.5] },
                            ],
                          },
                        ],
                      },
                      0,
                    ],
                  },
                },
                // Above 325.4: cap at 500
                {
                  case: { $gt: ["$$c", 325.4] },
                  then: PM25_MAX_AQI,
                },
              ],
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
  PM25_AQI_BREAKPOINTS,
  calculatePm25Aqi,
  getAqiIndexMongoExpression,
};
