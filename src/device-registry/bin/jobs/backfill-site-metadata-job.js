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

const BATCH_SIZE = 30;
// Hard cap on total geocoding attempts per run. Sites are processed in
// BATCH_SIZE chunks; the job stops once this many have been attempted.
const MAX_GEOCODING_ATTEMPTS_PER_RUN = 300;
// After this many consecutive altitude failures for a single site, the job
// skips the getAltitude API call for that site rather than burning credits
// on coordinates that repeatedly return nothing. The counter resets to 0
// whenever altitude is successfully written.
const ALTITUDE_FAILURE_THRESHOLD = 3;
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
  "country",
  "district",
  "city",
  "region",
  "town",
  "village",
  "parish",
  "county",
  "sub_county",
  "division",
  "street",
  "formatted_name",
  "geometry",
  "google_place_id",
  "location_name",
  "search_name",
  "data_provider",
  "site_tags",
  "altitude",
];

// Fields in GEOCODED_FIELDS that are NOT altitude — used to decide whether
// altitude is the sole reason a site needs geocoding.
const NON_ALTITUDE_GEOCODED_FIELDS = GEOCODED_FIELDS.filter(
  (f) => f !== "altitude",
);

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

    // Guards: online sites created in the last 30 days only.
    // isOnline: true implies an active deployed device — no separate device
    // lookup needed. Older sites are expected to be complete already.
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const MAX_BATCHES =
      Math.ceil(MAX_GEOCODING_ATTEMPTS_PER_RUN / BATCH_SIZE) + 1;
    let batchesRun = 0;

    while (
      batchesRun < MAX_BATCHES &&
      sitesProcessed + sitesFailedCount < MAX_GEOCODING_ATTEMPTS_PER_RUN
    ) {
      batchesRun++;
      const idCursor = lastProcessedId ? { _id: { $gt: lastProcessedId } } : {};

      const sitesToUpdate = await SiteModel(tenant).find(
        {
          isOnline: true,
          createdAt: { $gte: thirtyDaysAgo },
          ...idCursor,
          $or: [
            { generated_name: { $in: [null, ""] } },
            { description: { $in: [null, ""] } },
            { country: { $in: [null, ""] } },
            { district: { $in: [null, ""] } },
            { city: { $in: [null, ""] } },
            // Include altitude-only gaps while the failure counter is below the
            // threshold so exhausted sites are not repeatedly selected.
            {
              altitude: null,
              $or: [
                { _altitudeFailedCount: { $exists: false } },
                { _altitudeFailedCount: { $lt: ALTITUDE_FAILURE_THRESHOLD } },
              ],
            },
          ],
        },
        null,
        { sort: { _id: 1 }, limit: BATCH_SIZE, lean: true },
      );

      if (sitesToUpdate.length === 0) break;

      lastProcessedId = sitesToUpdate[sitesToUpdate.length - 1]._id;

      // Sequential processing — one geocoding call at a time to stay within
      // API rate limits and keep costs predictable across 3 daily runs.
      for (const site of sitesToUpdate) {
        try {
          // Step 1: Local-only repairs — no external API calls.
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
            if (descWriteResult && descWriteResult.matchedCount === 0) {
              const current = await SiteModel(tenant)
                .findById(site._id)
                .select("description")
                .lean();
              if (current && current.description)
                site.description = current.description;
            } else if (descWriteResult) {
              site.description = site.name;
            }
          }

          // Step 2: Skip geocoding if all missing fields were local-only.
          const isMissing = (v) => v === undefined || v === null || v === "";
          const needsGeocoding = GEOCODED_FIELDS.some((f) => isMissing(site[f]));

          if (!needsGeocoding) {
            sitesProcessed++;
            continue;
          }

          // If altitude is the only missing geocoded field and this site has
          // already exceeded the failure threshold, count it as done rather
          // than burning an API credit on a coordinate that repeatedly fails.
          const altitudeExhausted =
            (site._altitudeFailedCount || 0) >= ALTITUDE_FAILURE_THRESHOLD;
          const needsNonAltitudeGeocoding = NON_ALTITUDE_GEOCODED_FIELDS.some(
            (f) => isMissing(site[f]),
          );

          if (!needsNonAltitudeGeocoding && altitudeExhausted) {
            sitesProcessed++;
            continue;
          }

          // Step 3: Reverse geocode + altitude.
          // Skip the altitude API call for sites whose failure counter is at
          // the threshold — still geocode the other missing fields normally.
          const altitudeNeeded = isMissing(site.altitude);
          const skipAltitude = !altitudeNeeded || altitudeExhausted;

          const metadataResponse = await createSiteUtil.generateMetadata(
            {
              query: { tenant },
              body: {
                latitude: site.latitude,
                longitude: site.longitude,
                network: site.network || "airqo",
                skipAltitude,
              },
            },
            (err) => {
              throw err;
            },
          );

          if (metadataResponse.success) {
            const {
              country,
              district,
              city,
              region,
              town,
              village,
              parish,
              county,
              sub_county,
              division,
              street,
              formatted_name,
              geometry,
              google_place_id,
              location_name,
              search_name,
              data_provider,
              site_tags,
              altitude,
              description,
            } = metadataResponse.data;

            const missingFields = buildMissingFieldsUpdate(site, {
              country,
              district,
              city,
              region,
              town,
              village,
              parish,
              county,
              sub_county,
              division,
              street,
              formatted_name,
              geometry,
              google_place_id,
              location_name,
              search_name,
              data_provider,
              site_tags,
              altitude,
              description: description || site.name || undefined,
            });

            // Track altitude success/failure so future runs can skip the
            // getAltitude call for coordinates that consistently return nothing.
            const altitudeTracker = {};
            if (altitudeNeeded && !skipAltitude) {
              if (missingFields.altitude !== undefined) {
                altitudeTracker._altitudeFailedCount = 0;
              } else {
                altitudeTracker._altitudeFailedCount =
                  (site._altitudeFailedCount || 0) + 1;
              }
            }

            const allUpdates = { ...missingFields, ...altitudeTracker };
            if (Object.keys(allUpdates).length > 0) {
              await SiteModel(tenant).findByIdAndUpdate(site._id, {
                $set: allUpdates,
              });
            }
            sitesProcessed++;
          } else {
            logger.warn(
              `[${POD_ID}] Geocoding failed for site ${site.name} (${site._id}): ${metadataResponse.message}`,
            );
            sitesFailedCount++;
          }
        } catch (error) {
          logger.error(
            `[${POD_ID}] Error processing site ${site._id}: ${error.message}`,
          );
          sitesFailedCount++;
        }
      }
    }

    if (batchesRun >= MAX_BATCHES) {
      jobLogger.warn(
        `[${POD_ID}] ${jobName} hit batch ceiling (${MAX_BATCHES} batches). ` +
          `Review MAX_GEOCODING_ATTEMPTS_PER_RUN and BATCH_SIZE.`,
      );
    } else if (
      sitesProcessed + sitesFailedCount >=
      MAX_GEOCODING_ATTEMPTS_PER_RUN
    ) {
      jobLogger.info(
        `[${POD_ID}] ${jobName} reached per-run cap of ${MAX_GEOCODING_ATTEMPTS_PER_RUN}. Remaining sites deferred to next run.`,
      );
    }

    if (sitesFailedCount > 0) {
      jobLogger.warn(
        `[${POD_ID}] ${jobName} finished. Updated: ${sitesProcessed}, Failed: ${sitesFailedCount}.`,
      );
    } else {
      jobLogger.info(
        `[${POD_ID}] ${jobName} finished. Updated: ${sitesProcessed}.`,
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const schedule = "0 2,10,18 * * *"; // 3× daily: 02:00, 10:00, 18:00 Nairobi time

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
