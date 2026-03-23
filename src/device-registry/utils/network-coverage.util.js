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
 */
function buildAirQoMonitorItem(siteDoc, registryDoc) {
  const reg = registryDoc || {};
  const country = siteDoc.country || "";

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
    // type comes from registry; default LCS (most AirQo sensors are low-cost)
    type: reg.type || "LCS",
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
    latitude: registryDoc.latitude || 0,
    longitude: registryDoc.longitude || 0,
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
        monitors: [],
      });
    }
    countryMap.get(key).monitors.push(monitor);
  }
  return Array.from(countryMap.values()).sort((a, b) =>
    a.country.localeCompare(b.country)
  );
}

/**
 * Applies search / activeOnly / types filters to a flat monitor list.
 */
function applyFilters(monitors, { search, activeOnly, types } = {}) {
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
};

/**
 * Core data fetch used by list, getCountryMonitors, and exportCsv.
 *
 * Returns { airqoSites, standaloneEntries, registryBySiteId } so callers
 * can build monitor items in whatever way they need.
 */
async function fetchAllSources(tenant) {
  // 1. Determine which sites have at least one deployed (isActive) device
  let activeSiteIds = [];
  try {
    activeSiteIds = await DeviceModel(tenant).distinct("site_id", {
      isActive: true,
      site_id: { $ne: null },
    });
  } catch (err) {
    logger.error(`Failed to fetch active site IDs: ${err.message}`);
    throw err;
  }

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
  //    a) enrichment docs keyed to the active sites
  //    b) standalone docs (no site_id at all, or site_id explicitly null for
  //       legacy records created before the default:null was removed)
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

  return { airqoSites, standaloneEntries, registryBySiteId };
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
      const { tenant, search, activeOnly, types } = request.query;

      const { airqoSites, standaloneEntries, registryBySiteId } =
        await fetchAllSources(tenant);

      // Build monitor items from both sources
      const airqoMonitors = airqoSites.map((site) =>
        buildAirQoMonitorItem(site, registryBySiteId.get(String(site._id)))
      );
      const externalMonitors = standaloneEntries.map(buildStandaloneMonitorItem);

      const filtered = applyFilters([...airqoMonitors, ...externalMonitors], {
        search,
        activeOnly,
        types,
      });

      const countries = groupByCountry(filtered);

      return {
        success: true,
        message: "Network coverage data retrieved successfully",
        data: {
          countries,
          meta: {
            totalCountries: countries.length,
            monitoredCountries: countries.filter((c) => c.monitors.length > 0)
              .length,
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
        // Verify it has an active device attached
        const hasActive = await DeviceModel(tenant).exists({
          site_id: site._id,
          isActive: true,
        });

        if (!hasActive) {
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
          data: buildAirQoMonitorItem(site, registryDoc),
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
      const { tenant, activeOnly, types } = request.query;
      const { countryId } = request.params;

      const { airqoSites, standaloneEntries, registryBySiteId } =
        await fetchAllSources(tenant);

      const airqoMonitors = airqoSites
        .filter((s) => slugify(s.country) === countryId)
        .map((site) =>
          buildAirQoMonitorItem(site, registryBySiteId.get(String(site._id)))
        );

      const externalMonitors = standaloneEntries
        .filter((r) => slugify(r.country) === countryId)
        .map(buildStandaloneMonitorItem);

      const allMonitors = applyFilters(
        [...airqoMonitors, ...externalMonitors],
        { activeOnly, types }
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
      const { tenant, search, activeOnly, types, countryId } = request.query;

      const { airqoSites, standaloneEntries, registryBySiteId } =
        await fetchAllSources(tenant);

      const airqoMonitors = airqoSites.map((site) =>
        buildAirQoMonitorItem(site, registryBySiteId.get(String(site._id)))
      );
      const externalMonitors = standaloneEntries.map(buildStandaloneMonitorItem);

      let monitors = applyFilters([...airqoMonitors, ...externalMonitors], {
        search,
        activeOnly,
        types,
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
};

module.exports = networkCoverageUtil;
