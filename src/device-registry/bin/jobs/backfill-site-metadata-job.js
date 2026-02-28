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
      {
        upsert: true,
        new: true,
        rawResult: false,
      },
    );

    return result && result.acquiredBy === POD_ID;
  } catch (error) {
    if (error.code === 11000) {
      return false;
    }
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
    logger.info(`[${POD_ID}] Lock released for job: ${JOB_NAME}`);
  } catch (error) {
    logger.error(`🐛🐛 Lock release error: ${error.message}`);
  }
};

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;

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
    const attemptedIds = [];

    // Circuit breaker for the Google Maps Elevation API.
    // ERR_INVALID_CHAR and similar configuration-level errors affect every
    // site identically — there is no point making 100 failing calls when
    // the first failure already tells us altitude enrichment is broken for
    // this entire run. Once tripped, altitude calls are skipped for all
    // remaining sites and a single summary error is logged at the end.
    let altitudeCircuitOpen = false;

    while (true) {
      const sitesToUpdate = await SiteModel(tenant)
        .find({
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
              // Signal to generateMetadata to skip the altitude call for
              // this run if the circuit breaker has already been tripped.
              skipAltitude: altitudeCircuitOpen,
            },
          };

          const metadataResponse = await createSiteUtil.generateMetadata(
            request,
            (err) => {
              // Trip the circuit breaker if this looks like a
              // configuration-level error that will affect all sites.
              if (
                err &&
                (err.code === "ERR_INVALID_CHAR" ||
                  err.code === "ERR_INVALID_URL" ||
                  err.response?.status === 403)
              ) {
                altitudeCircuitOpen = true;
              }
              throw err;
            },
          );

          // If generateMetadata itself flagged an altitude failure via
          // the response, trip the circuit breaker for subsequent sites.
          if (
            metadataResponse.success === false &&
            metadataResponse.altitudeError
          ) {
            altitudeCircuitOpen = true;
          }

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

    // Log a single summary if the altitude circuit was tripped during
    // this run, rather than one error per site.
    if (altitudeCircuitOpen) {
      logger.error(
        `[${POD_ID}] Altitude enrichment was skipped for this run due to a ` +
          `configuration-level error on the first call (e.g. ERR_INVALID_CHAR). ` +
          `Check GOOGLE_MAPS_API_KEY — run: kubectl exec -it <pod> -- printenv GOOGLE_MAPS_API_KEY`,
      );
    }

    logger.info(
      `[${POD_ID}] ${jobName} finished. Total sites updated: ${sitesProcessed}`,
    );
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
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
