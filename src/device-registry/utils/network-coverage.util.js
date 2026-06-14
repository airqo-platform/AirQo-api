// network-coverage.util.js
// Business logic for the Network Coverage API.
//
// Data sources (unioned at query time — no sync job needed):
//
//   1. AirQo pipeline sites
//      Fetched from SiteModel, filtered to sites that have at least one
//      Device with isActive:true (i.e. a deployed monitor, regardless of
//      manufacturer). Optionally enriched with extra metadata from a
//      NetworkCoverageRegistry entry keyed by site_id.
//
//   2. Standalone external entries
//      NetworkCoverageRegistry records where site_id is null/absent.
//      Added by open data contributors; all fields live in the registry doc.

const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const NetworkCoverageRegistryModel = require("@models/NetworkCoverageRegistry");
const GridModel = require("@models/Grid");
const SdgCityModel = require("@models/SdgCity");
const CityPopulationRegistryModel = require("@models/CityPopulationRegistry");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-coverage-util`
);

// ---------------------------------------------------------------------------
// Country name → ISO 3166-1 alpha-2 lookup (Africa-focused + common global)
// ---------------------------------------------------------------------------
const COUNTRY_ISO2 = {
  Afghanistan: "AF",
  Albania: "AL",
  Algeria: "DZ",
  Angola: "AO",
  Argentina: "AR",
  Australia: "AU",
  Austria: "AT",
  Bangladesh: "BD",
  Belgium: "BE",
  Benin: "BJ",
  Bolivia: "BO",
  Botswana: "BW",
  Brazil: "BR",
  "Burkina Faso": "BF",
  Burundi: "BI",
  "Cabo Verde": "CV",
  "Cape Verde": "CV",
  Cameroon: "CM",
  Canada: "CA",
  "Central African Republic": "CF",
  Chad: "TD",
  Chile: "CL",
  China: "CN",
  Colombia: "CO",
  Comoros: "KM",
  Congo: "CG",
  "Democratic Republic of the Congo": "CD",
  "DR Congo": "CD",
  "Republic of the Congo": "CG",
  "Costa Rica": "CR",
  "Côte d'Ivoire": "CI",
  "Ivory Coast": "CI",
  Croatia: "HR",
  Cuba: "CU",
  Czechia: "CZ",
  "Czech Republic": "CZ",
  Denmark: "DK",
  Djibouti: "DJ",
  Ecuador: "EC",
  Egypt: "EG",
  "El Salvador": "SV",
  "Equatorial Guinea": "GQ",
  Eritrea: "ER",
  Estonia: "EE",
  Eswatini: "SZ",
  Swaziland: "SZ",
  Ethiopia: "ET",
  Finland: "FI",
  France: "FR",
  Gabon: "GA",
  Gambia: "GM",
  Germany: "DE",
  Ghana: "GH",
  Greece: "GR",
  Guatemala: "GT",
  Guinea: "GN",
  "Guinea-Bissau": "GW",
  Honduras: "HN",
  Hungary: "HU",
  India: "IN",
  Indonesia: "ID",
  Iran: "IR",
  Iraq: "IQ",
  Ireland: "IE",
  Israel: "IL",
  Italy: "IT",
  Jamaica: "JM",
  Japan: "JP",
  Jordan: "JO",
  Kazakhstan: "KZ",
  Kenya: "KE",
  Kuwait: "KW",
  Laos: "LA",
  Lebanon: "LB",
  Lesotho: "LS",
  Liberia: "LR",
  Libya: "LY",
  Madagascar: "MG",
  Malawi: "MW",
  Malaysia: "MY",
  Mali: "ML",
  Mauritania: "MR",
  Mauritius: "MU",
  Mexico: "MX",
  Morocco: "MA",
  Mozambique: "MZ",
  Myanmar: "MM",
  Namibia: "NA",
  Nepal: "NP",
  Netherlands: "NL",
  "New Zealand": "NZ",
  Nicaragua: "NI",
  Niger: "NE",
  Nigeria: "NG",
  "North Korea": "KP",
  Norway: "NO",
  Oman: "OM",
  Pakistan: "PK",
  Panama: "PA",
  Paraguay: "PY",
  Peru: "PE",
  Philippines: "PH",
  Poland: "PL",
  Portugal: "PT",
  "Puerto Rico": "PR",
  Qatar: "QA",
  Romania: "RO",
  Russia: "RU",
  Rwanda: "RW",
  "Saudi Arabia": "SA",
  Senegal: "SN",
  "Sierra Leone": "SL",
  Somalia: "SO",
  "South Africa": "ZA",
  "South Korea": "KR",
  "South Sudan": "SS",
  Spain: "ES",
  "Sri Lanka": "LK",
  Sudan: "SD",
  Sweden: "SE",
  Switzerland: "CH",
  Syria: "SY",
  Tanzania: "TZ",
  Thailand: "TH",
  Togo: "TG",
  Tunisia: "TN",
  Turkey: "TR",
  Türkiye: "TR",
  Uganda: "UG",
  Ukraine: "UA",
  "United Arab Emirates": "AE",
  UAE: "AE",
  "United Kingdom": "GB",
  UK: "GB",
  "United States": "US",
  USA: "US",
  Uruguay: "UY",
  Uzbekistan: "UZ",
  Venezuela: "VE",
  Vietnam: "VN",
  Yemen: "YE",
  Zambia: "ZM",
  Zimbabwe: "ZW",
};

// ---------------------------------------------------------------------------
// Device category → network coverage type mapping
//
// DeviceModel.category is the canonical source of truth for what kind of
// equipment an AirQo pipeline monitor is. This map translates device categories
// to NetworkCoverageRegistry type enum values used by the coverage map and CSV
// export. The full registry enum is ("Reference" | "LCS" | "Inactive"), but
// this mapping only produces "Reference" or "LCS" — AirQo pipeline monitors
// are always active by definition (filtered to isActive:true). Standalone
// external registry entries are authored directly in the registry and may still
// carry any enum value including "Inactive".
// bam (Beta Attenuation Monitor) = reference-grade → "Reference"
// lowcost / gas = low-cost sensor class → "LCS"
// ---------------------------------------------------------------------------
const DEVICE_CATEGORY_TO_TYPE = {
  bam: "Reference",
  lowcost: "LCS",
  gas: "LCS",
};

// Reusable $switch expression for MongoDB aggregation pipelines that need to
// sort or group devices by equipment grade. bam=2 > gas=1 > lowcost=0.
const CATEGORY_PRIORITY_SWITCH = {
  $switch: {
    branches: [
      { case: { $eq: ["$category", "bam"] }, then: 2 },
      { case: { $eq: ["$category", "gas"] }, then: 1 },
    ],
    default: 0,
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getIso2(countryName) {
  if (!countryName) return "";
  return COUNTRY_ISO2[countryName] || COUNTRY_ISO2[countryName.trim()] || "";
}

function slugify(str) {
  if (!str) return "";
  return str
    .normalize("NFD")               // decompose accented chars (e.g. é → e + ́)
    .replace(/[\u0300-\u036f]/g, "") // strip combining diacritic marks
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * Builds a Map<String(site_id) → registryDoc> from registry records that
 * have a site_id set (AirQo-site enrichment entries).
 */
function buildRegistryBySiteId(registryRecords) {
  const map = new Map();
  for (const rec of registryRecords) {
    if (rec.site_id) {
      map.set(String(rec.site_id), rec);
    }
  }
  return map;
}

/**
 * Maps an AirQo Site document + optional registry enrichment record to
 * a MonitorListItem. Base location/status fields come from the live Site doc;
 * extended metadata is layered from the registry entry when present.
 *
 * deviceCategory — the dominant category of active devices at this site
 * (bam | lowcost | gas). Used to derive `type` via DEVICE_CATEGORY_TO_TYPE
 * unless the registry entry carries an explicit, valid type override.
 *
 * Type precedence:
 *   1. reg.type — when set and a recognised MONITOR_TYPES value (curator override)
 *   2. DEVICE_CATEGORY_TO_TYPE[deviceCategory] — canonical device-category mapping
 *   3. "LCS" — safe default
 */
function buildAirQoMonitorItem(siteDoc, registryDoc, deviceCategory) {
  const reg = registryDoc || {};
  const country = siteDoc.country || "";

  // Registry type wins when explicitly set to a valid enum value — allows curators
  // to correct misclassifications without touching device metadata. Invalid or
  // blank registry values fall through to the canonical device category mapping.
  const validTypes = NetworkCoverageRegistryModel.MONITOR_TYPES;
  const type =
    (reg.type && validTypes.includes(reg.type) ? reg.type : null) ||
    DEVICE_CATEGORY_TO_TYPE[deviceCategory] ||
    "LCS";

  return {
    id: String(siteDoc._id),
    name: siteDoc.name || siteDoc.generated_name || "",
    city: siteDoc.city || siteDoc.town || siteDoc.district || "",
    country,
    iso2: reg.iso2 || getIso2(country),
    // Use approximate coordinates for privacy (within 0.5 km).
    // Null when both values are absent — avoids false (0,0) map points.
    latitude: siteDoc.approximate_latitude ?? siteDoc.latitude ?? null,
    longitude: siteDoc.approximate_longitude ?? siteDoc.longitude ?? null,
    type,
    // status driven by live Site.isOnline flag
    status: siteDoc.isOnline ? "active" : "inactive",
    lastActive: siteDoc.lastActive
      ? siteDoc.lastActive.toISOString()
      : siteDoc.updatedAt
      ? siteDoc.updatedAt.toISOString()
      : "",
    // Extended metadata from registry (empty strings when not yet filled in)
    network: reg.network || siteDoc.network || "",
    operator: reg.operator || siteDoc.data_provider || "",
    equipment: reg.equipment || "",
    manufacturer: reg.manufacturer || "",
    pollutants: Array.isArray(reg.pollutants) ? reg.pollutants : [],
    resolution: reg.resolution || "",
    transmission: reg.transmission || "",
    site: reg.site || siteDoc.location_name || siteDoc.description || "",
    landUse:
      reg.landUse ||
      (Array.isArray(siteDoc.land_use) ? siteDoc.land_use[0] : "") ||
      (siteDoc.site_category && siteDoc.site_category.landuse) ||
      "",
    deployed: reg.deployed || "",
    calibrationLastDate: reg.calibrationLastDate || "",
    calibrationMethod: reg.calibrationMethod || "",
    uptime30d: reg.uptime30d || "",
    publicData: reg.publicData || "No",
    organisation: reg.organisation || siteDoc.data_provider || "",
    coLocation: reg.coLocation || "Not available",
    coLocationNote: reg.coLocationNote || "",
    viewDataUrl: reg.viewDataUrl || "",
  };
}

/**
 * Maps a standalone NetworkCoverageRegistry document (no site_id) to a
 * MonitorListItem. All fields come directly from the registry entry — there
 * is no corresponding Site document. We trust the contributor's data.
 */
function buildStandaloneMonitorItem(registryDoc) {
  const country = registryDoc.country || "";
  return {
    id: String(registryDoc._id),
    name: registryDoc.name || "",
    city: registryDoc.city || "",
    country,
    iso2: registryDoc.iso2 || getIso2(country),
    latitude: registryDoc.latitude ?? null,
    longitude: registryDoc.longitude ?? null,
    type: registryDoc.type || "LCS",
    status: registryDoc.status || "active",
    lastActive: registryDoc.lastActive
      ? registryDoc.lastActive.toISOString()
      : "",
    network: registryDoc.network || "",
    operator: registryDoc.operator || "",
    equipment: registryDoc.equipment || "",
    manufacturer: registryDoc.manufacturer || "",
    pollutants: Array.isArray(registryDoc.pollutants)
      ? registryDoc.pollutants
      : [],
    resolution: registryDoc.resolution || "",
    transmission: registryDoc.transmission || "",
    site: registryDoc.site || "",
    landUse: registryDoc.landUse || "",
    deployed: registryDoc.deployed || "",
    calibrationLastDate: registryDoc.calibrationLastDate || "",
    calibrationMethod: registryDoc.calibrationMethod || "",
    uptime30d: registryDoc.uptime30d || "",
    publicData: registryDoc.publicData || "No",
    organisation: registryDoc.organisation || "",
    coLocation: registryDoc.coLocation || "Not available",
    coLocationNote: registryDoc.coLocationNote || "",
    viewDataUrl: registryDoc.viewDataUrl || "",
  };
}

/**
 * Computes the full impact stats suite for any flat list of monitors.
 * Used by the impact util for both the overall aggregate and each per-
 * manufacturer slice so every entry exposes identical metrics.
 *
 * populationByCity is a unified, composite-keyed Map built by fetchAllSources
 * from two sources (CityPopulationRegistry crowd data + SdgCity, in that
 * priority order). Cities absent from both sources return population: null.
 *
 * @param {object[]} monitors        - Flat MonitorListItem array
 * @param {Map}      populationByCity - From fetchAllSources; keys are either
 *                                      "city|country" (full lowercase name,
 *                                      CityPopulationRegistry) or "city|iso2"
 *                                      (lowercase ISO2, SdgCity). Lookups try
 *                                      both formats.
 */
function computeMonitorStats(monitors, populationByCity) {

  const byType = { Reference: 0, LCS: 0, Inactive: 0 };
  const byStatus = { active: 0, inactive: 0 };
  const byCountryMap = new Map();
  // Composite key = "city|country" to disambiguate same-named cities across
  // different countries (e.g. "Lagos, Nigeria" vs "Lagos, Portugal").
  const byCityMap = new Map();

  for (const monitor of monitors) {
    if (byType[monitor.type] !== undefined) byType[monitor.type]++;
    if (byStatus[monitor.status] !== undefined) byStatus[monitor.status]++;

    const countryKey = monitor.country || "Unknown";
    if (!byCountryMap.has(countryKey)) {
      byCountryMap.set(countryKey, {
        country: countryKey,
        iso2: monitor.iso2 || "",
        population: null,
        total: 0,
        Reference: 0,
        LCS: 0,
        Inactive: 0,
        active: 0,
        inactive: 0,
      });
    }
    const cs = byCountryMap.get(countryKey);
    cs.total++;
    if (cs[monitor.type] !== undefined) cs[monitor.type]++;
    if (cs[monitor.status] !== undefined) cs[monitor.status]++;

    if (monitor.city) {
      const cityKey = `${monitor.city.trim()}|${countryKey}`;
      if (!byCityMap.has(cityKey)) {
        const cityLower = monitor.city.trim().toLowerCase();
        const countryLower = (monitor.country || "").toLowerCase();
        const iso2Lower = (monitor.iso2 || "").toLowerCase();
        const cityPop =
          populationByCity.get(`${cityLower}|${countryLower}`) ??
          populationByCity.get(`${cityLower}|${iso2Lower}`) ??
          null;
        byCityMap.set(cityKey, {
          city: monitor.city.trim(),
          country: countryKey,
          iso2: monitor.iso2 || "",
          population: cityPop,
          total: 0,
          Reference: 0,
          LCS: 0,
          Inactive: 0,
          active: 0,
          inactive: 0,
        });
      }
      const cty = byCityMap.get(cityKey);
      cty.total++;
      if (cty[monitor.type] !== undefined) cty[monitor.type]++;
      if (cty[monitor.status] !== undefined) cty[monitor.status]++;
    }
  }

  // Roll up city populations to their parent country entries.
  for (const cityEntry of byCityMap.values()) {
    if (cityEntry.population !== null) {
      const ce = byCountryMap.get(cityEntry.country);
      if (ce) ce.population = (ce.population ?? 0) + cityEntry.population;
    }
  }

  // Sum city populations for the total. null means no population data yet
  // from either source — never substitute estimates or default to 0.
  let totalPopulationReached = null;
  let citiesWithPopulationData = 0;
  for (const cityEntry of byCityMap.values()) {
    if (cityEntry.population !== null) {
      totalPopulationReached = (totalPopulationReached ?? 0) +
        cityEntry.population;
      citiesWithPopulationData++;
    }
  }

  return {
    byType,
    byStatus,
    totalCities: byCityMap.size,
    totalCountries: byCountryMap.size,
    totalPopulationReached,
    citiesWithPopulationData,
    byCountry: Array.from(byCountryMap.values()).sort((a, b) =>
      a.country.localeCompare(b.country)
    ),
    byCity: Array.from(byCityMap.values()).sort((a, b) => {
      const cc = a.country.localeCompare(b.country);
      return cc !== 0 ? cc : a.city.localeCompare(b.city);
    }),
  };
}

/**
 * Groups a flat list of MonitorListItems by country → CountryCoverage[].
 * Sorted alphabetically by country name.
 */
function groupByCountry(monitors) {
  const countryMap = new Map();
  for (const monitor of monitors) {
    const key = monitor.country || "Unknown";
    if (!countryMap.has(key)) {
      countryMap.set(key, {
        id: slugify(key),
        country: key,
        iso2: monitor.iso2,
        stats: {
          total: 0,
          Reference: 0,
          LCS: 0,
          Inactive: 0,
          active: 0,
          inactive: 0,
        },
        monitors: [],
      });
    }
    const entry = countryMap.get(key);
    entry.monitors.push(monitor);
    entry.stats.total++;
    if (entry.stats[monitor.type] !== undefined)
      entry.stats[monitor.type]++;
    if (entry.stats[monitor.status] !== undefined)
      entry.stats[monitor.status]++;
  }
  return Array.from(countryMap.values()).sort((a, b) =>
    a.country.localeCompare(b.country)
  );
}

/**
 * Applies search / activeOnly / types / network filters to a flat monitor list.
 */
function applyFilters(monitors, { search, activeOnly, types, network } = {}) {
  let result = monitors;

  if (activeOnly === true || activeOnly === "true") {
    result = result.filter((m) => m.status === "active");
  }

  if (types) {
    const allowedTypes = types
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (allowedTypes.length > 0) {
      result = result.filter((m) => allowedTypes.includes(m.type));
    }
  }

  if (network) {
    const allowedNetworks = network
      .split(",")
      .map((n) => n.trim().toLowerCase())
      .filter(Boolean);
    if (allowedNetworks.length > 0) {
      result = result.filter((m) =>
        allowedNetworks.includes((m.network || "").trim().toLowerCase())
      );
    }
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (m) =>
        m.country.toLowerCase().includes(q) ||
        m.city.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.network.toLowerCase().includes(q)
    );
  }

  return result;
}

// Only fetch Site fields we actually need
const SITE_PROJECTION = {
  _id: 1,
  name: 1,
  generated_name: 1,
  city: 1,
  town: 1,
  district: 1,
  country: 1,
  approximate_latitude: 1,
  approximate_longitude: 1,
  latitude: 1,
  longitude: 1,
  isOnline: 1,
  lastActive: 1,
  updatedAt: 1,
  network: 1,
  data_provider: 1,
  location_name: 1,
  description: 1,
  land_use: 1,
  site_category: 1,
  grids: 1,
};

// Minimal Grid projection — shape, centers, geoHash, shape_update_history are
// heavy spatial fields not needed for city aggregation.
const GRID_PROJECTION = { _id: 1, name: 1, long_name: 1, admin_level: 1 };

/**
 * Core data fetch used by list, getCountryMonitors, and exportCsv.
 *
 * Returns:
 *   airqoSites          — Site docs for all sites with at least one active device
 *   standaloneEntries   — standalone NetworkCoverageRegistry docs (no site_id)
 *   registryBySiteId    — Map<String(site_id), registryDoc> for enrichment
 *   categoryBySiteId    — Map<String(site_id), category> dominant device category
 *   cityGridsBySiteId   — Map<String(site_id), Grid[]> sub-country grids per site
 *                         (empty map when Grid lookup fails — non-fatal)
 *   sdgByGridId         — Map<String(grid_id), { population, name }> latest SDG
 *                         population per city grid. Empty when no SDG data exists
 *                         yet — callers must treat population as optional.
 */
async function fetchAllSources(tenant) {
  // 1. Aggregate active devices to get both the site_id list AND the dominant
  //    category per site in a single DB round-trip. Priority: bam > gas > lowcost.
  let siteDevices = [];
  try {
    siteDevices = await DeviceModel(tenant).aggregate([
      { $match: { isActive: true, site_id: { $ne: null } } },
      // Avoid a collection-wide $sort (memory-bound, may hit Mongo's 100 MB
      // sort limit on large fleets). Instead compute the max priority per site
      // with $group, then reverse-map the integer back to a category name.
      { $addFields: { _categoryPriority: CATEGORY_PRIORITY_SWITCH } },
      { $group: { _id: "$site_id", maxPriority: { $max: "$_categoryPriority" } } },
      {
        $project: {
          category: {
            $switch: {
              branches: [
                { case: { $eq: ["$maxPriority", 2] }, then: "bam" },
                { case: { $eq: ["$maxPriority", 1] }, then: "gas" },
              ],
              default: "lowcost",
            },
          },
        },
      },
    ]);
  } catch (err) {
    logger.error(`Failed to fetch active site categories: ${err.message}`);
    throw err;
  }

  // Build category lookup and extract site_id list from the aggregate result
  const categoryBySiteId = new Map(
    siteDevices.map(({ _id, category }) => [String(_id), category || "lowcost"])
  );
  const activeSiteIds = siteDevices.map(({ _id }) => _id);

  // 2. Fetch those Site documents (must have country for grouping)
  let airqoSites = [];
  if (activeSiteIds.length > 0) {
    try {
      airqoSites = await SiteModel(tenant)
        .find(
          { _id: { $in: activeSiteIds }, country: { $exists: true, $ne: "" } },
          SITE_PROJECTION
        )
        .lean();
    } catch (err) {
      logger.error(`Failed to fetch sites: ${err.message}`);
      throw err;
    }
  }

  // 3. Fetch only the registry records we actually need:
  //    a) enrichment docs keyed to the active sites (supplementary metadata only —
  //       type is now derived from DeviceModel.category, not the registry)
  //    b) standalone docs (no site_id — external monitors with no device record;
  //       type remains manual for these since there is no device to reference)
  let enrichmentDocs = [];
  let standaloneEntries = [];
  try {
    [enrichmentDocs, standaloneEntries] = await Promise.all([
      activeSiteIds.length > 0
        ? NetworkCoverageRegistryModel(tenant)
            .find({ site_id: { $in: activeSiteIds } })
            .lean()
        : Promise.resolve([]),
      NetworkCoverageRegistryModel(tenant)
        .find({ $or: [{ site_id: { $exists: false } }, { site_id: null }] })
        .lean(),
    ]);
  } catch (err) {
    // Non-fatal — log and continue with empty registry
    logger.warn(`Could not fetch registry records (non-fatal): ${err.message}`);
  }

  // 4. Build enrichment map
  const registryBySiteId = buildRegistryBySiteId(enrichmentDocs);

  // 5. Resolve sub-country grids for each active site so callers can derive
  //    city names and population without fetching heavy spatial Grid documents.
  //    Both the Grid lookup and the SdgCity join are non-fatal — callers receive
  //    empty maps and degrade gracefully when data is unavailable.
  const cityGridsBySiteId = new Map();
  const sdgByGridId = new Map();

  const allGridIds = [
    ...new Set(
      airqoSites.flatMap((s) => (s.grids || []).map((id) => id.toString()))
    ),
  ];

  if (allGridIds.length > 0) {
    try {
      // Only sub-country grids are relevant for city-level aggregation.
      const cityGridDocs = await GridModel(tenant)
        .find(
          { _id: { $in: allGridIds }, admin_level: { $ne: "country" } },
          GRID_PROJECTION
        )
        .lean();

      const gridById = new Map(
        cityGridDocs.map((g) => [g._id.toString(), g])
      );

      for (const site of airqoSites) {
        const siteGrids = (site.grids || [])
          .map((id) => gridById.get(id.toString()))
          .filter(Boolean);
        if (siteGrids.length > 0) {
          cityGridsBySiteId.set(site._id.toString(), siteGrids);
        }
      }

      // Population join via SdgCity — new use case, data may not exist yet.
      // Use aggregate to pick the most recent year when multiple rows exist
      // for the same grid (SDG data is versioned by year).
      const cityGridObjectIds = cityGridDocs.map((g) => g._id);
      if (cityGridObjectIds.length > 0) {
        try {
          const sdgDocs = await SdgCityModel(tenant).aggregate([
            { $match: { grid_id: { $in: cityGridObjectIds } } },
            { $sort: { year: -1 } },
            {
              $group: {
                _id: "$grid_id",
                population: { $first: "$population" },
                name: { $first: "$name" },
                country: { $first: "$country" },
              },
            },
          ]);
          for (const doc of sdgDocs) {
            sdgByGridId.set(doc._id.toString(), {
              population: doc.population,
              name: doc.name,
              country: doc.country,
            });
          }
        } catch (err) {
          logger.warn(
            `SDG population lookup skipped (non-fatal — data may not exist yet): ${err.message}`
          );
        }
      }
    } catch (err) {
      logger.warn(
        `Grid city lookup skipped (non-fatal): ${err.message}`
      );
    }
  }

  // 6. Build unified city population map (composite key → population).
  //    Key format: "city|country" (both lowercase) for CityPopulationRegistry
  //    entries (country is full name, e.g. "kampala|uganda") and "city|iso2"
  //    (lowercase ISO2) for SdgCity entries (e.g. "kampala|ug").
  //    Priority: CityPopulationRegistry as base; SdgCity overrides when both
  //    exist for the same city — SdgCity is the authoritative SDG source.
  //    Both fetches are non-fatal.
  const populationByCity = new Map();
  try {
    const cityPopDocs = await CityPopulationRegistryModel(tenant)
      .find({}, { city: 1, country: 1, population: 1 })
      .lean();
    for (const doc of cityPopDocs) {
      if (doc.city && doc.country && doc.population != null) {
        populationByCity.set(`${doc.city}|${doc.country}`, doc.population);
      }
    }
  } catch (err) {
    logger.warn(
      `City population registry lookup skipped (non-fatal): ${err.message}`
    );
  }
  for (const sdgEntry of sdgByGridId.values()) {
    if (sdgEntry.name && sdgEntry.population != null) {
      const cityLower = sdgEntry.name.trim().toLowerCase();
      const iso2Lower = (sdgEntry.country || "").toLowerCase();
      populationByCity.set(`${cityLower}|${iso2Lower}`, sdgEntry.population);
    }
  }

  return {
    airqoSites,
    standaloneEntries,
    registryBySiteId,
    categoryBySiteId,
    cityGridsBySiteId,
    sdgByGridId,
    populationByCity,
  };
}

// ---------------------------------------------------------------------------
// Exported utility functions
// ---------------------------------------------------------------------------

const networkCoverageUtil = {
  /**
   * GET /network-coverage
   * Returns all countries and their monitor points (union of AirQo pipeline
   * sites and standalone external registry entries).
   */
  list: async (request) => {
    try {
      const { tenant, search, activeOnly, types, network } = request.query;

      const {
        airqoSites,
        standaloneEntries,
        registryBySiteId,
        categoryBySiteId,
        populationByCity,
      } = await fetchAllSources(tenant);

      // Build monitor items from both sources
      const airqoMonitors = airqoSites.map((site) =>
        buildAirQoMonitorItem(
          site,
          registryBySiteId.get(String(site._id)),
          categoryBySiteId.get(String(site._id))
        )
      );
      const externalMonitors = standaloneEntries.map(buildStandaloneMonitorItem);

      const allMonitors = [...airqoMonitors, ...externalMonitors];

      // availableNetworks is derived before filtering so the source dropdown
      // always shows every network regardless of the active filter.
      const availableNetworks = [
        ...new Set(
          allMonitors
            .map((m) => (m.network || "").trim().toLowerCase())
            .filter(Boolean)
        ),
      ].sort();

      const filtered = applyFilters(allMonitors, {
        search,
        activeOnly,
        types,
        network,
      });

      const countries = groupByCountry(filtered);

      // ── Impact stats (computed from the filtered set) ──────────────────────
      const byType = { Reference: 0, LCS: 0, Inactive: 0 };
      const byStatus = { active: 0, inactive: 0 };
      // Track city+country pairs to avoid double-counting same-named cities
      // in different countries (e.g. "Lagos, Nigeria" vs "Lagos, Portugal").
      const cityPairsMap = new Map();

      for (const monitor of filtered) {
        if (byType[monitor.type] !== undefined) byType[monitor.type]++;
        if (byStatus[monitor.status] !== undefined) byStatus[monitor.status]++;
        if (monitor.city) {
          const cityKey = `${monitor.city.trim()}|${monitor.country || ""}`;
          if (!cityPairsMap.has(cityKey)) {
            cityPairsMap.set(cityKey, {
              city: monitor.city.trim(),
              country: monitor.country || "",
              iso2: monitor.iso2 || "",
            });
          }
        }
      }

      // Population: sum by city+country composite key from the unified
      // populationByCity map (CityPopulationRegistry + SdgCity merged in
      // fetchAllSources). null when no population data exists for any city.
      let totalPopulationReached = null;
      let citiesWithPopulationData = 0;
      if (populationByCity.size > 0) {
        let popSum = 0;
        for (const { city, country, iso2 } of cityPairsMap.values()) {
          const cityLower = city.toLowerCase();
          const countryLower = country.toLowerCase();
          const iso2Lower = iso2.toLowerCase();
          const pop =
            populationByCity.get(`${cityLower}|${countryLower}`) ??
            populationByCity.get(`${cityLower}|${iso2Lower}`) ??
            null;
          if (pop != null) {
            popSum += pop;
            citiesWithPopulationData++;
          }
        }
        if (citiesWithPopulationData > 0) totalPopulationReached = popSum;
      }

      return {
        success: true,
        message: "Network coverage data retrieved successfully",
        data: {
          countries,
          meta: {
            totalMonitors: filtered.length,
            byType,
            byStatus,
            totalCities: cityPairsMap.size,
            totalCountries: countries.length,
            monitoredCountries: countries.filter((c) => c.monitors.length > 0)
              .length,
            totalPopulationReached,
            citiesWithPopulationData,
            availableNetworks,
            generatedAt: new Date().toISOString(),
          },
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 networkCoverageUtil.list: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * GET /network-coverage/monitors/:monitorId
   * Returns a single monitor's full detail. The monitorId may be either a
   * Site _id (AirQo pipeline monitor) or a registry _id (standalone entry).
   */
  getMonitor: async (request) => {
    try {
      const { tenant } = request.query;
      const { monitorId } = request.params;

      // Try AirQo site first
      let site = null;
      try {
        site = await SiteModel(tenant)
          .findById(monitorId, SITE_PROJECTION)
          .lean();
      } catch (err) {
        // Invalid ObjectId or DB error — fall through to registry lookup
      }

      if (site) {
        // Fetch the dominant active device for this site to resolve category.
        // Priority: bam (2) > gas (1) > lowcost (0) — consistent with the
        // bulk fetchAllSources aggregate so a single monitor detail view
        // matches what the list endpoints return.
        const [primaryDevice] = await DeviceModel(tenant).aggregate([
          { $match: { site_id: site._id, isActive: true } },
          { $addFields: { _categoryPriority: CATEGORY_PRIORITY_SWITCH } },
          { $sort: { _categoryPriority: -1 } },
          { $limit: 1 },
          { $project: { category: 1 } },
        ]);

        if (!primaryDevice) {
          return {
            success: false,
            message: "Monitor not found",
            errors: {
              message: `No active deployed monitor with id ${monitorId}`,
            },
            status: httpStatus.NOT_FOUND,
          };
        }

        let registryDoc = null;
        try {
          registryDoc = await NetworkCoverageRegistryModel(tenant)
            .findOne({ site_id: site._id })
            .lean();
        } catch (err) {
          logger.warn(
            `Could not fetch registry enrichment for ${monitorId} (non-fatal): ${err.message}`
          );
        }

        return {
          success: true,
          message: "Monitor retrieved successfully",
          data: buildAirQoMonitorItem(site, registryDoc, primaryDevice.category),
          status: httpStatus.OK,
        };
      }

      // Try standalone registry entry
      let registryDoc = null;
      try {
        registryDoc = await NetworkCoverageRegistryModel(tenant)
          .findById(monitorId)
          .lean();
      } catch (err) {
        // fall through
      }

      if (registryDoc && !registryDoc.site_id) {
        return {
          success: true,
          message: "Monitor retrieved successfully",
          data: buildStandaloneMonitorItem(registryDoc),
          status: httpStatus.OK,
        };
      }

      return {
        success: false,
        message: "Monitor not found",
        errors: { message: `No monitor with id ${monitorId}` },
        status: httpStatus.NOT_FOUND,
      };
    } catch (error) {
      logger.error(`🐛🐛 networkCoverageUtil.getMonitor: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * GET /network-coverage/countries/:countryId/monitors
   * Returns all monitors for a specific country (slug-based lookup).
   */
  getCountryMonitors: async (request) => {
    try {
      const { tenant, activeOnly, types, network } = request.query;
      const { countryId } = request.params;

      const { airqoSites, standaloneEntries, registryBySiteId, categoryBySiteId } =
        await fetchAllSources(tenant);

      const airqoMonitors = airqoSites
        .filter((s) => slugify(s.country) === countryId)
        .map((site) =>
          buildAirQoMonitorItem(
            site,
            registryBySiteId.get(String(site._id)),
            categoryBySiteId.get(String(site._id))
          )
        );

      const externalMonitors = standaloneEntries
        .filter((r) => slugify(r.country) === countryId)
        .map(buildStandaloneMonitorItem);

      const allMonitors = applyFilters(
        [...airqoMonitors, ...externalMonitors],
        { activeOnly, types, network }
      );

      if (allMonitors.length === 0) {
        return {
          success: false,
          message: "Country not found or has no monitors",
          errors: {
            message: `No monitors found for country id: ${countryId}`,
          },
          status: httpStatus.NOT_FOUND,
        };
      }

      const countryName =
        airqoMonitors[0]?.country || externalMonitors[0]?.country || "";

      return {
        success: true,
        message: "Country monitors retrieved successfully",
        data: {
          countryId,
          country: countryName,
          iso2: getIso2(countryName),
          monitors: allMonitors,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.getCountryMonitors: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * GET /network-coverage/export.csv
   */
  exportCsv: async (request) => {
    try {
      const { tenant, search, activeOnly, types, network, countryId } =
        request.query;

      const { airqoSites, standaloneEntries, registryBySiteId, categoryBySiteId } =
        await fetchAllSources(tenant);

      const airqoMonitors = airqoSites.map((site) =>
        buildAirQoMonitorItem(
          site,
          registryBySiteId.get(String(site._id)),
          categoryBySiteId.get(String(site._id))
        )
      );
      const externalMonitors = standaloneEntries.map(buildStandaloneMonitorItem);

      let monitors = applyFilters([...airqoMonitors, ...externalMonitors], {
        search,
        activeOnly,
        types,
        network,
      });

      if (countryId) {
        monitors = monitors.filter(
          (m) => slugify(m.country) === countryId
        );
      }

      // Sanitize a value for CSV:
      // 1. Neutralize spreadsheet formula injection — prefix the dangerous
      //    operator with a single-quote, preserving any leading whitespace so
      //    the output column alignment is not disturbed.
      // 2. Escape internal double-quotes.
      // 3. Wrap in double-quotes.
      const escape = (v) => {
        let s = String(v == null ? "" : v);
        s = s.replace(/^(\s*)([=+\-@|%])/, "$1'$2");
        return `"${s.replace(/"/g, '""')}"`;
      };

      const header =
        "Country,City,Monitor Name,Type,Status,Latitude,Longitude,Last Active";

      const rows = monitors.map((m) =>
        [
          escape(m.country),
          escape(m.city),
          escape(m.name),
          escape(m.type),
          escape(m.status),
          m.latitude,
          m.longitude,
          escape(m.lastActive),
        ].join(",")
      );

      // Prepend UTF-8 BOM so Excel opens non-ASCII characters correctly
      const bom = "\uFEFF";

      return {
        success: true,
        message: "CSV export ready",
        data: bom + [header, ...rows].join("\n"),
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 networkCoverageUtil.exportCsv: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * POST /network-coverage/registry
   * Create or update extended metadata for a monitor.
   *
   * Two paths:
   *   - body.site_id present → upsert enrichment entry for that AirQo site
   *   - body.site_id absent  → create a standalone external monitor entry
   */
  upsertRegistry: async (request) => {
    try {
      const { tenant } = request.query;
      const data = request.body;

      // When linking to an AirQo site, verify the Site document exists first,
      // then check for active devices. Enrichment is allowed even when no
      // device is currently active (useful for temporarily offline sites).
      if (data.site_id) {
        const siteExists = await SiteModel(tenant).exists({
          _id: data.site_id,
        });

        if (!siteExists) {
          return {
            success: false,
            message: "Site not found",
            errors: { message: `No site with id ${data.site_id}` },
            status: httpStatus.NOT_FOUND,
          };
        }

        const hasActive = await DeviceModel(tenant).exists({
          site_id: data.site_id,
          isActive: true,
        });

        if (!hasActive) {
          logger.warn(
            `Registry enrichment for site ${data.site_id} — no active device currently attached`
          );
        }
      }

      const result = await NetworkCoverageRegistryModel(tenant).register(data);
      return result;
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.upsertRegistry: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * GET /network-coverage/cities
   * List crowd-sourced city population records, optionally filtered by
   * country (lowercase match).
   */
  listCities: async (request) => {
    try {
      const { tenant, country } = request.query;
      const filter = country
        ? { country: country.trim().toLowerCase() }
        : {};
      const result = await CityPopulationRegistryModel(tenant).list(filter);
      return result;
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.listCities: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * POST /network-coverage/cities
   * Submit or update a city population record.
   * Always an upsert — one record per city-country pair.
   */
  upsertCity: async (request) => {
    try {
      const { tenant } = request.query;
      const result = await CityPopulationRegistryModel(tenant).register(
        request.body
      );
      return result;
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.upsertCity: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * DELETE /network-coverage/cities/:cityId
   * Remove a city population record by its _id.
   */
  deleteCity: async (request) => {
    try {
      const { tenant } = request.query;
      const { cityId } = request.params;
      const result = await CityPopulationRegistryModel(tenant).removeById(
        cityId
      );
      return result;
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.deleteCity: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * DELETE /network-coverage/registry/:registryId
   * Remove a registry entry by its own _id.
   */
  deleteRegistry: async (request) => {
    try {
      const { tenant } = request.query;
      const { registryId } = request.params;

      const result = await NetworkCoverageRegistryModel(tenant).removeById(
        registryId
      );
      return result;
    } catch (error) {
      logger.error(
        `🐛🐛 networkCoverageUtil.deleteRegistry: ${error.message}`
      );
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },

  /**
   * GET /network-coverage/impact
   * Returns aggregate impact metrics only — no countries / monitors payload.
   * Intended for grant reporting, dashboards, and partner communications that
   * need headline numbers without downloading the full monitor list.
   *
   * Accepts the same query filters as /network-coverage (network, activeOnly,
   * types, search) so stats always reflect the active filter.
   *
   * Response shape:
   *   top-level fields  — overall stats for the filtered set
   *   byCountry[]             — per-country breakdown (total, type, status)
   *   bySensorManufacturer[]  — per-manufacturer breakdown with the full stats
   *                             suite (byType, byStatus, totalCities,
   *                             totalCountries, totalPopulationReached,
   *                             citiesWithPopulationData, byCountry, byCity)
   *                             so any manufacturer slice exposes identical
   *                             metrics to the overall view.
   *
   * totalPopulationReached is null (not 0) when no population data exists
   * for any monitored city.
   */
  impact: async (request) => {
    try {
      const { tenant, search, activeOnly, types, network } = request.query;

      const {
        airqoSites,
        standaloneEntries,
        registryBySiteId,
        categoryBySiteId,
        populationByCity,
      } = await fetchAllSources(tenant);

      const airqoMonitors = airqoSites.map((site) =>
        buildAirQoMonitorItem(
          site,
          registryBySiteId.get(String(site._id)),
          categoryBySiteId.get(String(site._id))
        )
      );
      const externalMonitors = standaloneEntries.map(
        buildStandaloneMonitorItem
      );
      const allMonitors = [...airqoMonitors, ...externalMonitors];

      const filtered = applyFilters(allMonitors, {
        search,
        activeOnly,
        types,
        network,
      });

      // Overall aggregate stats
      const topLevel = computeMonitorStats(filtered, populationByCity);

      // Per-manufacturer breakdown — group monitors by network slug (which
      // maps to sensor manufacturer / data source), then run the full stats
      // suite on each bucket so every manufacturer slice exposes identical
      // metrics to the overall view.
      const manufacturerBuckets = new Map();
      for (const monitor of filtered) {
        const key =
          (monitor.network || "").trim().toLowerCase() || "unknown";
        if (!manufacturerBuckets.has(key))
          manufacturerBuckets.set(key, []);
        manufacturerBuckets.get(key).push(monitor);
      }

      const bySensorManufacturer = Array.from(
        manufacturerBuckets.entries()
      )
        .map(([manufacturer, mfgMonitors]) => ({
          sensorManufacturer: manufacturer,
          totalMonitors: mfgMonitors.length,
          ...computeMonitorStats(mfgMonitors, populationByCity),
        }))
        .sort((a, b) =>
          a.sensorManufacturer.localeCompare(b.sensorManufacturer)
        );

      return {
        success: true,
        message: "Impact summary retrieved successfully",
        data: {
          totalMonitors: filtered.length,
          ...topLevel,
          bySensorManufacturer,
          generatedAt: new Date().toISOString(),
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 networkCoverageUtil.impact: ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = networkCoverageUtil;
