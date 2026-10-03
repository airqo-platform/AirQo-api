// scripts/seed-ubos-parish-population.js
//
// One-off ingestion of UBOS parish-level census population data into the
// parish_population collection (see models/ParishPopulation.js). Reads a
// data file shaped like scripts/data/ubos-kampala-parish-population-2024.json
// and upserts one row per parish/sex.
//
// After seeding, cross-checks summed parish rows against each division's
// published total (division_totals_reference in the data file) and reports
// any mismatch — a division with only partial parish coverage is expected
// to under-count, and is reported as such rather than as an error.
//
// Usage:
//   NODE_ENV=development node scripts/seed-ubos-parish-population.js [path/to/data.json]
//
// NODE_ENV must be passed explicitly — config/constants.js in this repo
// defaults NODE_ENV to "production" when it's unset, which would otherwise
// point this script at production credentials (.env.production.json) with
// no visible warning. Refusing to guess here is deliberate.
//
// Safe to re-run: all writes are upserts keyed on
// district + division + parish + sex + year.

require("module-alias/register");

if (!process.env.NODE_ENV) {
  console.error(
    "🐛🐛 NODE_ENV is not set. Refusing to run: config/constants.js " +
      "defaults to NODE_ENV=production when unset, which would target " +
      "production credentials. Re-run with e.g. " +
      "NODE_ENV=development node scripts/seed-ubos-parish-population.js"
  );
  process.exit(1);
}

// Must run before @config/constants (or anything requiring it) is loaded —
// this is what applies .env.{NODE_ENV}.json into process.env. bin/index.js
// does this same call in this same position; without it, constants like
// MONGO_URI/DB_NAME resolve to undefined even though NODE_ENV is correct.
const { loadEnvironment } = require("@config/env-loader");
loadEnvironment();

const path = require("path");
const fs = require("fs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- seed-ubos-parish-population`
);
const ParishPopulationModel = require("@models/ParishPopulation");
const { connectToMongoDB } = require("@config/database");

// This service is single-tenant in practice — "airqo" is the database's
// permanent identity, not a placeholder (see project memory on tenant
// handling). No TENANTS loop here on purpose.
const TENANT = constants.DEFAULT_TENANT || "airqo";

function loadDataFile(filePath) {
  const resolved = path.resolve(filePath);
  const raw = fs.readFileSync(resolved, "utf8");
  return JSON.parse(raw);
}

async function seedRows(dataset) {
  const { district, year, source, dataset_id, rows } = dataset;
  const Model = ParishPopulationModel(TENANT);

  let created = 0;
  let updated = 0;
  const failed = [];

  for (const row of rows) {
    for (const [sexKey, sexLabel] of [
      ["male", "Male"],
      ["female", "Female"],
    ]) {
      const population = row[sexKey];
      if (population == null) continue;

      const result = await Model.register({
        district,
        division: row.division,
        parish: row.parish,
        sex: sexLabel,
        population,
        year,
        source,
        dataset_id,
      });

      if (!result.success) {
        failed.push({
          division: row.division,
          parish: row.parish,
          sex: sexLabel,
          errors: result.errors,
        });
        continue;
      }
      if (result.status === 201) created += 1;
      else updated += 1;
    }
  }

  return { created, updated, failed };
}

async function verifyDivisionTotals(dataset) {
  const { district, year, division_totals_reference } = dataset;
  const Model = ParishPopulationModel(TENANT);

  const result = await Model.totalsByDivision({ district, year });
  if (!result.success) {
    logger.error(`Could not compute division totals: ${result.message}`);
    return;
  }

  const report = (line) => {
    console.log(line);
    logger.info(line);
  };

  report("Division totals cross-check (ingested vs. UBOS-published):");
  for (const division of result.data) {
    const reference = division_totals_reference
      ? division_totals_reference[division.division]
      : null;
    const male =
      (division.by_sex.find((s) => s.sex === "Male") || {}).population || 0;
    const female =
      (division.by_sex.find((s) => s.sex === "Female") || {}).population || 0;

    if (!reference) {
      report(
        `  ${division.division}: ${division.parish_count} parishes seeded, ` +
          `male=${male} female=${female} (no reference total on file)`
      );
      continue;
    }

    const matches = male === reference.male && female === reference.female;
    report(
      `  ${division.division}: ${division.parish_count} parishes seeded, ` +
        `male=${male}/${reference.male} female=${female}/${reference.female} ` +
        `${matches ? "MATCH" : "PARTIAL (expected until all parishes are seeded)"}`
    );
  }
}

async function run() {
  const dataFilePath =
    process.argv[2] ||
    path.join(__dirname, "data", "ubos-kampala-parish-population-2024.json");

  // console.log alongside logger: this codebase's log4js console appender
  // is silenced in development and file-only in staging/production (see
  // config/log4js.js), so logger.* calls alone never reach the terminal —
  // console.log is what actually gives the operator running this CLI
  // script feedback.
  console.log(`Loading UBOS parish population data from ${dataFilePath}`);
  logger.info(`Loading UBOS parish population data from ${dataFilePath}`);
  const dataset = loadDataFile(dataFilePath);

  const { created, updated, failed } = await seedRows(dataset);
  console.log(
    `Seed complete: ${created} created, ${updated} updated, ${failed.length} failed`
  );
  logger.info(
    `Seed complete: ${created} created, ${updated} updated, ${failed.length} failed`
  );
  if (failed.length > 0) {
    console.error(`Failed rows: ${JSON.stringify(failed, null, 2)}`);
    logger.error(`Failed rows: ${JSON.stringify(failed, null, 2)}`);
  }

  await verifyDivisionTotals(dataset);
}

if (require.main === module) {
  console.log(
    `Target: NODE_ENV=${process.env.NODE_ENV} environment=${constants.ENVIRONMENT} ` +
      `db=${constants.DB_NAME} tenant=${TENANT}`
  );

  const { commandDB, queryDB } = connectToMongoDB();

  const main = async () => {
    let exitCode = 0;
    try {
      if (queryDB.readyState !== 1) {
        await new Promise((resolve, reject) => {
          queryDB.once("open", resolve);
          queryDB.once("error", reject);
        });
      }
      await run();
    } catch (error) {
      console.error(`🐛🐛 Seed script failed: ${error.message}`);
      logger.error(`🐛🐛 Seed script failed: ${error.message}`);
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

  main();
}

module.exports = { seedRows, verifyDivisionTotals, loadDataFile };
