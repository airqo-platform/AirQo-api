const cron = require("node-cron");
const SiteModel = require("@models/Site");
const JobLockModel = require("@models/JobLock");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-site-metadata-job`,
);
const createSiteUtil = require("@utils/site.util");
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
 * Runs a single altitude call before each batch fires.
 * If it fails, sets altitudeCircuitOpen = true so that all 100
 * concurrent promises in the batch already have skipAltitude = true
 * before they start — guaranteeing at most ONE altitude error log
 * per batch rather than one per site.
 *
 * Without this, Promise.allSettled fires all 100 promises simultaneously.
 * By the time the first one trips the circuit breaker flag, the other 99
 * have already called generateMetadata with skipAltitude = false,
 * producing 100 identical error logs.
 */
const runAltitudePreflightCheck = async (site, altitudeCircuitOpen) => {
  if (altitudeCircuitOpen) return true;

  try {
    const testResponse = await createSiteUtil.getAltitude(
      site.latitude,
      site.longitude,
      (err) => err,
    );

    if (!testResponse || typeof testResponse !== "object") {
      logger.error(
        `[${POD_ID}] Altitude API pre-flight check returned an unexpected value — ` +
          `opening circuit breaker for this batch. ` +
          `Check GOOGLE_MAPS_API_KEY: kubectl exec -it <pod> -n <namespace> -- printenv GOOGLE_MAPS_API_KEY`,
      );
      return true;
    }

    if (testResponse.success === false) {
      const safeError = {
        code: testResponse.errors?.message?.code,
        message: testResponse.errors?.message?.message,
      };
      logger.error(
        `[${POD_ID}] Altitude API pre-flight check failed — skipping altitude ` +
          `enrichment for this entire batch to suppress duplicate errors. ` +
          `Safe error: ${JSON.stringify(safeError)}. ` +
          `Check GOOGLE_MAPS_API_KEY: kubectl exec -it <pod> -n <namespace> -- printenv GOOGLE_MAPS_API_KEY`,
      );
      return true;
    }

    return false;
  } catch (error) {
    const safeError = {
      code: error.code,
      message: error.message,
    };
    logger.error(
      `[${POD_ID}] Altitude API pre-flight check threw an unexpected error — ` +
        `opening circuit breaker to suppress duplicate errors for this batch. ` +
        `Safe error: ${JSON.stringify(safeError)}. ` +
        `Check GOOGLE_MAPS_API_KEY: kubectl exec -it <pod> -n <namespace> -- printenv GOOGLE_MAPS_API_KEY`,
    );
    return true;
  }
};

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;

  const lockAcquired = await acquireLock(tenant);
  if (!lockAcquired) {
    return;
  }

  try {
    let sitesProcessed = 0;
    let sitesFailedCount = 0;
    const attemptedIds = [];

    // Circuit breaker for the Google Maps Elevation API.
    // Scoped to this job run — resets automatically on the next cron tick.
    // Tripped by the pre-flight check at the start of each batch so that
    // all concurrent promises skip altitude before they even start,
    // guaranteeing at most one error log per batch instead of one per site.
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
        break;
      }

      const batchIds = sitesToUpdate.map((s) => s._id);
      attemptedIds.push(...batchIds);

      // Run the pre-flight check BEFORE firing Promise.allSettled so that
      // the circuit breaker state is fully resolved before any of the 100
      // concurrent promises read it. This is the key guarantee — without
      // awaiting this first, all promises read altitudeCircuitOpen = false
      // simultaneously and all 100 make failing altitude calls.
      altitudeCircuitOpen = await runAltitudePreflightCheck(
        sitesToUpdate[0],
        altitudeCircuitOpen,
      );

      const updatePromises = sitesToUpdate.map(async (site) => {
        try {
          const request = {
            query: { tenant },
            body: {
              latitude: site.latitude,
              longitude: site.longitude,
              network: site.network || "airqo",
              skipAltitude: altitudeCircuitOpen,
            },
          };

          const metadataResponse = await createSiteUtil.generateMetadata(
            request,
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
            return { success: true };
          } else {
            logger.error(
              `[${POD_ID}] Failed to generate metadata for site ${site.name}: ${metadataResponse.message}`,
            );
            return { success: false, siteId: site._id };
          }
        } catch (error) {
          logger.error(
            `[${POD_ID}] Error processing site ${site._id}: ${error.message}`,
          );
          return { success: false, siteId: site._id };
        }
      });

      const results = await Promise.allSettled(updatePromises);
      const batchSuccesses = results.filter(
        (r) => r.status === "fulfilled" && r.value.success,
      ).length;
      const batchFailures = results.length - batchSuccesses;
      sitesProcessed += batchSuccesses;
      sitesFailedCount += batchFailures;
    }

    if (sitesFailedCount > 0) {
      logger.error(
        `[${POD_ID}] ${jobName} finished. Updated: ${sitesProcessed}, Failed: ${sitesFailedCount}.`,
      );
    }

    if (altitudeCircuitOpen) {
      logger.error(
        `[${POD_ID}] Altitude enrichment was skipped for this entire run. ` +
          `Fix GOOGLE_MAPS_API_KEY and altitude data will be populated on the next run.`,
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  } finally {
    await releaseLock(tenant);
  }
};

const schedule = "20 * * * *"; // Every hour at minute 20

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
