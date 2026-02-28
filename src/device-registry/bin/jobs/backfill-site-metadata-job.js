const cron = require("node-cron");
const SiteModel = require("@models/Site");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-site-metadata-job`,
);
const { HttpError } = require("@utils/shared");
const createSiteUtil = require("@utils/site.util");
const httpStatus = require("http-status");
const os = require("os");

const BATCH_SIZE = 100;
const JOB_NAME = "backfill-site-metadata";

// How long the lock is valid for. If the pod crashes without releasing
// the lock, MongoDB TTL will clean it up after this many seconds,
// unblocking the next cron tick.
const LOCK_TTL_SECONDS = 90 * 60; // 90 minutes — comfortably longer than one run

// Unique identifier for this pod so logs clearly show which instance
// holds the lock at any given time.
const POD_ID = process.env.HOSTNAME || os.hostname();

/**
 * Attempts to acquire a distributed lock in MongoDB.
 * Uses findOneAndUpdate with upsert so the operation is atomic —
 * only one pod can win even when multiple pods fire simultaneously.
 *
 * @param {string} tenant
 * @returns {boolean} true if this pod acquired the lock, false otherwise
 */
const acquireLock = async (tenant) => {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_TTL_SECONDS * 1000);

  try {
    // This is the atomic operation:
    // - Find a joblock document where jobName matches AND it does not
    //   already exist (i.e. no current lock held by anyone).
    // - If found (or created via upsert), set acquiredBy and expiresAt.
    // - If the document already exists, the $setOnInsert only fires on
    //   insert — a competing pod's existing lock document is left untouched
    //   and the upsert is a no-op, returning null.
    const result = await JobLockModel(tenant).findOneAndUpdate(
      {
        jobName: JOB_NAME,
        // Only match if the lock is not currently held by any pod.
        // expiresAt being in the past means MongoDB TTL hasn't cleaned
        // it yet but it's logically expired — treat as available.
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
      {
        upsert: true,
        new: true,
        // Return null if no document was found (lock already held)
        // rather than throwing
        rawResult: false,
      },
    );

    // If the returned document was acquired by this pod, we won
    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    // A duplicate key error (code 11000) means another pod won the race
    // and inserted the document first — this is expected and not an error.
    if (error.code === 11000) {
      return false;
    }
    // Any other error is unexpected — log and treat as failed to acquire
    logger.error(`🐛🐛 Lock acquisition error: ${error.message}`);
    return false;
  }
};

/**
 * Releases the distributed lock held by this pod.
 * Only deletes the document if this pod is still the owner —
 * prevents a slow pod from releasing a lock that another pod
 * legitimately re-acquired after TTL expiry.
 *
 * @param {string} tenant
 */
const releaseLock = async (tenant) => {
  try {
    await JobLockModel(tenant).findOneAndDelete({
      jobName: JOB_NAME,
      acquiredBy: POD_ID,
    });
    logger.info(`[${POD_ID}] Lock released for job: ${JOB_NAME}`);
  } catch (error) {
    logger.error(`🐛🐛 Lock release error: ${error.message}`);
  }
};

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;

  // Attempt to acquire the distributed lock before doing any work.
  // If another pod is already running the job, skip this tick entirely.
  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    logger.info(
      `[${POD_ID}] Could not acquire lock for ${jobName} — another pod is already running it. Skipping this tick.`,
    );
    return;
  }

  logger.info(`[${POD_ID}] Lock acquired — starting ${jobName}...`);

  try {
    let sitesProcessed = 0;

    // Track every site ID dispatched in this run so that failing sites are
    // excluded from subsequent batches. Without this, sites whose reverse
    // geocoding always fails are re-selected on every loop iteration, creating
    // an infinite loop and an endless stream of "reverseGeoCode..........."
    // log lines.
    const attemptedIds = [];

    while (true) {
      const sitesToUpdate = await SiteModel(tenant)
        .find({
          // Each condition covers three cases:
          //   1. Key is entirely absent ({ $exists: false })
          //   2. Key exists but is null
          //   3. Key exists but is an empty string ("")
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
          latitude: { $ne: null },
          longitude: { $ne: null },
          // Exclude all sites already attempted in this run so the same
          // failing site is never re-selected within a single execution.
          ...(attemptedIds.length > 0 && { _id: { $nin: attemptedIds } }),
        })
        .limit(BATCH_SIZE)
        .select("_id latitude longitude name network")
        .lean();

      if (sitesToUpdate.length === 0) {
        logger.info("No more sites to backfill. Job complete.");
        break;
      }

      logger.info(`Processing batch of ${sitesToUpdate.length} sites`);

      // Collect this batch's IDs and append to attemptedIds before dispatching
      // so that even sites whose promise rejects are excluded from the next query.
      const batchIds = sitesToUpdate.map((s) => s._id);
      attemptedIds.push(...batchIds);

      const updatePromises = sitesToUpdate.map(async (site) => {
        try {
          const request = {
            query: { tenant },
            body: {
              latitude: site.latitude,
              longitude: site.longitude,
              network: site.network || "airqo",
            },
          };

          const metadataResponse = await createSiteUtil.generateMetadata(
            request,
            (err) => {
              throw err;
            },
          );

          if (metadataResponse.success) {
            // Scope the $set to only genuine reverse-geocoding metadata fields.
            // Writing the full metadataResponse.data would clobber fields like
            // generated_name, description, latitude, and longitude that are
            // already correctly set on the site document.
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
              altitude,
              data_provider,
              site_tags,
            } = metadataResponse.data;

            const metadataFields = Object.fromEntries(
              Object.entries({
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
                altitude,
                data_provider,
                site_tags,
              }).filter(([, v]) => v !== undefined),
            );

            await SiteModel(tenant).findByIdAndUpdate(site._id, {
              $set: metadataFields,
            });
            logger.info(
              `Successfully backfilled metadata for site ${site.name}`,
            );
            return { success: true };
          } else {
            logger.error(
              `Failed to generate metadata for site ${site.name}: ${metadataResponse.message}`,
            );
            return { success: false, siteId: site._id };
          }
        } catch (error) {
          logger.error(`Error processing site ${site._id}: ${error.message}`);
          return { success: false, siteId: site._id };
        }
      });

      const results = await Promise.allSettled(updatePromises);
      sitesProcessed += results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;
    }

    logger.info(
      `[${POD_ID}] ${jobName} finished. Total sites updated: ${sitesProcessed}`,
    );
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
    // Always release the lock when done, whether the job succeeded or
    // threw. This allows the next pod to acquire it on the next tick
    // rather than waiting for TTL expiry.
    await releaseLock(tenant);
  }
};

const schedule = "20 * * * *"; // Every hour at minute 20

if (constants.BACKFILL_SITE_METADATA_SCHEDULER_ENABLED === true) {
  logger.info(
    `[${POD_ID}] BACKFILL_SITE_METADATA_SCHEDULER_ENABLED=true — this instance will participate in the backfill cron job.`,
  );
  cron.schedule(
    schedule,
    async () => {
      // Each pod attempts to acquire the DB lock on every tick.
      // Only the winning pod runs the job — the others log and return.
      await backfillSiteMetadata("airqo");
    },
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );

  process.on("SIGTERM", async () => {
    logger.info(
      `[${POD_ID}] SIGTERM received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });

  process.on("SIGINT", async () => {
    logger.info(
      `[${POD_ID}] SIGINT received — releasing lock and shutting down.`,
    );
    await releaseLock("airqo");
  });
} else {
  logger.info(
    "BACKFILL_SITE_METADATA_SCHEDULER_ENABLED is not true — skipping cron registration for backfill job.",
  );
}

module.exports = backfillSiteMetadata;
