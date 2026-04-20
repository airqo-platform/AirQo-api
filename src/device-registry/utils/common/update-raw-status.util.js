const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- utils/update-raw-status.util`
);
const DeviceModel = require("@models/Device");
const createFeedUtil = require("@utils/feed.util");
const createDeviceUtil = require("@utils/device.util");
const { getNetworkAdapter } = require("@utils/network.util");
const { getUptimeAccuracyUpdateObject } = require("@utils/common");
const isEmpty = require("is-empty");

// Skip re-checking a device whose lastRawData is fresher than this threshold.
// Balances freshness against ThingSpeak / external-API rate pressure.
const RECENCY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const RAW_INACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours (matches job)
const THINGSPEAK_TIMEOUT_MS = 30000;
const EXTERNAL_API_TIMEOUT_MS = 20000;

const STATUSES_FOR_PRIMARY_UPDATE = (
  constants.VALID_DEVICE_STATUSES || []
).filter((s) => s !== "deployed");

const isDeviceRawActive = (lastFeedTime) => {
  if (!lastFeedTime) return false;
  return Date.now() - new Date(lastFeedTime).getTime() < RAW_INACTIVE_THRESHOLD_MS;
};

const isDeviceActuallyMobile = (device) => {
  const type = (device?.deployment_type || "").toString().toLowerCase();
  return device?.mobility === true || type === "mobile";
};

const mockNext = (error) => {
  logger.error(`Error in fire-and-forget raw status update: ${error.message}`);
};

/**
 * Update rawOnlineStatus for a single device document already fetched from DB.
 * Returns a Promise that resolves when the DB write completes (or on any error).
 * Never rejects — errors are logged and swallowed.
 */
const processDevice = async (device) => {
  const hasExistingRawData =
    device.lastRawData && !isNaN(new Date(device.lastRawData).getTime());
  const existingDataAge = hasExistingRawData
    ? Date.now() - new Date(device.lastRawData).getTime()
    : Infinity;
  const shouldMarkOfflineFromStaleData =
    existingDataAge >= RAW_INACTIVE_THRESHOLD_MS;

  let isRawOnline = false;
  let lastFeedTime = null;
  let updateReason = "no_device_number";

  // ── AirQo device path ──────────────────────────────────────────────────────
  if (device.device_number) {
    // Fetch readKey (lean query — only what we need)
    let apiKey;
    try {
      const detail = await DeviceModel("airqo")
        .findOne({ device_number: device.device_number })
        .select("readKey")
        .lean();

      if (!detail?.readKey) {
        isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
        updateReason = shouldMarkOfflineFromStaleData
          ? "stale_lastRawData"
          : "no_readkey";
        await writeDeviceUpdate(device, isRawOnline, null, updateReason);
        return;
      }

      const decryptResponse = await createDeviceUtil.decryptKey(
        detail.readKey,
        mockNext
      );
      if (!decryptResponse.success) {
        isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
        updateReason = shouldMarkOfflineFromStaleData
          ? "stale_lastRawData"
          : "decryption_failed";
        await writeDeviceUpdate(device, isRawOnline, null, updateReason);
        return;
      }
      apiKey = decryptResponse.data;
    } catch (err) {
      logger.warn(
        `[update-raw-status] key fetch/decrypt failed for ${device.name}: ${err.message}`
      );
      return;
    }

    try {
      const thingspeakData = await Promise.race([
        createFeedUtil.fetchThingspeakData({
          channel: device.device_number,
          api_key: apiKey,
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("ThingSpeak fetch timeout")),
            THINGSPEAK_TIMEOUT_MS
          )
        ),
      ]);

      if (thingspeakData?.feeds?.[0]) {
        lastFeedTime = thingspeakData.feeds[0].created_at;
        isRawOnline = isDeviceRawActive(lastFeedTime);
        updateReason = isRawOnline ? "online_raw" : "offline_raw";
      } else if (shouldMarkOfflineFromStaleData) {
        isRawOnline = false;
        updateReason = "stale_lastRawData";
      }
    } catch (err) {
      logger.warn(
        `[update-raw-status] ThingSpeak fetch failed for ${device.name}: ${err.message}`
      );
      isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
      updateReason = shouldMarkOfflineFromStaleData
        ? "stale_lastRawData"
        : "fetch_error";
    }

    await writeDeviceUpdate(device, isRawOnline, lastFeedTime, updateReason);
    return;
  }

  // ── External device path ───────────────────────────────────────────────────
  const externalAdapter =
    device.api_code && device.network && device.network !== "airqo"
      ? await getNetworkAdapter(device.network).catch(() => null)
      : null;

  if (externalAdapter?.online_check_via_feed) {
    try {
      const externalResult = await Promise.race([
        createFeedUtil.fetchExternalDeviceData({ device, adapter: externalAdapter }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("External API timeout")),
            EXTERNAL_API_TIMEOUT_MS
          )
        ),
      ]);

      if (externalResult.success && !isEmpty(externalResult.data)) {
        const data = externalResult.data;
        const tsValue =
          data.timestamp || data.time || data.created_at || data.recordedAt || data.ts || null;
        if (tsValue) {
          lastFeedTime = tsValue;
          isRawOnline = isDeviceRawActive(tsValue);
        } else {
          isRawOnline = true;
          lastFeedTime = new Date().toISOString();
        }
        updateReason = isRawOnline ? "online_external_api" : "offline_external_api";
      } else {
        isRawOnline = false;
        updateReason = "offline_external_api";
      }
    } catch (err) {
      logger.warn(
        `[update-raw-status] external API failed for ${device.name}: ${err.message}`
      );
      isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
      updateReason = shouldMarkOfflineFromStaleData
        ? "stale_lastRawData"
        : "external_api_error";
    }

    await writeDeviceUpdate(device, isRawOnline, lastFeedTime, updateReason);
    return;
  }

  // ── Fallback: stale-data only ──────────────────────────────────────────────
  isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
  updateReason = shouldMarkOfflineFromStaleData ? "stale_lastRawData" : "no_device_number";
  await writeDeviceUpdate(device, isRawOnline, null, updateReason);
};

/**
 * Write rawOnlineStatus (and related fields) to the Device document.
 */
const writeDeviceUpdate = async (device, isRawOnline, lastFeedTime, reason) => {
  try {
    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline: device.rawOnlineStatus,
      isNowOnline: isRawOnline,
      currentStats: device.onlineStatusAccuracy,
      reason,
    });

    const updateFields = { rawOnlineStatus: isRawOnline, ...setUpdate };
    if (lastFeedTime) {
      updateFields.lastRawData = new Date(lastFeedTime);
    }
    if (
      STATUSES_FOR_PRIMARY_UPDATE.includes(device.status) ||
      isDeviceActuallyMobile(device)
    ) {
      updateFields.isOnline = isRawOnline;
      if (lastFeedTime) {
        updateFields.lastActive = new Date(lastFeedTime);
      }
    }

    const updateDoc = { $set: updateFields };
    if (incUpdate) {
      updateDoc.$inc = incUpdate;
    }

    await DeviceModel(device.tenant || "airqo").findByIdAndUpdate(
      device._id,
      updateDoc,
      { new: false }
    );
  } catch (err) {
    logger.warn(
      `[update-raw-status] DB write failed for ${device.name}: ${err.message}`
    );
  }
};

/**
 * Fetch lightweight device documents for the given IDs, apply the recency
 * guard, and process each one.  Resolves when all updates finish (or fail).
 */
const updateDevices = async (deviceIds, tenant = "airqo") => {
  if (!deviceIds?.length) return;

  let devices;
  try {
    devices = await DeviceModel(tenant)
      .find({ _id: { $in: deviceIds } })
      .select(
        "_id name device_number api_code network rawOnlineStatus lastRawData " +
          "status deployment_type mobility site_id isPrimaryInLocation " +
          "onlineStatusAccuracy readKey"
      )
      .lean();
  } catch (err) {
    logger.warn(`[update-raw-status] device fetch failed: ${err.message}`);
    return;
  }

  // Apply recency guard: skip devices updated within RECENCY_THRESHOLD_MS
  const staleDevices = devices.filter((d) => {
    if (!d.lastRawData) return true;
    return Date.now() - new Date(d.lastRawData).getTime() >= RECENCY_THRESHOLD_MS;
  });

  if (!staleDevices.length) return;

  // Attach tenant so writeDeviceUpdate can use the right model
  for (const d of staleDevices) {
    d.tenant = tenant;
  }

  // Sequential with setImmediate yields to keep the event loop responsive
  for (const device of staleDevices) {
    await new Promise((resolve) => setImmediate(resolve));
    await processDevice(device).catch((err) =>
      logger.warn(
        `[update-raw-status] unhandled error for ${device.name}: ${err.message}`
      )
    );
  }
};

/**
 * Fire-and-forget wrapper for a single device view.
 *
 * Usage:
 *   fireAndForget([deviceId], tenant);   // no await — intentional
 *
 * setImmediate ensures the HTTP response is flushed before the update starts.
 */
const fireAndForget = (deviceIds, tenant = "airqo") => {
  if (!deviceIds?.length) return;

  setImmediate(() => {
    updateDevices(deviceIds, tenant).catch((err) =>
      logger.warn(`[update-raw-status] fire-and-forget error: ${err.message}`)
    );
  });
};

module.exports = { fireAndForget };
