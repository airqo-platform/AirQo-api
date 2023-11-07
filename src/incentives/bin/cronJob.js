const cron = require("node-cron");
const SimModel = require("@models/Sim");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/cronJob script`
);
const checkStatus = require("@utils/create-sim").checkStatus;
const secondsDelayBetweenRequests = 20000;
const internetDataBalanceThreshold = 5;
const schedule =
  constants.ENVIRONMENT === "PRODUCTION ENVIRONMENT"
    ? "0 0 * * *"
    : "0 14 * * *";

cron.schedule(
  schedule,
  async () => {
    try {
      const batchSize = 100; // Process 100 SIM cards at a time
      let skip = 0;

      const simCards = await SimModel("airqo").find({}).select("_id").lean();

      while (true) {
        const simBatch = simCards.slice(skip, skip + batchSize);

        if (simBatch.length === 0) {
          break;
        }

        await processSimCardsWithDelay(simBatch);

        skip += batchSize;
      }
    } catch (error) {
      logger.error(
        `An error occurred in the cron job --- ${JSON.stringify(error)}`
      );
    }
  },
  {
    scheduled: true,
    timezone: "Africa/Nairobi",
  }
);

async function processSimCardsWithDelay(simBatch) {
  for (const sim of simBatch) {
    const responseFromCheckStatus = await checkStatus({
      query: { tenant: "airqo" },
      params: { sim_id: sim._id },
    });

    // Check if data.balance is less than the declared threshold and log it
    if (
      responseFromCheckStatus.success &&
      responseFromCheckStatus.data.balance < internetDataBalanceThreshold
    ) {
      logger.info(
        `SIM card ${sim.msisdn} has a balance less than ${internetDataBalanceThreshold} threshold`
      );
    }
    await new Promise((resolve) =>
      setTimeout(resolve, secondsDelayBetweenRequests)
    );
  }
}
