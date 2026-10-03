// scripts/seed-ubos-division-population.js
//
// Ingests UBOS's division-level population rollup (complete for all 5
// Kampala divisions, unlike the parish-level detail table — see
// seed-ubos-parish-population.js) into the division_population collection
// (models/DivisionPopulation.js).
//
// After seeding, reports each division's share of the Kampala total — a
// well-defined, fully-derivable "within-city population share" — but
// deliberately does NOT write this into SdgCity/SdgPopulationWeight.pop_weight.
// That field is documented (see docs/SDG-11.6.2-metadata-api.md /
// SDG 11.6.2 spec) as a share of the *national* population, and this script
// has no authoritative national total to divide by. Writing a within-city
// share into a field that downstream consumers will read as a national
// fraction would silently corrupt the national_weighted_mean calculation in
// the Annual PM API (src/spatial) — worse than leaving it unset. See the
// script's final report for what's actually needed to unblock that.
//
// Usage:
//   NODE_ENV=development node scripts/seed-ubos-division-population.js [path/to/data.json]
//
// Safe to re-run: all writes are upserts keyed on
// district + division + sex + year.

require("module-alias/register");

if (!process.env.NODE_ENV) {
  console.error(
    "🐛🐛 NODE_ENV is not set. Refusing to run: config/constants.js " +
      "defaults to NODE_ENV=production when unset, which would target " +
      "production credentials. Re-run with e.g. " +
      "NODE_ENV=development node scripts/seed-ubos-division-population.js"
  );
  process.exit(1);
}

const { loadEnvironment } = require("@config/env-loader");
loadEnvironment();

const path = require("path");
const fs = require("fs");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- seed-ubos-division-population`
);
const DivisionPopulationModel = require("@models/DivisionPopulation");
const SdgCityModel = require("@models/SdgCity");
const { connectToMongoDB } = require("@config/database");

const TENANT = constants.DEFAULT_TENANT || "airqo";

const report = (line) => {
  console.log(line);
  logger.info(line);
};
const reportError = (line) => {
  console.error(line);
  logger.error(line);
};

function loadDataFile(filePath) {
  const resolved = path.resolve(filePath);
  return JSON.parse(fs.readFileSync(resolved, "utf8"));
}

async function seedRows(dataset) {
  const { district, year, source, dataset_id, rows } = dataset;
  const Model = DivisionPopulationModel(TENANT);

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
        sex: sexLabel,
        population,
        year,
        parish_count: row.parish_count,
        source,
        dataset_id,
      });

      if (!result.success) {
        failed.push({
          division: row.division,
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

async function reportShares(dataset) {
  const { district, year, kampala_total_reference } = dataset;
  const Model = DivisionPopulationModel(TENANT);

  const result = await Model.cityTotal({ district, year });
  if (!result.success) {
    reportError(`Could not compute city total: ${result.message}`);
    return;
  }

  const { divisions, total } = result.data;

  report(
    `City total cross-check: ingested=${total} vs. UBOS-published=${
      kampala_total_reference ? kampala_total_reference.total : "n/a"
    } ${
      kampala_total_reference && total === kampala_total_reference.total
        ? "MATCH"
        : "MISMATCH"
    }`
  );

  report("Within-Kampala population share by division (population / city total):");
  for (const d of divisions) {
    const share = total > 0 ? d.population / total : 0;
    report(
      `  ${d.division}: population=${d.population}, share=${share.toFixed(
        4
      )}, parish_count=${d.parish_count}`
    );
  }

  return divisions.map((d) => ({
    division: d.division,
    population: d.population,
    within_city_share: total > 0 ? d.population / total : 0,
  }));
}

async function checkPopWeightPrerequisite() {
  const cities = await SdgCityModel(TENANT)
    .find({ country: "UG" })
    .select("city_id name pop_weight population")
    .lean();

  report("");
  report("--- pop_weight prerequisite check ---");
  if (cities.length === 0) {
    report(
      "No SdgCity record exists yet for any UG city (checked country=UG). " +
        "There is no existing national-level pop_weight to redistribute " +
        "across Kampala's divisions."
    );
  } else {
    report(`Found ${cities.length} existing UG SdgCity record(s):`);
    cities.forEach((c) =>
      report(
        `  ${c.city_id} (${c.name}): population=${c.population}, pop_weight=${c.pop_weight}`
      )
    );
  }
  report(
    "SDG 11.6.2's pop_weight is a share of the NATIONAL population (see " +
      "the metadata spec's Section 2.2 example), not a share of Kampala. " +
      "This script only has Kampala-internal data, so it reports each " +
      "division's within-city share (above) but does not write it into " +
      "pop_weight — doing so would silently corrupt the " +
      "national_weighted_mean the Annual PM API computes downstream. " +
      "To finish this: either supply Uganda's official national population " +
      "total for the same 2024 census (then division pop_weight = " +
      "division_population / national_total), or confirm Kampala's own " +
      "calibrated national-level pop_weight so it can be split across " +
      "divisions proportionally (division_pop_weight = kampala_pop_weight " +
      "* within_city_share)."
  );
}

async function run() {
  const dataFilePath =
    process.argv[2] ||
    path.join(
      __dirname,
      "data",
      "ubos-kampala-division-population-2024.json"
    );

  report(`Loading UBOS division population data from ${dataFilePath}`);
  const dataset = loadDataFile(dataFilePath);

  const { created, updated, failed } = await seedRows(dataset);
  report(
    `Seed complete: ${created} created, ${updated} updated, ${failed.length} failed`
  );
  if (failed.length > 0) {
    reportError(`Failed rows: ${JSON.stringify(failed, null, 2)}`);
  }

  await reportShares(dataset);
  await checkPopWeightPrerequisite();
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

module.exports = { seedRows, reportShares, checkPopWeightPrerequisite, loadDataFile };
