const asyncRetry = require("async-retry");
const cron = require("node-cron");
const ReadingModel = require("@models/Reading");
const EventModel = require("@models/Event");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/fetch-and-store-readings`
);
const jsonify = require("@utils/jsonify");
const generateFilter = require("@utils/generate-filter");

function getThreeDaysBackMidnight() {
  const currentDate = new Date();
  currentDate.setDate(currentDate.getDate() - 7);
  currentDate.setUTCHours(0, 0, 0, 0);
  return currentDate;
}
const startTime = getThreeDaysBackMidnight();

async function fetchAndStoreData() {
  try {
    const request = {
      query: {
        frequency: "hourly",
        startTime,
        limit: 1000,
        skip: 0,
        metadata: "site_id",
        recent: "yes",
        tenant: "airqo",
        brief: "yes",
      },
    };

    const filter = generateFilter.readings(request);

    // Fetch the data
    const viewEventsResponse = await EventModel("airqo").view(filter);
    console.log("we are running running the data insertion script");

    if (viewEventsResponse.success === true) {
      const data = viewEventsResponse.data[0].data;
      if (!data) {
        console.log(`🐛🐛 Didn't find any Events to insert into Readings`);
        logger.error(`🐛🐛 Didn't find any Events to insert into Readings`);
        return;
      }
      // Prepare the data for batch insertion
      const batchSize = 30; // Adjust this value based on your requirements
      const batches = [];
      for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
      }

      // Insert each batch in the 'readings' collection with retry logic
      for (const batch of batches) {
        await asyncRetry(
          async (bail) => {
            try {
              const res = await ReadingModel("airqo").insertMany(batch, {
                ordered: false,
              });
              console.log(
                "Number of documents inserted in this batch: " +
                  res.insertedCount
              );
            } catch (error) {
              if (error.name === "MongoError" && error.code === 11000) {
                bail(error); // Stop retrying and throw the error immediately
              }
              // logger.error(`🐛🐛 Internal Server Error -- ${jsonify(error)}`);
              // console.error("Insertion failed, retrying...", error);
              // throw error; // Retry the operation
            }
          },
          {
            retries: 5, // Number of retry attempts
            minTimeout: 1000, // Initial delay between retries (in milliseconds)
            factor: 2, // Exponential factor for increasing delay between retries
          }
        );
      }

      console.log("All data inserted successfully");
    } else {
      console.log(
        `🐛🐛 Unable to retrieve Events to insert into Readings -- ${viewEventsResponse}`
      );
      logger.error(
        `🐛🐛 Unable to retrieve Events to insert into Readings -- ${jsonify(
          viewEventsResponse
        )}`
      );
      return;
    }
  } catch (error) {
    // logger.error(`🐛🐛 Internal Server Error -- ${jsonify(error)}`);
    console.error("Failed to insert data", error);
    return;
  }
}

cron.schedule("*/30 * * * *", () => {
  fetchAndStoreData().catch((error) => {
    logger.error(`🐛🐛 Internal Server Error -- ${jsonify(error)}`);
    console.error("Cron job failed", error);
  });
});
