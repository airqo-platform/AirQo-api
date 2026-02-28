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

const MAX_METADATA_FAILURES = 3;

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;
  try {
    logger.info(`*** Starting ${jobName}...`);
    let sitesProcessed = 0;

    while (true) {
      // The two $or conditions must be combined under $and so both apply.
      // Without $and, the second $or would silently override the first in
      // MongoDB's query parser, meaning the "missing metadata" condition
      // would be dropped entirely.
      const sitesToUpdate = await SiteModel(tenant)
        .find({
          $and: [
            {
              $or: [
                { country: { $exists: false } },
                { district: { $exists: false } },
                { city: { $exists: false } },
                { data_provider: { $exists: false } },
              ],
            },
            {
              // Exclude sites that have repeatedly failed enrichment.
              // Without this, sites whose reverse geocoding always fails
              // (e.g. coordinates in an area with no Google address data)
              // are fetched on every cron run, causing an endless
              // "reverseGeoCode..........." log stream and burning API quota.
              $or: [
                { metadata_backfill_failures: { $exists: false } },
                { metadata_backfill_failures: { $lt: MAX_METADATA_FAILURES } },
              ],
            },
          ],
          latitude: { $ne: null },
          longitude: { $ne: null },
        })
        .limit(BATCH_SIZE)
        .select("_id latitude longitude name network")
        .lean();

      if (sitesToUpdate.length === 0) {
        logger.info("No more sites to backfill. Job complete.");
        break;
      }

      logger.info(`Processing batch of ${sitesToUpdate.length} sites`);

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
                // Reset failure counter on success so temporarily-failing
                // sites (e.g. during a Google API outage) are not permanently
                // blacklisted once the underlying issue resolves.
                metadata_backfill_failures: 0,
                metadata_backfill_last_success: new Date(),
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
            // Increment failure counter to eventually exclude this site from
            // future runs once MAX_METADATA_FAILURES is reached.
            await SiteModel(tenant).findByIdAndUpdate(site._id, {
              $inc: { metadata_backfill_failures: 1 },
              $set: { metadata_backfill_last_attempted: new Date() },
            });
            return { success: false, siteId: site._id };
          }
        } catch (error) {
          logger.error(`Error processing site ${site._id}: ${error.message}`);
          await SiteModel(tenant).findByIdAndUpdate(site._id, {
            $inc: { metadata_backfill_failures: 1 },
            $set: { metadata_backfill_last_attempted: new Date() },
          });
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

cron.schedule(
  schedule,
  async () => {
    try {
      await backfillSiteMetadata("airqo");
    } catch (error) {
      logger.error(`Error running scheduled backfill job: ${error.message}`);
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  },
);

module.exports = backfillSiteMetadata;
