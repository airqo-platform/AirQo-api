const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/new-store-readings-job`
);
const EventModel = require("@models/Event");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const ReadingModel = require("@models/Reading");
const { logText, logObject } = require("@utils/log");
const jsonify = require("@utils/jsonify");
const asyncRetry = require("async-retry");
const generateFilter = require("@utils/generate-filter");
const cron = require("node-cron");
const moment = require("moment-timezone");
const TIMEZONE = moment.tz.guess();
const INACTIVE_THRESHOLD = 5 * 60 * 60 * 1000; // 5 hours in milliseconds

function isEntityActive(entity, time) {
  const inactiveThreshold = INACTIVE_THRESHOLD;

  if (!entity || !entity.lastActive) {
    return false;
  }
  const currentTime = moment()
    .tz(TIMEZONE)
    .toDate();
  const measurementTime = moment(time)
    .tz(TIMEZONE)
    .toDate();
  return currentTime - measurementTime < inactiveThreshold;
}

async function updateEntityStatus(Model, filter, time, entityType) {
  try {
    const entity = await Model.findOne(filter);
    if (entity) {
      const isActive = isEntityActive(entity, time);
      const updateData = {
        lastActive: moment(time)
          .tz(TIMEZONE)
          .toDate(),
        isOnline: isActive,
      };

      const updateResult = await Model.updateOne(filter, updateData);
      logger.info(
        `Updated ${entityType} status. IsOnline: ${isActive}. Result: ${jsonify(
          updateResult
        )}`
      );
    } else {
      logger.warn(`${entityType} not found with filter: ${jsonify(filter)}`);
    }
  } catch (error) {
    logger.error(`Error updating ${entityType}'s status: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
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
      logger.warn(`Document missing site_id: ${jsonify(doc)}`);
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
      logger.warn(`Document missing device_id: ${jsonify(doc)}`);
    }

    // Wait for both updates to complete
    await Promise.all(updatePromises);

    // Update Reading
    const filter = { site_id: doc.site_id, time: docTime.toDate() };
    const updateDoc = { ...doc, time: docTime.toDate() };
    delete updateDoc._id;
    await ReadingModel("airqo").updateOne(filter, updateDoc, {
      upsert: true,
    });
  } catch (error) {
    logger.error(`Error processing document: ${error.message}`);
    logger.error(`Error processing document, Stack trace: ${error.stack}`);
  }
}

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

    let viewEventsResponse;
    try {
      viewEventsResponse = await EventModel("airqo").fetch(filter);
      logText("Running the data insertion script");
    } catch (fetchError) {
      logger.error(`Error fetching events: ${jsonify(fetchError)}`);
      return;
    }

    if (!viewEventsResponse || typeof viewEventsResponse !== "object") {
      logger.error(
        `Unexpected response from EventModel.fetch(): ${jsonify(
          viewEventsResponse
        )}`
      );
      return;
    }

    if (viewEventsResponse.success === true) {
      if (
        !viewEventsResponse.data ||
        !Array.isArray(viewEventsResponse.data) ||
        viewEventsResponse.data.length === 0
      ) {
        logText("No data found in the response");
        return;
      }
      const data = viewEventsResponse.data[0].data;
      if (!data || data.length === 0) {
        logText("No Events found to insert into Readings");
        logger.error(`🐛🐛 Didn't find any Events to insert into Readings`);
        return;
      }

      const batchSize = 50;
      const batches = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
      }

      for (const batch of batches) {
        await Promise.all(
          batch.map(async (doc) => {
            await asyncRetry(
              async (bail) => {
                try {
                  await processDocument(doc);
                } catch (error) {
                  logObject("the error inside processing of batches", error);
                  if (error.name === "MongoError" && error.code !== 11000) {
                    logger.error(
                      `🐛🐛 MongoError -- fetchAndStoreDataIntoReadingsModel -- ${jsonify(
                        error
                      )}`
                    );
                    throw error; // Retry the operation
                  } else if (error.code === 11000) {
                    // Ignore duplicate key errors
                    console.warn(
                      `Duplicate key error for document: ${jsonify(doc)}`
                    );
                  }
                }
              },
              {
                retries: 3,
                minTimeout: 1000,
                factor: 2,
              }
            );
          })
        );
      }
      logText(`All data inserted successfully`);
    } else {
      logObject(
        `🐛🐛 Unable to retrieve Events to insert into Readings`,
        viewEventsResponse
      );
      logger.error(
        `🐛🐛 Unable to retrieve Events to insert into Readings -- ${jsonify(
          viewEventsResponse
        )}`
      );
      logText(`🐛🐛 Unable to retrieve Events to insert into Readings`);
    }
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 Internal Server Error ${jsonify(error)}`);
  }
};

const schedule = "*/30 * * * *";
cron.schedule(schedule, fetchAndStoreDataIntoReadingsModel, {
  scheduled: true,
  timezone: TIMEZONE,
});
