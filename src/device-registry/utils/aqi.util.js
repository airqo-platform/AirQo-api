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
const constants = require("@config/constants");
const { PM25_AQI_BREAKPOINTS } = constants;
const SystemConfigModel = require("@models/SystemConfig");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- aqi-util`);

const AQI_RANGES_CONFIG_KEY = "aqi_ranges";
const AQI_RANGES_CACHE_TTL_MS = 60 * 1000; // rare writes, but staleness is user-visible in a public legend

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

/**
 * Map a PM2.5 concentration (e.g. an averaged value across many sites) to its
 * AQI category key using the canonical AQI_RANGES breakpoints. Distinct from
 * the per-reading aqi_category persisted on Reading documents, which is only
 * ever computed for a single reading's own pm2_5 value.
 *
 * @param {number|null|undefined} concentration - PM2.5 concentration in µg/m³
 * @param {{AQI_RANGES: object, AQI_CATEGORY_KEYS: string[]}|null} [resolved] -
 *   optional resolved config (see resolveActiveAqiRanges) to classify against
 *   instead of the hardcoded defaults. Omit to use constants.AQI_RANGES, same
 *   as before this parameter existed — fully backward compatible.
 * @returns {string|null} one of AQI_CATEGORY_KEYS, or null if invalid
 */
function categoryFromConcentration(concentration, resolved = null) {
  if (
    concentration === null ||
    concentration === undefined ||
    typeof concentration !== "number" ||
    isNaN(concentration) ||
    concentration < 0
  ) {
    return null;
  }

  const { AQI_RANGES, AQI_CATEGORY_KEYS } = resolved || constants;

  // AQI_RANGES boundaries leave thousandths-place gaps between adjacent
  // categories (e.g. good max 9.1, moderate min 9.101) — fine for single
  // readings, which are rarely that precise, but averaged values (as used
  // here) can land in the gap. Classify by upper bound only, in ascending
  // order, so every non-negative value matches exactly one category.
  for (const categoryKey of AQI_CATEGORY_KEYS) {
    const { max } = AQI_RANGES[categoryKey];
    if (max === null || concentration <= max) {
      return categoryKey;
    }
  }

  return null;
}

/**
 * Assemble the canonical AQI category ranges (bands, labels, colors) for
 * dynamic frontend rendering — replaces hard-coded AQI legends.
 *
 * @param {{AQI_RANGES, AQI_CATEGORIES, AQI_COLORS, AQI_COLOR_NAMES, AQI_CATEGORY_KEYS, source}|null} [resolved] -
 *   optional resolved config (see resolveActiveAqiRanges). Omit to use the
 *   hardcoded defaults, same as before this parameter existed.
 * @returns {{success: boolean, message: string, data: {standard: string, source: string, ranges: Array}}}
 */
function listRanges(resolved = null) {
  const {
    AQI_RANGES,
    AQI_CATEGORIES,
    AQI_COLORS,
    AQI_COLOR_NAMES,
    AQI_CATEGORY_KEYS,
  } = resolved || constants;
  const source = resolved ? resolved.source : "default";

  const ranges = AQI_CATEGORY_KEYS.map((key, index) => ({
    key,
    label: AQI_CATEGORIES[key],
    min_value: AQI_RANGES[key].min,
    max_value: AQI_RANGES[key].max,
    // AQI_COLORS stores hex without a leading # internally — a resolved
    // custom config's colors are already normalized to that same bare-hex
    // form by resolveActiveAqiRanges, so this prefix is always applied
    // exactly once regardless of source.
    color: `#${AQI_COLORS[key]}`,
    color_name: AQI_COLOR_NAMES[key],
    display_order: index + 1,
  }));

  return {
    success: true,
    message: "Successfully retrieved AQI ranges",
    data: {
      standard: "US EPA PM2.5 AQI (2024 NAAQS revision)",
      source,
      ranges,
    },
  };
}

/**
 * Validate that a stored/candidate AQI ranges value has the exact shape
 * categoryFromConcentration/listRanges require: all AQI_CATEGORY_KEYS present
 * in order, max_value strictly increasing with the last one null, colors
 * valid 6-hex-digit codes. Used both to defensively re-check a doc that may
 * have been hand-edited outside the API, and to validate a PUT body.
 *
 * @returns {boolean}
 */
function isValidAqiRangesShape(value) {
  if (!value || typeof value !== "object") return false;
  const { AQI_CATEGORY_KEYS } = constants;
  const ranges = value.ranges;
  if (!Array.isArray(ranges) || ranges.length !== AQI_CATEGORY_KEYS.length) {
    return false;
  }

  let prevMax = -Infinity;
  for (let i = 0; i < AQI_CATEGORY_KEYS.length; i += 1) {
    const range = ranges[i];
    const isLast = i === AQI_CATEGORY_KEYS.length - 1;
    if (!range || range.key !== AQI_CATEGORY_KEYS[i]) return false;
    if (typeof range.label !== "string" || !range.label.trim()) return false;
    if (!/^[0-9A-Fa-f]{6}$/.test(range.color || "")) return false;

    if (isLast) {
      if (range.max_value !== null) return false;
    } else {
      if (typeof range.max_value !== "number" || !(range.max_value > prevMax)) {
        return false;
      }
      prevMax = range.max_value;
    }
  }
  return true;
}

/**
 * Build a resolved-config object (same shape categoryFromConcentration and
 * listRanges expect) from a validated stored `{ranges: [...]}` value. Always
 * constructs fresh objects — never mutates constants.AQI_RANGES, which is a
 * plain object shared by reference across the whole process, including
 * reading-ingestion classification (models/Event.js's generateAqiAddFields)
 * and health-tip validation that intentionally still use the hardcoded
 * defaults regardless of any admin override (see docs for why).
 */
function buildResolvedFromCustom(value) {
  const AQI_RANGES = {};
  const AQI_CATEGORIES = {};
  const AQI_COLORS = {};
  const AQI_COLOR_NAMES = {};
  const AQI_CATEGORY_KEYS = [];

  value.ranges.forEach((range) => {
    AQI_CATEGORY_KEYS.push(range.key);
    AQI_RANGES[range.key] = {
      min: range.min_value,
      max: range.max_value,
    };
    AQI_CATEGORIES[range.key] = range.label;
    AQI_COLORS[range.key] = range.color;
    AQI_COLOR_NAMES[range.key] =
      range.color_name || constants.AQI_COLOR_NAMES[range.key] || null;
  });

  return {
    AQI_RANGES,
    AQI_CATEGORIES,
    AQI_COLORS,
    AQI_COLOR_NAMES,
    AQI_CATEGORY_KEYS,
    source: "custom",
  };
}

// Pod-local in-memory cache — see docs/NEXUS_AIR_QUALITY_API_GUIDE.md and the
// PR description for the accepted staleness tradeoff (up to
// AQI_RANGES_CACHE_TTL_MS across other replicas after a write).
const _aqiRangesCache = new Map(); // tenant -> { value, expiresAt }

/**
 * Resolve the currently-active AQI ranges config for a tenant: a cached or
 * freshly-queried admin-set override if one exists and is valid, otherwise
 * the hardcoded defaults. Call once per request/job-run and pass the result
 * into categoryFromConcentration/listRanges — those stay synchronous.
 */
async function resolveActiveAqiRanges(tenant = "airqo") {
  const cached = _aqiRangesCache.get(tenant);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  let resolved = { ...constants, source: "default" };
  try {
    const doc = await SystemConfigModel(tenant)
      .findOne({ key: AQI_RANGES_CONFIG_KEY })
      .lean();
    if (doc) {
      if (isValidAqiRangesShape(doc.value)) {
        resolved = buildResolvedFromCustom(doc.value);
      } else {
        logger.error(
          `🐛🐛 malformed ${AQI_RANGES_CONFIG_KEY} SystemConfig doc for tenant ${tenant} — falling back to defaults`
        );
      }
    }
  } catch (error) {
    logger.error(
      `🐛🐛 resolveActiveAqiRanges -- ${error.message} -- falling back to defaults`
    );
  }

  _aqiRangesCache.set(tenant, {
    value: resolved,
    expiresAt: Date.now() + AQI_RANGES_CACHE_TTL_MS,
  });
  return resolved;
}

/**
 * Invalidate the cached resolved config for a tenant — call after a
 * successful PUT/DELETE write so the writing pod reflects the change
 * immediately rather than waiting out the TTL.
 */
function invalidateAqiRangesCache(tenant = "airqo") {
  _aqiRangesCache.delete(tenant);
}

module.exports = {
  calculatePm25Aqi,
  getAqiIndexMongoExpression,
  categoryFromConcentration,
  listRanges,
  isValidAqiRangesShape,
  resolveActiveAqiRanges,
  invalidateAqiRangesCache,
  AQI_RANGES_CONFIG_KEY,
};
