/**
 * audit-api-code-job.js
 *
 * Idempotent data-quality audit and repair job for external-network devices.
 *
 * Problem being solved
 * ────────────────────
 * The backfill-api-code-job populates *missing* api_code fields.  This job
 * handles the complementary problem: api_code values that are *present* but
 * corrupt or incomplete, causing silent failures in the online-status job and
 * the workflows ETL pipeline.
 *
 * Phase 1 — Audit (always runs, read-only)
 * ─────────────────────────────────────────
 * Scans every external-network device and buckets it into quality categories:
 *
 *   trailing_punct     api_code ends with stray punctuation (e.g. a trailing ').
 *                      Causes 404s in fetchExternalDeviceData; the device
 *                      appears "not transmitting" even when hardware is live.
 *                      → AUTO-FIXED.
 *
 *   missing_serial     api_code is present but serial_number is absent, and
 *                      the adapter's serial_number_regex can extract it.
 *                      Causes the workflows ETL adapter to skip the device.
 *                      → AUTO-FIXED.
 *
 *   no_device_id       api_code is present but serial_number_regex finds no
 *                      device-specific ID (bare template or structurally wrong URL).
 *                      → FLAGGED FOR MANUAL REVIEW.
 *
 *   missing_access_code Network requires auth (auth_type ≠ "none") but
 *                      access_code is absent.  External API rejects every
 *                      request (422 for AirGradient, 401 for IQAir).
 *                      → FLAGGED FOR MANUAL REVIEW.
 *
 *   clean              No issues detected.
 *
 * Phase 2 — Fix (skipped when AUDIT_API_CODE_DRY_RUN=true)
 * ──────────────────────────────────────────────────────────
 * Applies idempotent bulk writes for the two auto-fixable categories.
 * Each update op carries a conditional filter so it is a no-op if another
 * process already corrected the record between audit and fix.
 *
 * Idempotency guarantee
 * ─────────────────────
 * trailing_punct fix: filtered on exact api_code match — safe to re-run.
 * missing_serial fix: filtered on serial_number absent — safe to re-run.
 *
 * Schedule / execution
 * ────────────────────
 * Runs once on startup (60-second delay, after backfill-api-code-job at 30s)
 * and again at 02:00 daily (before backfill-api-code-job at 03:00).  Once all
 * devices are clean the cursor returns 0 fixable documents and the job
 * finishes in milliseconds.  Safe to leave enabled indefinitely.
 *
 * Environment variables
 * ─────────────────────
 * AUDIT_API_CODE_DRY_RUN=true   Run audit only; skip all DB writes (default: false).
 */

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- audit-api-code-job`
);
const DeviceModel = require("@models/Device");
const { logText } = require("@utils/shared");
const cron = require("node-cron");

const JOB_NAME = "audit-api-code-job";
const JOB_SCHEDULE = "0 2 * * *"; // 02:00 daily — before backfill-api-code-job at 03:00
const BATCH_SIZE = 100;
const SAMPLE_LIMIT = 10; // max device names printed per category in the report
const DRY_RUN = process.env.AUDIT_API_CODE_DRY_RUN === "true";
const TRAILING_PUNCT_RE = /[.,;'"]+$/;

let isJobRunning = false;
let currentJobPromise = null;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const stripTrailingPunct = (str) =>
  typeof str === "string" ? str.replace(TRAILING_PUNCT_RE, "") : str;

/**
 * Extract serial_number from a URL using the network's configured regex.
 * Returns null if the network has no regex or the pattern does not match.
 */
const extractSerial = (networkName, url) => {
  const adapter = constants.NETWORK_ADAPTERS?.[networkName];
  if (!adapter?.serial_number_regex || !url) return null;
  try {
    const match = url.match(new RegExp(adapter.serial_number_regex));
    return match?.[1] || null;
  } catch (err) {
    logger.warn(
      `${JOB_NAME}: bad serial_number_regex for network "${networkName}": ${err.message}`
    );
    return null;
  }
};

/** Returns true when the network adapter requires an auth credential. */
const networkNeedsAuth = (networkName) => {
  const adapter = constants.NETWORK_ADAPTERS?.[networkName];
  return Boolean(adapter?.auth_type && adapter.auth_type !== "none");
};

/** Format up to SAMPLE_LIMIT device names for log output, with overflow count. */
const formatSample = (items) => {
  const names = items.slice(0, SAMPLE_LIMIT).map((d) => d.name);
  const overflow = items.length - names.length;
  return overflow > 0
    ? `${names.join(", ")} … (+${overflow} more)`
    : names.join(", ");
};

// ─── Phase 1: Audit ──────────────────────────────────────────────────────────

const runAudit = async () => {
  const buckets = {
    trailingPunct: [],     // { _id, name, api_code, fixed_api_code }
    missingSerial: [],     // { _id, name, serial }
    noDeviceId: [],        // { name, api_code }       — manual review
    missingAccessCode: [], // { name, network }         — manual review
    missingApiCode: [],    // { name, network }         — info, backfill job owns
  };
  let cleanCount = 0;
  let totalScanned = 0;

  const cursor = DeviceModel("airqo")
    .find({ network: { $exists: true, $nin: ["airqo", ""] } })
    .select("_id name network serial_number api_code access_code")
    .lean()
    .batchSize(BATCH_SIZE)
    .cursor();

  for await (const device of cursor) {
    if (global.isShuttingDown) {
      logText(`${JOB_NAME}: stopping — application shutting down`);
      break;
    }

    totalScanned++;
    const flags = [];

    if (!device.api_code) {
      buckets.missingApiCode.push({ name: device.name, network: device.network });
      continue;
    }

    // 1. Trailing punctuation in api_code
    if (TRAILING_PUNCT_RE.test(device.api_code)) {
      buckets.trailingPunct.push({
        _id: device._id,
        name: device.name,
        api_code: device.api_code,
        fixed_api_code: stripTrailingPunct(device.api_code),
      });
      flags.push("trailing_punct");
    }

    // 2. Missing serial_number (check even when trailing_punct is present — the
    //    regex matches in the middle of the URL so the trailing char is irrelevant)
    if (!device.serial_number) {
      const serial = extractSerial(device.network, device.api_code);
      if (serial) {
        buckets.missingSerial.push({ _id: device._id, name: device.name, serial });
        flags.push("missing_serial");
      } else if (constants.NETWORK_ADAPTERS?.[device.network]?.serial_number_regex) {
        // Regex is configured for this network but matched nothing in api_code
        buckets.noDeviceId.push({ name: device.name, api_code: device.api_code });
        flags.push("no_device_id");
      }
    }

    // 3. Missing access_code for networks that require authentication
    if (networkNeedsAuth(device.network) && !device.access_code) {
      buckets.missingAccessCode.push({ name: device.name, network: device.network });
      flags.push("missing_access_code");
    }

    if (flags.length === 0) cleanCount++;
  }

  return { buckets, cleanCount, totalScanned };
};

// ─── Audit report ────────────────────────────────────────────────────────────

const logAuditReport = ({ buckets, cleanCount, totalScanned }) => {
  const autoFixable = buckets.trailingPunct.length + buckets.missingSerial.length;
  const needsReview = buckets.noDeviceId.length + buckets.missingAccessCode.length;

  logText(
    `\n📊 ${JOB_NAME} AUDIT REPORT` +
    `\n   Total external devices scanned  : ${totalScanned}` +
    `\n   Clean (no issues)               : ${cleanCount}` +
    `\n   ── Auto-fixable ──────────────────────────────────` +
    `\n   Trailing punctuation in api_code : ${buckets.trailingPunct.length}` +
    `\n   Missing serial_number (fixable)  : ${buckets.missingSerial.length}` +
    `\n   ── Needs manual review ───────────────────────────` +
    `\n   api_code has no device ID        : ${buckets.noDeviceId.length}` +
    `\n   Missing access_code (auth req.)  : ${buckets.missingAccessCode.length}` +
    `\n   ── Informational ─────────────────────────────────` +
    `\n   No api_code (backfill job owns)  : ${buckets.missingApiCode.length}` +
    `\n   ──────────────────────────────────────────────────` +
    `\n   Auto-fixable total               : ${autoFixable}` +
    `\n   Manual review required           : ${needsReview}`
  );

  if (buckets.trailingPunct.length > 0) {
    logger.warn(
      `${JOB_NAME} [trailing_punct]: ${formatSample(buckets.trailingPunct)}`
    );
  }
  if (buckets.missingSerial.length > 0) {
    logger.warn(
      `${JOB_NAME} [missing_serial]: ${formatSample(buckets.missingSerial)}`
    );
  }
  if (buckets.noDeviceId.length > 0) {
    logger.warn(
      `${JOB_NAME} [no_device_id — MANUAL REVIEW]: ${formatSample(buckets.noDeviceId)}`
    );
  }
  if (buckets.missingAccessCode.length > 0) {
    logger.warn(
      `${JOB_NAME} [missing_access_code — MANUAL REVIEW]: ${formatSample(
        buckets.missingAccessCode
      )}`
    );
  }
};

// ─── Phase 2: Fix ────────────────────────────────────────────────────────────

const applyFixes = async ({ buckets }) => {
  const results = { trailingPunct: 0, missingSerial: 0 };

  // Fix 1: Strip trailing punctuation from api_code.
  // Conditional filter matches on the exact (corrupt) api_code value so the op
  // is a no-op if the record was already corrected between audit and fix.
  if (buckets.trailingPunct.length > 0) {
    const ops = buckets.trailingPunct.map(({ _id, api_code, fixed_api_code }) => ({
      updateOne: {
        filter: { _id, api_code },
        update: { $set: { api_code: fixed_api_code } },
      },
    }));

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      if (global.isShuttingDown) break;
      try {
        const result = await DeviceModel("airqo").bulkWrite(
          ops.slice(i, i + BATCH_SIZE),
          { ordered: false }
        );
        results.trailingPunct += result.modifiedCount || 0;
      } catch (err) {
        logger.error(`${JOB_NAME}: trailing_punct bulk write error — ${err.message}`);
      }
    }

    logText(
      `${JOB_NAME} [trailing_punct]: fixed ${results.trailingPunct}/${buckets.trailingPunct.length}`
    );
  }

  // Fix 2: Backfill missing serial_number extracted from api_code.
  // Conditional filter ensures we never overwrite a serial_number that was set
  // (correctly or otherwise) between audit and fix phases.
  if (buckets.missingSerial.length > 0) {
    const ops = buckets.missingSerial.map(({ _id, serial }) => ({
      updateOne: {
        filter: {
          _id,
          $or: [
            { serial_number: { $exists: false } },
            { serial_number: null },
            { serial_number: "" },
          ],
        },
        update: { $set: { serial_number: serial } },
      },
    }));

    for (let i = 0; i < ops.length; i += BATCH_SIZE) {
      if (global.isShuttingDown) break;
      try {
        const result = await DeviceModel("airqo").bulkWrite(
          ops.slice(i, i + BATCH_SIZE),
          { ordered: false }
        );
        results.missingSerial += result.modifiedCount || 0;
      } catch (err) {
        logger.error(`${JOB_NAME}: missing_serial bulk write error — ${err.message}`);
      }
    }

    logText(
      `${JOB_NAME} [missing_serial]: backfilled ${results.missingSerial}/${buckets.missingSerial.length}`
    );
  }

  return results;
};

// ─── Core orchestration ──────────────────────────────────────────────────────

const performAuditAndFix = async () => {
  logText(`🔍 ${JOB_NAME}: starting${DRY_RUN ? " (DRY-RUN — no writes)" : ""}…`);

  let auditResult;
  try {
    auditResult = await runAudit();
  } catch (err) {
    logger.error(`${JOB_NAME}: audit scan failed — ${err.message}`);
    return;
  }

  logAuditReport(auditResult);

  const autoFixable =
    auditResult.buckets.trailingPunct.length +
    auditResult.buckets.missingSerial.length;

  if (DRY_RUN) {
    logText(`🔍 ${JOB_NAME}: dry-run complete — skipping all writes.`);
    return;
  }

  if (autoFixable === 0) {
    logText(`✅ ${JOB_NAME}: nothing to fix.`);
    return;
  }

  logText(`🔧 ${JOB_NAME}: applying ${autoFixable} auto-fix(es)…`);
  try {
    await applyFixes(auditResult);
  } catch (err) {
    logger.error(`${JOB_NAME}: fix phase failed — ${err.message}`);
    return;
  }

  logText(`✅ ${JOB_NAME}: done.`);
};

// ─── Cron setup ──────────────────────────────────────────────────────────────

const jobWrapper = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = performAuditAndFix();

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
      logText(`🛑 Stopping ${JOB_NAME}…`);
      cronJobInstance.stop();
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  // Run once on startup — 60 s delay so the DB connection is stable and
  // backfill-api-code-job (30 s delay) has had a chance to run first.
  setTimeout(jobWrapper, 60000);

  logText(`✅ ${JOB_NAME} registered (schedule: ${JOB_SCHEDULE})`);
};

process.once("SIGINT", async () => {
  if (global.cronJobs?.[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
});
process.once("SIGTERM", async () => {
  if (global.cronJobs?.[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
});

module.exports = {
  startJob,
  performAuditAndFix,
  stripTrailingPunct,
  extractSerial,
};
