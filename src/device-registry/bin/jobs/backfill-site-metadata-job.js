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

const backfillSiteMetadata = async (tenant) => {
  const jobName = `backfill-site-metadata-${tenant}`;
  try {
    logger.info(`*** Starting ${jobName}...`);
    let skip = 0;
    let sitesProcessed = 0;

    while (true) {
      const sitesToUpdate = await SiteModel(tenant)
        .find({
          $or: [
            { country: { $exists: false } },
            { district: { $exists: false } },
            { city: { $exists: false } },
            { data_provider: { $exists: false } },
          ],
          latitude: { $ne: null },
          longitude: { $ne: null },
        })
        .limit(BATCH_SIZE)
        .skip(skip)
        .select("_id latitude longitude name")
        .lean();

      if (sitesToUpdate.length === 0) {
        logger.info("No more sites to backfill. Job complete.");
        break;
      }

      logger.info(
        `Processing batch of ${sitesToUpdate.length} sites (skip: ${skip})`,
      );

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
            await SiteModel(tenant).findByIdAndUpdate(site._id, {
              $set: metadataResponse.data,
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

      skip += BATCH_SIZE;
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
