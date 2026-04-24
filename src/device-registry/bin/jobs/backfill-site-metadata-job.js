const cron = require("node-cron");
const SiteModel = require("@models/Site");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");

// Per-site operational logger — uses the default category.
// WARN and ERROR stay in file/console only; ERROR still reaches Slack via the
// default slackErrors appender. Individual site failures must NOT flood Slack.
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-site-metadata-job`,
);

// Job-level summary logger — uses ops-alerts category (WARN and above → Slack).
// Only job-run summaries and structural alerts are logged here so Slack
// receives a single consolidated message per nightly run, never per-site noise.
const jobLogger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-site-metadata-job -- ops-alerts`,
);
const createSiteUtil = require("@utils/site.util");
const os = require("os");

const BATCH_SIZE = 100;
// Hard cap on total sites geocoded per run to control Google Maps API costs.
// Sites are processed in BATCH_SIZE chunks; the job stops once this many
// sites have been attempted regardless of how many remain.
const MAX_GEOCODING_ATTEMPTS_PER_RUN = 300;
// A single geocoding failure permanently excludes the site from this automated
// job. Coordinates that cannot be resolved (bad GPS, water, sparse coverage)
// are unlikely to resolve on a retry, and re-attempting wastes API credits.
// Manual refresh via the site-refresh endpoint is still available for one-off
// corrections and is not affected by this limit.
const MAX_GEOCODING_FAILURES = 1;
const JOB_NAME = "backfill-site-metadata";
const LOCK_TTL_SECONDS = 90 * 60; // 90 minutes
const POD_ID = process.env.HOSTNAME || os.hostname();

const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);
  try {
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: JOB_NAME,
        $or: [{ jobName: { $exists: false } }, { expiresAt: { $lte: now } }],
      },
      {
        $setOnInsert: {
          jobName: JOB_NAME,
          acquiredBy: POD_ID,
          acquiredAt: now,
          expiresAt,
        },
      },
      { upsert: true, new: true, rawResult: false },
    );
    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    if (error.code === 11000) return false;
    logger.error(`🐛🐛 Lock acquisition error: ${error.message}`);
    return false;
  }
};

const releaseLock = async (tenant) => {
  try {
    await JobLockModel(tenant).findOneAndDelete({
      jobName: JOB_NAME,
      acquiredBy: POD_ID,
    });
  } catch (error) {
    logger.error(`🐛🐛 Lock release error: ${error.message}`);
  }
};

/**
 * Filters the metadata returned by generateMetadata down to only the fields
 * that are currently absent (missing, null, or empty string) on the site
 * document. Fields that already have a value are intentionally skipped.
 *
 * This prevents the backfill job from overwriting fields like search_name,
 * location_name, and formatted_name that may have been carefully renamed by
 * check-duplicate-site-fields-job or update-duplicate-site-fields-job to
 * resolve uniqueness conflicts.
 */
const buildMissingFieldsUpdate = (site, metadataFields) => {
  return Object.fromEntries(
    Object.entries(metadataFields).filter(([key, value]) => {
      if (value === undefined) return false;
      const existing = site[key];
      // Only include if the field is missing, null, or empty string on the site
      return existing === undefined || existing === null || existing === "";
    }),
  );
};

/**
 * Attempts to assign a generated_name to a site that is missing one.
 * generated_name comes from the UniqueIdentifierCounter — it is completely
 * independent of geocoding and must therefore be handled before
 * generateMetadata() is called.
 *
 * Writes the generated_name directly to the database and returns it so the
 * in-memory site object can be updated before buildMissingFieldsUpdate runs.
 *
 * @param {string} tenant
 * @param {Object} site  — lean MongoDB site document
 * @returns {string|null}  — the newly assigned generated_name, or null on failure
 */
const repairGeneratedName = async (tenant, site) => {
  try {
    const response = await createSiteUtil.generateName(tenant, (err) => {
      throw err;
    });

    if (!response || response.success === false) {
      logger.error(
        `[${POD_ID}] Failed to generate name for site ${
          site._id
        }: ${response?.message || "unknown error"}`,
      );
      return null;
    }

    const generatedName = response.data;

    // Use collection.updateOne to bypass the Mongoose pre-hook on
    // findOneAndUpdate, which strips generated_name from $set because it is
    // listed in the hook's restrictedFields array. Going directly to the
    // driver-level collection skips all middleware and guarantees the field
    // is actually written to MongoDB.
    //
    // The filter includes the "still missing" predicate so the write is a
    // no-op if a concurrent process already repaired generated_name between
    // our query and this write. matchedCount === 0 in that case means
    // "already repaired elsewhere" and is treated as success.
    const writeResult = await SiteModel(tenant).collection.updateOne(
      {
        _id: site._id,
        $or: [
          { generated_name: { $exists: false } },
          { generated_name: null },
          { generated_name: "" },
        ],
      },
      { $set: { generated_name: generatedName } },
    );

    if (!writeResult) {
      logger.error(
        `[${POD_ID}] collection.updateOne returned no result for site ${site._id}`,
      );
      return null;
    }

    if (writeResult.matchedCount === 0) {
      // Another process already repaired generated_name — treat as success.
      logger.info(
        `[${POD_ID}] generated_name already repaired by another process for site ${site._id}`,
      );
      // Re-fetch so the caller has the current value.
      const current = await SiteModel(tenant)
        .findById(site._id)
        .select("generated_name")
        .lean();
      return current ? current.generated_name : null;
    }

    logger.info(
      `[${POD_ID}] Assigned generated_name "${generatedName}" to site ${site._id}`,
    );

    return generatedName;
  } catch (error) {
    logger.error(
      `[${POD_ID}] Error repairing generated_name for site ${site._id}: ${error.message}`,
    );
    return null;
  }
};

// Defined once at module level — avoids recreating this array for every
// site in every batch during the job run.
const GEOCODED_FIELDS = [
  "country", "district", "city", "region", "town", "village",
  "parish", "county", "sub_county", "division", "street",
  "formatted_name", "geometry", "google_place_id", "location_name",
  "search_name", "data_provider", "site_tags",
];

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) return;

  try {
    let sitesProcessed = 0;
    let sitesFailedCount = 0;

    // Cursor-based pagination: a single ObjectId in memory instead of a
    // growing $nin array. Each batch picks up where the last one left off
    // using an indexed range scan on _id.
    let lastProcessedId = null;

    // Primary cost-control filter: only sites created in the last 30 days.
    // Older sites are either already complete, permanently excluded, or
    // were deployed without devices and remain orphaned.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Hard ceiling on the number of batches regardless of candidate set size.
    // Derived from the per-run cap so it is always consistent: even if the
    // cap check inside the loop is somehow skipped, this prevents an infinite
    // loop. The +1 accounts for a partial final batch.
    const MAX_BATCHES = Math.ceil(MAX_GEOCODING_ATTEMPTS_PER_RUN / BATCH_SIZE) + 1;
    let batchesRun = 0;

    // Three explicit termination conditions in the while guard — no hidden
    // breaks needed for the primary exit paths:
    //   1. batchesRun < MAX_BATCHES  — hard structural ceiling (safety net)
    //   2. sitesProcessed + sitesFailedCount < MAX_GEOCODING_ATTEMPTS_PER_RUN
    //      — per-run cost cap
    // The third condition (natural exhaustion) is handled by breaking when
    // sitesToUpdate.length === 0, since an empty result cannot be expressed
    // as a pre-condition without an extra query.
    while (
      batchesRun < MAX_BATCHES &&
      sitesProcessed + sitesFailedCount < MAX_GEOCODING_ATTEMPTS_PER_RUN
    ) {
      batchesRun++;
      const idCursor = lastProcessedId ? { _id: { $gt: lastProcessedId } } : {};

      // Single aggregation pipeline replacing the previous two-query + merge
      // approach. Key design decisions:
      //
      // 1. $match first with the 30-day + exclusion + cursor filters —
      //    MongoDB can use compound indexes on (createdAt, _id) to satisfy
      //    this cheaply before touching any other stage.
      //
      // 2. $lookup on "devices" happens BEFORE $limit so that BATCH_SIZE
      //    reflects sites-with-devices, not raw candidates. The 30-day
      //    filter keeps the pre-lookup set small so this is not expensive.
      //
      // 3. $lookup uses a correlated sub-pipeline with $limit:1 — MongoDB
      //    stops scanning devices as soon as one match is found per site.
      //    No site IDs are loaded into pod memory.
      //
      // 4. Cursor advances by the last _id that passed all filters, so
      //    sites without devices are skipped cleanly without being added
      //    to any in-memory exclusion list.
      const sitesToUpdate = await SiteModel(tenant).aggregate([
        {
          $match: {
            createdAt: { $gte: thirtyDaysAgo },
            _geocodingPermanentlyExcluded: { $ne: true },
            ...idCursor,
            $or: [
              // Branch A: local-only missing fields — no API call needed,
              // so these are always retried regardless of geocoding history.
              { generated_name: { $in: [null, ""] } },
              { generated_name: { $exists: false } },
              { search_name: { $in: [null, ""] } },
              { search_name: { $exists: false } },
              { description: { $in: [null, ""] } },
              { description: { $exists: false } },
              // Branch B: geocoded missing fields — only attempt for sites
              // that have NEVER been geocoded before (_geocodingFailedCount
              // absent or 0). A single past failure is treated as permanent
              // for this automated job; manual refresh remains available.
              {
                $and: [
                  {
                    $or: [
                      { _geocodingFailedCount: { $exists: false } },
                      { _geocodingFailedCount: 0 },
                    ],
                  },
                  {
                    $or: [
                      { country: { $in: [null, ""] } },
                      { country: { $exists: false } },
                      { district: { $in: [null, ""] } },
                      { district: { $exists: false } },
                      { city: { $in: [null, ""] } },
                      { city: { $exists: false } },
                      { data_provider: { $in: [null, ""] } },
                      { data_provider: { $exists: false } },
                    ],
                  },
                ],
              },
            ],
          },
        },
        { $sort: { _id: 1 } },
        {
          $lookup: {
            from: "devices",
            let: { siteId: "$_id" },
            pipeline: [
              { $match: { $expr: { $eq: ["$site_id", "$$siteId"] } } },
              { $limit: 1 },
              { $project: { _id: 1 } },
            ],
            as: "_deviceCheck",
          },
        },
        // Discard sites with no devices — orphaned/undeployed sites must
        // not consume geocoding quota.
        { $match: { _deviceCheck: { $ne: [] } } },
        { $unset: "_deviceCheck" },
        { $limit: BATCH_SIZE },
      ]);

      if (sitesToUpdate.length === 0) break;

      // Advance cursor to the last _id in this batch.
      lastProcessedId = sitesToUpdate[sitesToUpdate.length - 1]._id;

      // Process sites sequentially — one Google Maps API call at a time.
      // This is a nightly job where throughput latency is irrelevant but
      // API cost and rate-limit safety are critical. Parallel execution
      // (Promise.allSettled) would fire up to BATCH_SIZE concurrent requests,
      // risking quota violations and inflating cost even on failures.
      for (const site of sitesToUpdate) {
        try {
          // Step 1: Local-only repairs — generated_name and description.
          // No external API calls. Sites needing only these repairs never
          // reach the Google Maps call below.
          if (!site.generated_name) {
            const repairedName = await repairGeneratedName(tenant, site);
            if (repairedName) {
              site.generated_name = repairedName;
            } else {
              sitesFailedCount++;
              continue;
            }
          }

          if ((!site.description || site.description === "") && site.name) {
            const descWriteResult = await SiteModel(
              tenant,
            ).collection.updateOne(
              {
                _id: site._id,
                $or: [
                  { description: { $exists: false } },
                  { description: null },
                  { description: "" },
                ],
              },
              { $set: { description: site.name } },
            );
            if (!descWriteResult) {
              logger.error(
                `[${POD_ID}] collection.updateOne returned no result for description on site ${site._id}`,
              );
            } else if (descWriteResult.matchedCount === 0) {
              const current = await SiteModel(tenant)
                .findById(site._id)
                .select("description")
                .lean();
              if (current && current.description)
                site.description = current.description;
            } else {
              site.description = site.name;
            }
          }

          // Step 2: Skip Google Maps call if all missing fields were local
          // and have now been repaired. Altitude is permanently excluded.
          const needsGeocoding = GEOCODED_FIELDS.some((field) => {
            const v = site[field];
            return v === undefined || v === null || v === "";
          });

          if (!needsGeocoding) {
            sitesProcessed++;
            continue;
          }

          // Flag used by the outer catch to distinguish geocoding errors from
          // local-repair errors. Only geocoding failures should increment the
          // persistent failure counter — a transient DB error in Steps 1-2
          // must not permanently exclude a valid site.
          let attemptedGeocoding = false;

          // Step 3: Reverse geocode. Altitude permanently skipped — the
          // Elevation API was the primary driver of runaway API costs.
          attemptedGeocoding = true;
          const metadataResponse = await createSiteUtil.generateMetadata(
            {
              query: { tenant },
              body: {
                latitude: site.latitude,
                longitude: site.longitude,
                network: site.network || "airqo",
                skipAltitude: true,
              },
            },
            (err) => { throw err; },
          );

          if (metadataResponse.success) {
            const {
              country, district, city, region, town, village, parish, county,
              sub_county, division, street, formatted_name, geometry,
              google_place_id, location_name, search_name, data_provider,
              site_tags, description,
            } = metadataResponse.data;

            const missingFields = buildMissingFieldsUpdate(site, {
              country, district, city, region, town, village, parish, county,
              sub_county, division, street, formatted_name, geometry,
              google_place_id, location_name, search_name, data_provider,
              site_tags,
              description: description || site.name || undefined,
            });

            if (Object.keys(missingFields).length > 0) {
              await SiteModel(tenant).findByIdAndUpdate(site._id, {
                $set: missingFields,
              });
            }
            sitesProcessed++;
          } else {
            // Geocoding failure — bad GPS, sparse Maps coverage, or water.
            // Not a job crash: downgraded to warn.
            logger.warn(
              `[${POD_ID}] Geocoding returned no results for site ${site.name}: ${metadataResponse.message}`,
            );
            // Increment failure counter. At MAX_GEOCODING_FAILURES the site
            // is permanently excluded — written to the schema field in MongoDB,
            // survives pod restarts and rolling deployments.
            const newCount = (site._geocodingFailedCount || 0) + 1;
            const stampFields = { _geocodingFailedCount: newCount };
            if (newCount >= MAX_GEOCODING_FAILURES) {
              stampFields._geocodingPermanentlyExcluded = true;
              logger.warn(
                `[${POD_ID}] Site ${site.name} (${site._id}) permanently excluded after ${newCount} failed geocoding attempts.`,
              );
            }
            await SiteModel(tenant).findByIdAndUpdate(site._id, {
              $set: stampFields,
            });
            sitesFailedCount++;
          }
        } catch (error) {
          logger.error(
            `[${POD_ID}] Error processing site ${site._id}: ${error.message}`,
          );
          // Only stamp the geocoding failure counter if the error was thrown
          // during Step 3. Errors from Steps 1-2 (local DB repairs) are
          // transient and must not permanently exclude a valid site.
          if (attemptedGeocoding) {
            try {
              const newCount = (site._geocodingFailedCount || 0) + 1;
              const stampFields = { _geocodingFailedCount: newCount };
              if (newCount >= MAX_GEOCODING_FAILURES) {
                stampFields._geocodingPermanentlyExcluded = true;
                logger.warn(
                  `[${POD_ID}] Site ${site.name} (${site._id}) permanently excluded after ${newCount} failed geocoding attempts (exception path).`,
                );
              }
              await SiteModel(tenant).findByIdAndUpdate(site._id, {
                $set: stampFields,
              });
            } catch (stampError) {
              logger.error(
                `[${POD_ID}] Failed to stamp geocoding failure for site ${site._id}: ${stampError.message}`,
              );
            }
          }
          sitesFailedCount++;
        }
      }

    }

    // Diagnose which exit condition terminated the loop.
    // All messages below use jobLogger (ops-alerts) — one Slack notification
    // per run summarising the outcome, never one per site.
    if (batchesRun >= MAX_BATCHES) {
      jobLogger.warn(
        `[${POD_ID}] ${jobName} hit structural batch ceiling (${MAX_BATCHES} batches). ` +
        `This should not happen under normal load — review MAX_GEOCODING_ATTEMPTS_PER_RUN and BATCH_SIZE.`,
      );
    } else if (sitesProcessed + sitesFailedCount >= MAX_GEOCODING_ATTEMPTS_PER_RUN) {
      jobLogger.info(
        `[${POD_ID}] ${jobName} reached per-run cap of ${MAX_GEOCODING_ATTEMPTS_PER_RUN}. Remaining sites deferred to next run.`,
      );
    }

    if (sitesFailedCount > 0) {
      jobLogger.warn(
        `[${POD_ID}] ${jobName} finished. Updated: ${sitesProcessed}, ` +
        `Geocoding unresolvable (permanent exclusion after ${MAX_GEOCODING_FAILURES} failures): ${sitesFailedCount}.`,
      );
    } else {
      jobLogger.info(`[${POD_ID}] ${jobName} finished. Updated: ${sitesProcessed}.`);
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const schedule = "0 2 * * *"; // Once daily at 02:00 Nairobi time

if (constants.BACKFILL_SITE_METADATA_SCHEDULER_ENABLED === true) {
  cron.schedule(
    schedule,
    async () => {
      await backfillSiteMetadata("airqo");
    },
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );

  // SIGTERM and SIGINT are normal Kubernetes lifecycle events (rolling
  // deployments, scaling down) — log as warn rather than error to avoid
  // triggering false alerts in monitoring.
  process.on("SIGTERM", async () => {
    logger.warn(
      `[${POD_ID}] SIGTERM received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });

  process.on("SIGINT", async () => {
    logger.warn(
      `[${POD_ID}] SIGINT received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });
}

module.exports = backfillSiteMetadata;
