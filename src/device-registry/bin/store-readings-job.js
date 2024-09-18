const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/store-readings-job`
);
const EventModel = require("@models/Event");
const ReadingModel = require("@models/Reading");
const { logText, logObject } = require("@utils/log");
const jsonify = require("@utils/jsonify");
const asyncRetry = require("async-retry");
const generateFilter = require("@utils/generate-filter");
const cron = require("node-cron");

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
    // Fetch the data
    const viewEventsResponse = await EventModel("airqo").fetch(filter);
    logText("we are running running the data insertion script");

    if (viewEventsResponse.success === true) {
      const data = viewEventsResponse.data[0].data;
      if (!data) {
        logText(`🐛🐛 Didn't find any Events to insert into Readings`);
        logger.error(`🐛🐛 Didn't find any Events to insert into Readings`);
        return {
          success: true,
          message: `🐛🐛 Didn't find any Events to insert into Readings`,
          status: httpStatus.OK,
        };
      }
      // Prepare the data for batch insertion
      const batchSize = 50; // Adjust this value based on your requirements
      const batches = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
      }

      // Insert each batch in the 'readings' collection with retry logic
      for (const batch of batches) {
        for (const doc of batch) {
          await asyncRetry(
            async (bail) => {
              try {
                // logObject("document", doc);
                const filter = { site_id: doc.site_id, time: doc.time };
                const updateDoc = { ...doc };
                delete updateDoc._id; // Remove the _id field
                const res = await ReadingModel("airqo").updateOne(
                  filter,
                  updateDoc,
                  {
                    upsert: true,
                  }
                );
                // logObject("res", res);
                // logObject("Number of documents updated", res.modifiedCount);
              } catch (error) {
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
        }
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
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    return;
  }
};

const schedule = "30 * * * *";
cron.schedule(schedule, fetchAndStoreDataIntoReadingsModel, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});
