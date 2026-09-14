// migrations/backfill-city-history-country.js
//
// One-off backfill for AirQualitySummary's level="city" rows written before
// air-quality-rollup-job.js started capturing `country` (see the field's
// comment on models/AirQualitySummary.js and the rollup job's own comments).
// Those older rows have country: null, which excludes them from a
// country-scoped `/rankings/history` query — this script fills in `country`
// for the cases where it's safe to do so.
//
// SAFETY: a city name is only backfilled when it maps to EXACTLY ONE country
// across the Site collection (the permanent source of truth for
// site.city/site.country — unlike raw Reading documents, Sites are never
// purged). A city name that appears under two or more countries in Site data
// is left untouched — guessing wrong would silently misattribute real
// history to the wrong country, which is worse than leaving it unscoped.
// This is why "no backfill" was accepted as a fine outcome for those cities;
// this script only ever narrows that set, never overrides existing
// non-null `country` values on an AirQualitySummary row.
//
// Run manually (not part of the deploy pipeline) — defaults to a dry run
// (logs what it would change, writes nothing); review that output, then pass
// --apply to actually write:
//   node -r module-alias/register migrations/backfill-city-history-country.js
//   node -r module-alias/register migrations/backfill-city-history-country.js --apply
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-city-history-country-migration`
);
const AirQualitySummaryModel = require("@models/AirQualitySummary");
const SiteModel = require("@models/Site");
const { connectToMongoDB } = require("@config/database");

// This service only ever runs against one tenant — the real multi-tenant
// design was abandoned; "airqo" is the database's permanent identity, not a
// placeholder. No tenant loop/array here on purpose (see project memory on
// tenant handling) — a single direct run against the default tenant.
const TENANT = constants.DEFAULT_TENANT || "airqo";

// Site.city/Site.country are free text (no shared normalization with the
// rankings endpoints' own trim/lowercase merge) — apply the same
// trim+lowercase key here so "Kampala" and "kampala " resolve to the same
// candidate city before checking for cross-country ambiguity.
function normalize(value) {
  return (value || "").trim().toLowerCase();
}

async function buildUnambiguousCityToCountryMap() {
  const sites = await SiteModel(TENANT)
    .find({ city: { $nin: [null, ""] }, country: { $nin: [null, ""] } })
    .select({ city: 1, country: 1 })
    .lean();

  const cityToCountries = new Map(); // normalizedCity -> Set<country>
  sites.forEach((site) => {
    const key = normalize(site.city);
    if (!key) return;
    if (!cityToCountries.has(key)) cityToCountries.set(key, new Set());
    cityToCountries.get(key).add(site.country);
  });

  const unambiguous = new Map(); // normalizedCity -> country
  let ambiguousCount = 0;
  cityToCountries.forEach((countries, key) => {
    if (countries.size === 1) {
      unambiguous.set(key, Array.from(countries)[0]);
    } else {
      ambiguousCount += 1;
    }
  });

  logger.info(
    `Site data: ${cityToCountries.size} distinct city names, ` +
      `${unambiguous.size} map to exactly one country, ` +
      `${ambiguousCount} are ambiguous (skipped).`
  );
  return unambiguous;
}

async function backfill({ dryRun = true } = {}) {
  const unambiguousCityToCountry = await buildUnambiguousCityToCountryMap();

  const staleDocs = await AirQualitySummaryModel(TENANT)
    .find({ tenant: TENANT, level: "city", country: null })
    .select({ _id: 1, entity: 1 })
    .lean();

  logger.info(`${staleDocs.length} level="city" row(s) currently missing country.`);

  const ops = [];
  const unresolvedEntities = new Set();
  staleDocs.forEach((doc) => {
    const key = normalize(doc.entity);
    const country = unambiguousCityToCountry.get(key);
    if (!country) {
      unresolvedEntities.add(doc.entity);
      return;
    }
    ops.push({
      updateOne: {
        filter: { _id: doc._id },
        update: { $set: { country } },
      },
    });
  });

  logger.info(
    `${ops.length} row(s) resolvable to exactly one country; ` +
      `${unresolvedEntities.size} distinct entity name(s) left unresolved ` +
      `(ambiguous or not found in Site data).`
  );

  if (dryRun) {
    logger.info("Dry run — no writes performed. Re-run without --dry-run to apply.");
    return { resolved: ops.length, unresolved: unresolvedEntities.size };
  }

  if (ops.length > 0) {
    const result = await AirQualitySummaryModel(TENANT).bulkWrite(ops, {
      ordered: false,
    });
    logger.info(`Backfill complete: ${result.modifiedCount} row(s) updated.`);
  }

  return { resolved: ops.length, unresolved: unresolvedEntities.size };
}

module.exports = { backfill };

if (require.main === module) {
  const dryRun = !process.argv.includes("--apply");
  const { commandDB, queryDB } = connectToMongoDB();

  const run = async () => {
    let exitCode = 0;
    try {
      if (dryRun) {
        logger.info("Running in dry-run mode (pass --apply to write changes).");
      }
      await backfill({ dryRun });
    } catch (error) {
      logger.error(`🐛🐛 Backfill failed: ${error.message}`);
      exitCode = 1;
    } finally {
      try {
        await Promise.all([
          commandDB && commandDB.close ? commandDB.close() : Promise.resolve(),
          queryDB && queryDB.close ? queryDB.close() : Promise.resolve(),
        ]);
      } catch (closeError) {
        logger.error(`Error closing connections: ${closeError.message}`);
        exitCode = 1;
      }
      process.exit(exitCode);
    }
  };

  if (queryDB.readyState === 1) {
    run();
  } else {
    queryDB.once("open", run);
    queryDB.on("error", (err) => {
      logger.error(`MongoDB connection error: ${err.message}. Exiting.`);
      process.exit(1);
    });
  }
}
