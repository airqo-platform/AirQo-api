/**
 * backfill-api-code-job.js
 *
 * One-time idempotent migration job.
 *
 * Problem being solved
 * ────────────────────
 * Some external (non-AirQo) devices were onboarded before the `api_code` field
 * was formalised as the canonical connection URL.  For IQAir devices the
 * connection URL was stored in the `description` field instead
 * (e.g. "Serekunda Health Center. https://device.iqair.com/v2/6796fa...").
 * For other networks the URL may be absent entirely.
 *
 * This job:
 *   1. Finds all non-AirQo devices where `api_code` is null/empty.
 *   2. For each device, attempts to extract a URL from `description` using the
 *      network's configured `serial_number_regex` (which also tells us the URL
 *      pattern for the network).
 *   3. Writes `api_code` and, if still missing, `serial_number` back to the
 *      device document.
 *
 * Idempotency guarantee
 * ─────────────────────
 * The MongoDB filter always includes `{ api_code: { $in: [null, ""] } }`, so
 * devices that have already been migrated are never touched again.
 *
 * Schedule / execution
 * ────────────────────
 * The job runs once on startup (30-second delay) and again every 24 hours.
 * Once all devices have been migrated the cursor returns 0 documents and the
 * job finishes in milliseconds.  It is safe to leave enabled indefinitely.
 */

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- backfill-api-code-job`
);
const DeviceModel = require("@models/Device");
const { logText } = require("@utils/shared");
const cron = require("node-cron");

const JOB_NAME = "backfill-api-code-job";
const JOB_SCHEDULE = "0 3 * * *"; // 03:00 daily — low-traffic window
const BATCH_SIZE = 100;

let isJobRunning = false;
let currentJobPromise = null;

// ─── URL extraction helpers ──────────────────────────────────────────────────

/**
 * Try to extract a URL from free-text (e.g. a device description field).
 * Returns the first http/https URL found, or null.
 */
const extractUrlFromText = (text) => {
  if (!text || typeof text !== "string") return null;
  const match = text.match(/https?:\/\/[^\s,;]+/);
  return match ? match[0].replace(/[.,;]+$/, "") : null;
};

/**
 * Given a network name and a URL, extract the serial_number using the
 * network adapter's serial_number_regex (from NETWORK_ADAPTERS constant).
 * Returns null if no regex is configured or the pattern does not match.
 */
const extractSerialFromUrl = (networkName, url) => {
  const adapter = constants.NETWORK_ADAPTERS?.[networkName];
  if (!adapter?.serial_number_regex || !url) return null;
  try {
    const match = url.match(new RegExp(adapter.serial_number_regex));
    return match?.[1] || null;
  } catch (err) {
    logger.warn(
      `backfill: bad serial_number_regex for network "${networkName}": ${err.message}`
    );
    return null;
  }
};

// ─── Core migration logic ────────────────────────────────────────────────────

const performBackfill = async () => {
  logText(`🚀 ${JOB_NAME}: starting api_code backfill...`);

  let totalScanned = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;

  try {
    // Process in batches using a cursor so memory footprint stays flat
    const cursor = DeviceModel("airqo")
      .find({
        network: { $exists: true, $ne: "airqo", $ne: "" },
        $or: [{ api_code: null }, { api_code: { $exists: false } }, { api_code: "" }],
      })
      .select("_id name network serial_number description api_code")
      .lean()
      .batchSize(BATCH_SIZE)
      .cursor();

    const bulkOps = [];

    const flushBulk = async () => {
      if (bulkOps.length === 0) return;
      try {
        const result = await DeviceModel("airqo").bulkWrite(bulkOps, {
          ordered: false,
        });
        totalUpdated += result.modifiedCount || 0;
        logger.debug(
          `${JOB_NAME}: flushed ${bulkOps.length} ops, modified ${result.modifiedCount}`
        );
      } catch (err) {
        logger.error(`${JOB_NAME}: bulk write error: ${err.message}`);
      }
      bulkOps.length = 0; // clear in place
    };

    for await (const device of cursor) {
      totalScanned++;

      if (global.isShuttingDown) {
        logText(`${JOB_NAME}: stopping due to application shutdown`);
        break;
      }

      const networkName = device.network;

      // ── Step 1: Try to get api_code ──────────────────────────────────────
      let apiCode = null;

      // Option A: description contains a URL
      if (device.description) {
        apiCode = extractUrlFromText(device.description);
      }

      // Option B: build from adapter template + serial_number.
      // Note: api_code_is_full_url describes how an existing api_code is *used*
      // (fetch it directly), not whether a URL *can* be constructed from parts.
      // IQAir, for example, has api_code_is_full_url: true yet its URL is still
      // constructible from api_base_url + api_url_template + serial_number.
      if (!apiCode && device.serial_number) {
        const adapter = constants.NETWORK_ADAPTERS?.[networkName];
        if (adapter?.api_base_url && adapter?.api_url_template) {
          apiCode =
            adapter.api_base_url +
            adapter.api_url_template.replace(
              "{serial_number}",
              device.serial_number
            );
        }
      }

      if (!apiCode) {
        // Cannot derive api_code — skip this device for now
        totalSkipped++;
        logger.debug(
          `${JOB_NAME}: skipping device "${device.name}" (network: ${networkName}) — cannot derive api_code`
        );
        continue;
      }

      // ── Step 2: Derive serial_number if still missing ────────────────────
      const updateFields = { api_code: apiCode };

      if (!device.serial_number) {
        const serial = extractSerialFromUrl(networkName, apiCode);
        if (serial) {
          updateFields.serial_number = serial;
          logger.debug(
            `${JOB_NAME}: device "${device.name}" → serial_number="${serial}"`
          );
        }
      }

      // ── Step 3: Queue update ─────────────────────────────────────────────
      logger.debug(
        `${JOB_NAME}: queuing update for "${device.name}" → api_code="${apiCode}"`
      );

      bulkOps.push({
        updateOne: {
          // Guard: only write if api_code is still absent (race-condition safe)
          filter: {
            _id: device._id,
            $or: [
              { api_code: null },
              { api_code: { $exists: false } },
              { api_code: "" },
            ],
          },
          update: { $set: updateFields },
        },
      });

      // Flush every BATCH_SIZE operations
      if (bulkOps.length >= BATCH_SIZE) {
        await flushBulk();
      }
    }

    // Flush any remaining operations
    await flushBulk();

    await cursor.close();
  } catch (err) {
    logger.error(`${JOB_NAME}: unexpected error — ${err.message}`);
  }

  logText(
    `✅ ${JOB_NAME}: done. Scanned=${totalScanned}, Updated=${totalUpdated}, Skipped=${totalSkipped}`
  );
};

// ─── Cron setup ──────────────────────────────────────────────────────────────

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = performBackfill();

  try {
    await currentJobPromise;
  } catch (err) {
    logger.error(`🐛 Error during ${JOB_NAME}: ${err.message}`);
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

const startJob = () => {
  const cronJobInstance = cron.schedule(JOB_SCHEDULE, jobWrapper, {
    scheduled: true,
    timezone: constants.TIMEZONE || "UTC",
  });

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJobInstance,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJobInstance.stop();
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  // Run once on startup after a short delay to avoid blocking app boot
  setTimeout(jobWrapper, 30000);

  logText(`✅ ${JOB_NAME} registered (schedule: ${JOB_SCHEDULE})`);
};

// Graceful shutdown
process.on("SIGINT", async () => {
  if (global.cronJobs?.[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
});
process.on("SIGTERM", async () => {
  if (global.cronJobs?.[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
});

startJob();

module.exports = { performBackfill, extractUrlFromText, extractSerialFromUrl };
