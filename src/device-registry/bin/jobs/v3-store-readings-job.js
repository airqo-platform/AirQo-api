const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/v3-store-readings-job`
);
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const { logText, logObject } = require("@utils/log");
const stringify = require("@utils/stringify");
const asyncRetry = require("async-retry");
const generateFilter = require("@utils/generate-filter");
const cron = require("node-cron");
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds
const BATCH_SIZE = 50;

function logDocumentDetails(doc) {
  const deviceId = doc.device_id || "N/A";
  const device = doc.device || "N/A";
  const time = doc.time || "N/A";
  const siteId = doc.site_id || "N/A";
  const site = doc.site || "N/A";
  logger.warn(
    `🙀🙀 Measurement missing some key details: { time: ${time}, device_id: ${deviceId}, device: ${device}, site_id: ${siteId}, site: ${site}}`
  );
}

async function updateEntityStatus(Model, filter, time, entityType) {
  try {
    const currentTime = moment()
      .tz(TIMEZONE)
      .toDate();
    const updateData = {
      lastActive: currentTime,
      isOnline:
        currentTime -
          moment(time)
            .tz(TIMEZONE)
            .toDate() <
        INACTIVE_THRESHOLD,
    };

    const result = await Model.findOneAndUpdate(filter, updateData, {
      new: true,
      upsert: false,
    });

    if (!result) {
      logger.warn(
        `🙀🙀 ${entityType} not found with filter: ${stringify(filter)}`
      );
    }
  } catch (error) {
    logger.error(
      `🐛🐛 Error updating ${entityType}'s status: ${error.message}`
    );
    logger.error(`🐛🐛 Stack trace: ${error.stack}`);
  }
}
async function processDocument(doc) {
  try {
    const docTime = moment(doc.time).tz(TIMEZONE);

    const updatePromises = [];

    if (doc.site_id) {
      updatePromises.push(
        updateEntityStatus(
          SiteModel("airqo"),
          { _id: doc.site_id },
          docTime.toDate(),
          "Site"
        )
      );
    } else {
      logDocumentDetails(doc);
    }

    if (doc.device_id) {
      updatePromises.push(
        updateEntityStatus(
          DeviceModel("airqo"),
          { _id: doc.device_id },
          docTime.toDate(),
          "Device"
        )
      );
    } else {
      logDocumentDetails(doc);
    }

    // Update Reading
    const filter = { site_id: doc.site_id, time: docTime.toDate() };
    const { _id, ...docWithoutId } = doc;
    const updateDoc = { ...docWithoutId, time: docTime.toDate() };

    updatePromises.push(
      ReadingModel("airqo").updateOne(filter, updateDoc, { upsert: true })
    );
    try {
      await Promise.all(updatePromises);
    } catch (error) {
      logger.error(`🐛🐛 Error processing document: ${error.message}`);
    }
  } catch (error) {
    logger.error(`🐛🐛 Error processing document: ${error.message}`);
  }
}
const fetchAllData = async (
  Model,
  filter = {},
  projection = {},
  pageSize = 100,
  isEventModel = false
) => {
  const allData = [];
  let page = 0;
  let hasMoreData = true;

  while (hasMoreData) {
    try {
      let response;

      if (isEventModel) {
        response = await Model("airqo").fetch({
          ...filter,
          limit: pageSize,
          skip: page * pageSize,
        });

        if (
          !response.success ||
          !response.data ||
          response.data.length === 0 ||
          !response.data[0].data ||
          response.data[0].data.length === 0
        ) {
          hasMoreData = false;
        } else {
          allData.push(...response.data[0].data);
        }
      } else {
        const entities = await Model("airqo")
          .find(filter, projection)
          .limit(pageSize)
          .skip(page * pageSize);

        if (entities.length === 0) {
          hasMoreData = false;
        } else {
          allData.push(...entities);
        }
      }

      page++;
    } catch (error) {
      logger.error(`🐛🐛 Error fetching data: ${error.message}`);
      hasMoreData = false;
    }
  }

  return allData;
};
const fetchAndStoreDataIntoReadingsModel = async () => {
  try {
    const request = {
      query: {
        tenant: "airqo",
        recent: "yes",
        metadata: "site_id",
        active: "yes",
        brief: "yes",
      },
    };
    const filter = generateFilter.fetch(request);

    // Usage examples
    const allEvents = await fetchAllData(EventModel, filter, {}, 100, true);

    if (!allEvents || allEvents.length === 0) {
      logText("🙀🙀 No Events found to insert into Readings");
      logger.warn(`🙀🙀 Didn't find any Events to insert into Readings`);
      return;
    }

    const activeDeviceIds = new Set();
    const activeSiteIds = new Set();

    // Process events in batches
    for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
      const batch = allEvents.slice(i, i + BATCH_SIZE);

      await asyncRetry(
        async (bail) => {
          try {
            // Process each document in the current batch
            await Promise.all(
              batch.map(async (doc) => {
                if (doc.device_id) activeDeviceIds.add(doc.device_id);
                if (doc.site_id) activeSiteIds.add(doc.site_id);
                await processDocument(doc);
              })
            );
          } catch (error) {
            logObject("the error inside processing of batches", error);
            if (error.name === "MongoError" && error.code !== 11000) {
              logger.error(
                `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${stringify(
                  error
                )}`
              );
              throw error; // Retry the operation
            } else if (error.code === 11000) {
              // Ignore duplicate key errors
              console.warn(
                `🙀🙀 Duplicate key error for document: ${stringify(doc)}`
              );
            }
          }
        },
        {
          retries: 3, // Number of retry attempts for the entire batch
          minTimeout: 1000, // Initial delay between retries
          factor: 2, // Exponential factor for increasing delay
        }
      );
    }

    // Fetch all devices and sites
    const allDevices = await fetchAllData(
      DeviceModel,
      {},
      { _id: 1, isOnline: 1, lastActive: 1 }
    );
    const allSites = await fetchAllData(
      SiteModel,
      {},
      { _id: 1, isOnline: 1, lastActive: 1 }
    );

    // Prepare update promises for devices
    const deviceUpdatePromises = allDevices.map((device) => {
      if (!activeDeviceIds.has(device._id.toString())) {
        return updateEntityStatus(
          DeviceModel("airqo"),
          { _id: device._id },
          moment()
            .tz(TIMEZONE)
            .toDate(),
          "Device"
        );
      }
      return Promise.resolve(); // No update needed
    });

    // Prepare update promises for sites
    const siteUpdatePromises = allSites.map((site) => {
      if (!activeSiteIds.has(site._id.toString())) {
        return updateEntityStatus(
          SiteModel("airqo"),
          { _id: site._id },
          moment()
            .tz(TIMEZONE)
            .toDate(),
          "Site"
        );
      }
      return Promise.resolve(); // No update needed
    });

    // Execute all update promises concurrently
    await Promise.all([...deviceUpdatePromises, ...siteUpdatePromises]);
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${stringify(error)}`);
  }
};

const schedule = "30 * * * *";
cron.schedule(schedule, fetchAndStoreDataIntoReadingsModel, {
  scheduled: true,
  timezone: TIMEZONE,
});
