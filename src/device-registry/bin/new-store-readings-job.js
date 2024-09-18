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

function isEntityActive(entity) {
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes in milliseconds

  if (!entity || !entity.lastActive) {
    return false;
  }

  const now = new Date();
  const lastActiveDate = new Date(entity.lastActive);

  return now.getTime() - lastActiveDate.getTime() < inactiveThreshold;
}

async function updateEntityLastActive(Model, filter, time) {
  try {
    const entity = await Model.findOne(filter);
    if (entity) {
      if (isEntityActive(entity)) {
        // Entity is still active, no need to update
        return;
      }

      await Model.updateOne(filter, { lastActive: time });
    }
  } catch (error) {
    logObject("Error updating entity's lastActive", error);
    logger.error(`Error updating entity's lastActive: ${jsonify(error)}`);
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

    // Check if viewEventsResponse is defined and has the expected structure
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

      // Insert each batch in the 'readings' collection with retry logic
      for (const batch of batches) {
        await Promise.all(
          batch.map(async (doc) => {
            await asyncRetry(
              async (bail) => {
                try {
                  // Update Site lastActive
                  await updateEntityLastActive(
                    SiteModel("airqo"),
                    { _id: doc.site_id },
                    doc.time
                  );

                  // Update Device lastActive
                  await updateEntityLastActive(
                    DeviceModel("airqo"),
                    { _id: doc.device_id },
                    doc.time
                  );

                  // Update Reading
                  const filter = { site_id: doc.site_id, time: doc.time };
                  const updateDoc = { ...doc };
                  delete updateDoc._id;
                  await ReadingModel("airqo").updateOne(filter, updateDoc, {
                    upsert: true,
                  });
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
                retries: 3, // Number of retry attempts
                minTimeout: 1000, // Initial delay between retries (in milliseconds)
                factor: 2, // Exponential factor for increasing delay between retries
              }
            );
          })
        );
      }
      logText(`All data inserted successfully`);
      return;
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
      return;
    }
  } catch (error) {
    logObject("error", error);
    logger.error(`🐛🐛 Internal Server Error ${jsonify(error)}`);
    return;
  }
};

const schedule = "30 * * * *";
cron.schedule(schedule, fetchAndStoreDataIntoReadingsModel, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
