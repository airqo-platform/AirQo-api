const cron = require("node-cron");
const TransactionModel = require("@models/Transaction");
const constants = require("@config/constants");
const log4js = require("log4js");
const { stringify } = require("@utils/common");

const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- transaction-amount-fix-job`
);

const TENANT = constants.DEFAULT_TENANT || "airqo";
const BATCH_SIZE = 500;

// Records stored in smallest currency unit (cents) before the /100 fix was
// deployed. Legitimate major-unit amounts for Standard ($50) and Premium ($150)
// will never reach 1000, making this a safe discriminator.
const DIRTY_FILTER = { amount: { $gte: 1000 } };

let isJobRunning = false;

const fixTransactionAmounts = async () => {
  if (isJobRunning) {
    logger.warn("transaction-amount-fix-job already running — skipping tick");
    return;
  }
  isJobRunning = true;

  try {
    // Fast pre-check: exit immediately if there is nothing to fix.
    const dirtyCount = await TransactionModel(TENANT).countDocuments(
      DIRTY_FILTER
    );

    if (dirtyCount === 0) {
      logger.info(
        "transaction-amount-fix-job: all records clean — nothing to do"
      );
      return;
    }

    logger.info(
      `transaction-amount-fix-job: ${dirtyCount} dirty record(s) found — starting fix`
    );

    let totalFixed = 0;

    // Process in batches to avoid locking large portions of the collection.
    while (true) {
      const batch = await TransactionModel(TENANT)
        .find(DIRTY_FILTER)
        .select("_id")
        .limit(BATCH_SIZE)
        .lean();

      if (batch.length === 0) break;

      const ids = batch.map((doc) => doc._id);

      const result = await TransactionModel(TENANT).updateMany(
        { _id: { $in: ids } },
        [{ $set: { amount: { $divide: ["$amount", 100] } } }]
      );

      const fixed =
        typeof result.modifiedCount === "number"
          ? result.modifiedCount
          : result.nModified || 0;

      totalFixed += fixed;
      logger.debug(`Batch done: ${fixed} record(s) fixed`);
    }

    logger.info(
      `transaction-amount-fix-job: complete — ${totalFixed} record(s) fixed`
    );
  } catch (error) {
    logger.error(
      `transaction-amount-fix-job error --- ${stringify(error)}`
    );
  } finally {
    isJobRunning = false;
  }
};

// Run at 06:00 and 18:00 Nairobi time.
const schedule = "0 6,18 * * *";
const jobName = "transaction-amount-fix-job";

global.cronJobs = global.cronJobs || {};
global.cronJobs[jobName] = cron.schedule(schedule, fixTransactionAmounts, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { fixTransactionAmounts };
