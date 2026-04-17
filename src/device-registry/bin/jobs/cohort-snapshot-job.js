/**
 * cohort-snapshot-job.js
 *
 * Runs every hour at :15 and pre-populates the CohortDeviceSnapshot and
 * CohortSiteSnapshot collections for every active cohort.
 *
 * WHY:
 *   POST /cohorts/devices and POST /cohorts/sites run a multi-$lookup MongoDB
 *   aggregation that takes 3–10 seconds per page under normal load and times out
 *   (504) under concurrent load. Pre-computing the results hourly means the new
 *   POST /cohorts/cached-devices and POST /cohorts/cached-sites endpoints can
 *   answer with a simple find() in <100 ms regardless of load.
 *
 * HOW:
 *   1. Fetch all cohorts for the configured tenant.
 *   2. For each cohort, call the existing listDevices / listSites util functions
 *      in pages (BATCH_SIZE devices / sites per page) so each page stays within
 *      the maxTimeMS budget already set on those functions.
 *   3. Upsert each device / site into the snapshot collection keyed by
 *      (cohort_id, device_id|site_id, tenant).
 *   4. After a successful full refresh, remove any stale snapshot documents for
 *      the cohort whose _snapshot_generated_at is older than the current run
 *      (handles devices / sites that left the cohort since the last run).
 */

const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/cohort-snapshot-job`
);
const { logText } = require("@utils/shared");
const cron = require("node-cron");
const CohortModel = require("@models/Cohort");
const CohortDeviceSnapshotModel = require("@models/CohortDeviceSnapshot");
const CohortSiteSnapshotModel = require("@models/CohortSiteSnapshot");
const createCohortUtil = require("@utils/cohort.util");

const TENANT = constants.DEFAULT_TENANT || "airqo";
const JOB_NAME = "cohort-snapshot-job";
const JOB_SCHEDULE = "15 * * * *"; // Every hour at :15
const BATCH_SIZE = 50; // Devices / sites per page — keeps each page under 45 s maxTimeMS

// Silent next() — the util functions call next(error) on failures; we log and
// continue rather than crashing the job.
const noop = (err) => {
  if (err) logger.error(`${JOB_NAME} -- util error: ${err.message}`);
};

/**
 * Build a synthetic request object that the util functions accept.
 */
function buildRequest({ cohortIds, tenant, skip, limit, extra = {} }) {
  return {
    body: { cohort_ids: cohortIds.map((id) => id.toString()) },
    query: { tenant, skip, limit, ...extra },
    params: {},
  };
}

/**
 * Upsert a batch of snapshot documents for devices.
 */
async function upsertDeviceSnapshots(cohortId, tenant, devices, runAt) {
  if (!devices.length) return;
  const ops = devices.map((device) => ({
    updateOne: {
      filter: {
        cohort_id: cohortId,
        device_id: device._id,
        tenant,
      },
      update: {
        $set: {
          cohort_id: cohortId,
          device_id: device._id,
          tenant,
          name: device.name || null,
          isOnline: device.isOnline !== undefined ? device.isOnline : null,
          status: device.status || null,
          category: device.category || null,
          network: device.network || null,
          data: device,
          _snapshot_generated_at: runAt,
        },
      },
      upsert: true,
    },
  }));
  await CohortDeviceSnapshotModel(tenant).bulkWrite(ops, { ordered: false });
}

/**
 * Upsert a batch of snapshot documents for sites.
 */
async function upsertSiteSnapshots(cohortId, tenant, sites, runAt) {
  if (!sites.length) return;
  const ops = sites.map((site) => ({
    updateOne: {
      filter: {
        cohort_id: cohortId,
        site_id: site._id,
        tenant,
      },
      update: {
        $set: {
          cohort_id: cohortId,
          site_id: site._id,
          tenant,
          name: site.name || null,
          search_name: site.search_name || null,
          country: site.country || null,
          data: site,
          _snapshot_generated_at: runAt,
        },
      },
      upsert: true,
    },
  }));
  await CohortSiteSnapshotModel(tenant).bulkWrite(ops, { ordered: false });
}

/**
 * Remove snapshot documents for a cohort that were NOT touched in this run.
 * This cleans up devices / sites that have left the cohort since the last run.
 */
async function removeStaleSnapshots(cohortId, tenant, runAt) {
  await Promise.all([
    CohortDeviceSnapshotModel(tenant).deleteMany({
      cohort_id: cohortId,
      tenant,
      _snapshot_generated_at: { $lt: runAt },
    }),
    CohortSiteSnapshotModel(tenant).deleteMany({
      cohort_id: cohortId,
      tenant,
      _snapshot_generated_at: { $lt: runAt },
    }),
  ]);
}

/**
 * Refresh the device snapshot for a single cohort.
 */
async function refreshDevicesForCohort(cohortId, tenant, runAt) {
  let skip = 0;
  let totalUpserted = 0;

  while (true) {
    const request = buildRequest({
      cohortIds: [cohortId],
      tenant,
      skip,
      limit: BATCH_SIZE,
    });

    let result;
    try {
      result = await createCohortUtil.listDevices(request, noop);
    } catch (err) {
      logger.error(
        `${JOB_NAME} -- listDevices failed for cohort ${cohortId} skip=${skip}: ${err.message}`
      );
      // Propagate incomplete flag so the caller skips stale pruning
      return { count: totalUpserted, complete: false };
    }

    if (!result || !result.success) {
      logger.error(
        `${JOB_NAME} -- listDevices returned failure for cohort ${cohortId} skip=${skip}`
      );
      return { count: totalUpserted, complete: false };
    }

    // Natural end of data — pagination exhausted
    if (!result.data || !result.data.length) {
      return { count: totalUpserted, complete: true };
    }

    await upsertDeviceSnapshots(cohortId, tenant, result.data, runAt);
    totalUpserted += result.data.length;

    if (result.data.length < BATCH_SIZE) {
      return { count: totalUpserted, complete: true };
    }
    skip += BATCH_SIZE;
  }
}

/**
 * Refresh the site snapshot for a single cohort.
 */
async function refreshSitesForCohort(cohortId, tenant, runAt) {
  let skip = 0;
  let totalUpserted = 0;

  while (true) {
    const request = buildRequest({
      cohortIds: [cohortId],
      tenant,
      skip,
      limit: BATCH_SIZE,
    });

    let result;
    try {
      result = await createCohortUtil.listSites(request, noop);
    } catch (err) {
      logger.error(
        `${JOB_NAME} -- listSites failed for cohort ${cohortId} skip=${skip}: ${err.message}`
      );
      // Propagate incomplete flag so the caller skips stale pruning
      return { count: totalUpserted, complete: false };
    }

    if (!result || !result.success) {
      logger.error(
        `${JOB_NAME} -- listSites returned failure for cohort ${cohortId} skip=${skip}`
      );
      return { count: totalUpserted, complete: false };
    }

    // Natural end of data — pagination exhausted
    if (!result.data || !result.data.length) {
      return { count: totalUpserted, complete: true };
    }

    await upsertSiteSnapshots(cohortId, tenant, result.data, runAt);
    totalUpserted += result.data.length;

    if (result.data.length < BATCH_SIZE) {
      return { count: totalUpserted, complete: true };
    }
    skip += BATCH_SIZE;
  }
}

/**
 * Main job function — iterates all cohorts and refreshes both snapshots.
 */
async function runCohortSnapshotJob() {
  const jobStart = new Date();

  // Preflight: verify the MongoDB connection is ready before touching any cohort.
  // If the connection is in a reconnecting state (readyState !== 1) we log a
  // single WARN and skip the run entirely rather than emitting one ERROR per
  // cohort, which floods the alerts channel.
  // NOTE: CohortDeviceSnapshotModel and CohortSiteSnapshotModel currently share
  // the same underlying connection as CohortModel via getModelByTenant. If they
  // are ever moved to a separate connection, add equivalent readyState checks for
  // their .db connections here.
  const cohortModel = CohortModel(TENANT);
  const connReadyState = cohortModel.db?.readyState;
  if (connReadyState !== 1) {
    logger.warn(
      `${JOB_NAME} -- skipping run: MongoDB connection not ready (readyState=${connReadyState})`
    );
    return;
  }

  logText(`${JOB_NAME} -- starting at ${jobStart.toISOString()}`);

  let cohorts;
  try {
    cohorts = await CohortModel(TENANT)
      .find({})
      .select("_id cohort_id")
      .lean()
      .maxTimeMS(30000);
  } catch (err) {
    logger.error(`${JOB_NAME} -- failed to fetch cohorts: ${err.message}`);
    return;
  }

  if (!cohorts || cohorts.length === 0) {
    logText(`${JOB_NAME} -- no cohorts found, exiting`);
    return;
  }

  logText(`${JOB_NAME} -- processing ${cohorts.length} cohort(s)`);

  let totalDevices = 0;
  let totalSites = 0;
  let cohortErrors = 0;

  for (const cohort of cohorts) {
    const cohortId = cohort._id;
    const runAt = new Date(); // per-cohort timestamp for stale cleanup

    try {
      // Run sequentially to avoid doubling simultaneous connection demand on a
      // shared pool that may already be under pressure from live aggregation requests.
      const deviceResult = await refreshDevicesForCohort(cohortId, TENANT, runAt);
      const siteResult = await refreshSitesForCohort(cohortId, TENANT, runAt);

      totalDevices += deviceResult.count;
      totalSites += siteResult.count;

      // Only prune stale documents when both refreshes completed without error.
      // If either was interrupted mid-pagination, pruning would incorrectly delete
      // valid snapshot documents for the portion that was not yet upserted.
      if (deviceResult.complete && siteResult.complete) {
        await removeStaleSnapshots(cohortId, TENANT, runAt);
      } else {
        logger.warn(
          `${JOB_NAME} -- cohort ${cohortId}: skipping stale pruning (devices complete=${deviceResult.complete}, sites complete=${siteResult.complete})`
        );
      }

      logText(
        `${JOB_NAME} -- cohort ${cohortId}: ${deviceResult.count} device(s), ${siteResult.count} site(s) refreshed`
      );
    } catch (err) {
      logger.error(
        `${JOB_NAME} -- error processing cohort ${cohortId}: ${err.message}`
      );
      cohortErrors++;
    }
  }

  const elapsed = ((Date.now() - jobStart) / 1000).toFixed(1);
  logText(
    `${JOB_NAME} -- completed in ${elapsed}s: ${totalDevices} device(s), ${totalSites} site(s) refreshed across ${cohorts.length} cohort(s), ${cohortErrors} error(s)`
  );
}

// Schedule the job
cron.schedule(JOB_SCHEDULE, () => {
  runCohortSnapshotJob().catch((err) => {
    logger.error(`${JOB_NAME} -- unhandled error: ${err.message}`);
  });
});

logText(`${JOB_NAME} -- scheduled (${JOB_SCHEDULE})`);

module.exports = { runCohortSnapshotJob };
