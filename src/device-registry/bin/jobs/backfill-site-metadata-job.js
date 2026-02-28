const cron = require("node-cron");
const SiteModel = require("@models/Site");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-site-metadata-job`,
);
const { logObject, logText, HttpError } = require("@utils/shared");
const createSiteUtil = require("@utils/site.util");
const httpStatus = require("http-status");

const BATCH_SIZE = 100;

// Module-level lock to prevent overlapping cron runs. If the job takes longer
// than its schedule interval (1 hour), the next tick is skipped entirely rather
// than spawning a concurrent execution that would contend on the same records.
let isBackfillRunning = false;

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;
  try {
    logger.info(`*** Starting ${jobName}...`);
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
          // FIX: Each condition now covers three cases:
          //   1. Key is entirely absent ({ $exists: false })
          //   2. Key exists but is null
          //   3. Key exists but is an empty string ("")
          // Previously only case 1 was matched, so sites with null or ""
          // metadata were silently skipped by the backfill.
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
      `*** ${jobName} finished. Total sites updated: ${sitesProcessed}`,
    );
  } catch (error) {
    logger.error(`🐛🐛 Error in ${jobName}: ${error.message}`);
  }
};

const schedule = "0 */1 * * *"; // Every hour

// Gate cron.schedule behind BACKFILL_SITE_METADATA_SCHEDULER_ENABLED so only
// one designated service instance runs the job. Without this, every instance
// of device-registry schedules an independent cron, causing duplicate
// backfillSiteMetadata runs on each tick.
if (process.env.BACKFILL_SITE_METADATA_SCHEDULER_ENABLED === "true") {
  logger.info(
    "BACKFILL_SITE_METADATA_SCHEDULER_ENABLED=true — this instance will run the backfill cron job.",
  );
  cron.schedule(
    schedule,
    async () => {
      // FIX: Guard against overlapping runs. If the previous execution is still
      // in progress when the next tick fires, skip and log rather than spawning
      // a concurrent run that would contend on the same site records.
      // Note: this is an in-memory flag and only prevents overlap within a
      // single process. If device-registry runs on multiple nodes, replace this
      // with a distributed lock (Redis/DB) keyed to the job name.
      if (isBackfillRunning) {
        logger.info(
          "Backfill job is already running — skipping this tick to prevent overlap.",
        );
        return;
      }

      isBackfillRunning = true;
      try {
        await backfillSiteMetadata("airqo");
        logger.info("Backfill cron tick completed successfully.");
      } catch (error) {
        logger.error(`Error running scheduled backfill job: ${error.message}`);
      } finally {
        isBackfillRunning = false;
      }
    },
    {
      scheduled: true,
      timezone: "Africa/Nairobi",
    },
  );

  process.on("SIGTERM", () => {
    logger.info("SIGTERM received — scheduler shutting down.");
  });
  process.on("SIGINT", () => {
    logger.info("SIGINT received — scheduler shutting down.");
  });
} else {
  logger.info(
    "BACKFILL_SITE_METADATA_SCHEDULER_ENABLED is not 'true' — skipping cron registration for backfill job.",
  );
}

module.exports = backfillSiteMetadata;
