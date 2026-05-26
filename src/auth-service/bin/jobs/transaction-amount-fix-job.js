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

// Date the webhook /100 normalization fix was deployed. Only records created
// before this boundary can be dirty; records on or after are always correct.
// Keeping amount >= 1000 as a secondary guard makes each batch idempotent —
// already-corrected records (e.g. amount: 50) are never re-touched.
const CUTOFF_DATE = new Date("2026-05-25T00:00:00.000Z");
const DIRTY_FILTER = {
  createdAt: { $lt: CUTOFF_DATE },
  amount: { $gte: 1000 },
};

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
      if (global.isShuttingDown) {
        logger.info(
          `transaction-amount-fix-job: shutdown signal received — stopping after ${totalFixed} record(s) fixed`
        );
        break;
      }

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
