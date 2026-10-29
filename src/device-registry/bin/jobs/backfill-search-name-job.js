const cron = require("node-cron");
const SiteModel = require("@models/Site");
const DeviceModel = require("@models/Device");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const createSiteUtil = require("@utils/site.util");
const os = require("os");

// Per-site operational logger — uses the default category.
// WARN and ERROR stay in file/console only; ERROR still reaches Slack via the
// default slackErrors appender. Individual site failures must NOT flood Slack.
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-search-name-job`,
);

// Job-level summary logger — uses ops-alerts category (WARN and above → Slack).
// Only job-run summaries and structural alerts are logged here so Slack
// receives a single consolidated message per run, never per-site noise.
const jobLogger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-search-name-job -- ops-alerts`,
);

const BATCH_SIZE = 50;
// Hard cap on total geocoding attempts per run, split across the two phases
// below. Keeps each run short and predictable regardless of backlog size.
const MAX_ATTEMPTS_PER_RUN = 500;
const JOB_NAME = "backfill-search-name";
const LOCK_TTL_SECONDS = 60 * 60; // 60 minutes
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

// { field: { $in: [null, ""] } } matches missing, null, AND empty-string
// values in MongoDB (querying null matches missing fields too), so this is
// equivalent to the three-way $or version but — critically — is a plain
// equality/$in predicate that the `search_name_1__id_1` index below can
// serve directly, instead of forcing a collection scan.
const MISSING_SEARCH_NAME_FILTER = {
  search_name: { $in: [null, ""] },
};

/**
 * Runs the original search_name derivation (createSiteUtil.generateMetadata
 * → reverseGeoCode → retrieveInformationFromAddress / _parseNominatimAddress)
 * for a single site and writes search_name if — and only if — the site is
 * still missing it. Never overwrites an existing value.
 *
 * @returns {"updated"|"skipped"|"failed"}
 */
const backfillOneSite = async (tenant, site) => {
  try {
    const metadataResponse = await createSiteUtil.generateMetadata(
      {
        query: { tenant },
        body: {
          latitude: site.latitude,
          longitude: site.longitude,
          network: site.network || "airqo",
          skipAltitude: true, // this job only cares about search_name
          siteId: site._id.toString(),
        },
      },
      (err) => {
        throw err;
      },
    );

    if (!metadataResponse || metadataResponse.success !== true) {
      logger.warn(
        `[${POD_ID}] Geocoding failed for site ${site.name} (${site._id}): ${
          metadataResponse && metadataResponse.message
        }`,
      );
      return "failed";
    }

    let { search_name } = metadataResponse.data;

    // Same secondary fallback createSite.refresh() applies, for the rare case
    // the geocoder returned other location fields but no sublocality-derived
    // search_name.
    if (isEmpty(search_name)) {
      const { town, street, city, district } = metadataResponse.data;
      search_name = town || street || city || district;
    }

    if (isEmpty(search_name)) {
      logger.warn(
        `[${POD_ID}] No search_name could be derived for site ${site.name} (${site._id}).`,
      );
      return "failed";
    }

    const writeResult = await SiteModel(tenant).collection.updateOne(
      { _id: site._id, ...MISSING_SEARCH_NAME_FILTER },
      { $set: { search_name } },
    );

    if (writeResult && writeResult.matchedCount === 0) {
      // Already repaired by another process (or another phase this run) —
      // treat as success, nothing more to do.
      return "skipped";
    }

    return "updated";
  } catch (error) {
    logger.error(
      `[${POD_ID}] Error processing site ${site._id}: ${error.message}`,
    );
    return "failed";
  }
};

/**
 * Processes up to `remainingBudget` sites matching `extraFilter` (in addition
 * to the missing-search_name filter) in BATCH_SIZE chunks, cursor-paginated
 * by _id.
 *
 * @returns {Promise<{attempted: number, updated: number, failed: number, skipped: number}>}
 */
const processSites = async (tenant, extraFilter, remainingBudget) => {
  let attempted = 0;
  let updated = 0;
  let failed = 0;
  let skipped = 0;
  let lastProcessedId = null;

  while (attempted < remainingBudget) {
    // extraFilter and the cursor both key off `_id` in the deployed-site
    // phase ({_id: {$in: [...]}} plus {_id: {$gt: cursor}}) — object-spread
    // would let the later one silently clobber the former, so combine them
    // with $and instead of merging into one object.
    const conditions = [MISSING_SEARCH_NAME_FILTER, extraFilter];
    if (lastProcessedId) conditions.push({ _id: { $gt: lastProcessedId } });
    const limit = Math.min(BATCH_SIZE, remainingBudget - attempted);

    const sites = await SiteModel(tenant).find(
      { $and: conditions },
      { _id: 1, name: 1, latitude: 1, longitude: 1, network: 1 },
      { sort: { _id: 1 }, limit, lean: true },
    );

    if (sites.length === 0) break;
    lastProcessedId = sites[sites.length - 1]._id;

    // Sequential processing — one geocoding call at a time to stay within
    // external API rate limits.
    for (const site of sites) {
      const outcome = await backfillOneSite(tenant, site);
      attempted++;
      if (outcome === "updated") updated++;
      else if (outcome === "skipped") skipped++;
      else failed++;
    }
  }

  return { attempted, updated, failed, skipped };
};

/**
 * Ensures search_name is populated on every site, prioritizing sites that
 * have at least one actively deployed device — those are the sites that
 * matter most for search/lookup right now. Any remaining per-run budget then
 * spills over to sites without a deployed device, so the whole collection is
 * eventually covered.
 */
const backfillSearchName = async (tenant) => {
  const jobName = `backfill-search-name-${tenant}`;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) return;

  try {
    // Sites with at least one actively deployed device take priority.
    const deployedSiteIds = await DeviceModel(tenant).distinct("site_id", {
      isActive: true,
      site_id: { $exists: true, $ne: null },
    });

    const deployedResult = await processSites(
      tenant,
      deployedSiteIds.length > 0
        ? { _id: { $in: deployedSiteIds } }
        : { _id: { $in: [] } },
      MAX_ATTEMPTS_PER_RUN,
    );

    // No $nin exclusion list here: sites phase 1 just fixed no longer match
    // MISSING_SEARCH_NAME_FILTER, so they're naturally skipped without
    // Mongo having to test every candidate against a deployed-site-sized
    // array (which would only get more expensive as the fleet grows). A
    // handful of sites that phase 1 failed on may be retried here — bounded
    // by remainingBudget, not a scaling concern.
    const remainingBudget = MAX_ATTEMPTS_PER_RUN - deployedResult.attempted;
    let otherResult = { attempted: 0, updated: 0, failed: 0, skipped: 0 };
    if (remainingBudget > 0) {
      otherResult = await processSites(tenant, {}, remainingBudget);
    }

    const totals = {
      attempted: deployedResult.attempted + otherResult.attempted,
      updated: deployedResult.updated + otherResult.updated,
      failed: deployedResult.failed + otherResult.failed,
      skipped: deployedResult.skipped + otherResult.skipped,
    };

    if (totals.failed > 0) {
      jobLogger.warn(
        `[${POD_ID}] ${jobName} finished. Deployed-site sites updated: ${deployedResult.updated}, ` +
          `other sites updated: ${otherResult.updated}, failed: ${totals.failed}, skipped: ${totals.skipped}.`,
      );
    } else {
      jobLogger.info(
        `[${POD_ID}] ${jobName} finished. Deployed-site sites updated: ${deployedResult.updated}, ` +
          `other sites updated: ${otherResult.updated}, skipped: ${totals.skipped}.`,
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const schedule = "30 3,11,19 * * *"; // 3× daily, offset from backfill-site-metadata-job

if (constants.BACKFILL_SEARCH_NAME_SCHEDULER_ENABLED === true) {
  cron.schedule(
    schedule,
    async () => {
      await backfillSearchName("airqo");
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

module.exports = backfillSearchName;
