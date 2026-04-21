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

// Skip re-checking a device whose lastRawStatusCheckedAt is fresher than this.
// Using a dedicated throttle field rather than lastRawData ensures devices with
// no feed data are also throttled correctly.
const RECENCY_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes
const RAW_INACTIVE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours (matches job)
const THINGSPEAK_TIMEOUT_MS = 30000;
const EXTERNAL_API_TIMEOUT_MS = 20000;

const STATUSES_FOR_PRIMARY_UPDATE = (
  constants.VALID_DEVICE_STATUSES || []
).filter((s) => s !== "deployed");

const isDeviceRawActive = (lastFeedTime) => {
  if (!lastFeedTime) return false;
  const t = new Date(lastFeedTime).getTime();
  if (isNaN(t)) return false;
  return Date.now() - t < RAW_INACTIVE_THRESHOLD_MS;
};

const isDeviceActuallyMobile = (device) => {
  const type = (device?.deployment_type || "").toString().toLowerCase();
  return device?.mobility === true || type === "mobile";
};

// Returns a Promise.race-compatible pair that always clears its timer.
const withTimeout = (promise, ms, label) => {
  let timerId;
  const timeout = new Promise((_, reject) => {
    timerId = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timerId));
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
      // Guard against undefined return from decryptKey
      if (!decryptResponse?.success) {
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
      // Write a stale-data fallback rather than leaving the device unupdated
      isRawOnline = hasExistingRawData ? !shouldMarkOfflineFromStaleData : false;
      updateReason = shouldMarkOfflineFromStaleData
        ? "stale_lastRawData"
        : "key_fetch_or_decrypt_error";
      await writeDeviceUpdate(device, isRawOnline, null, updateReason);
      return;
    }

    try {
      const thingspeakData = await withTimeout(
        createFeedUtil.fetchThingspeakData({
          channel: device.device_number,
          api_key: apiKey,
        }),
        THINGSPEAK_TIMEOUT_MS,
        "ThingSpeak fetch"
      );

      if (thingspeakData?.feeds?.[0]) {
        lastFeedTime = thingspeakData.feeds[0].created_at;
        isRawOnline = isDeviceRawActive(lastFeedTime);
        updateReason = isRawOnline ? "online_raw" : "offline_raw";
      } else {
        // No new feed data — fall back to existing lastRawData to avoid
        // incorrectly flipping a recently-active device offline
        isRawOnline = isDeviceRawActive(device.lastRawData);
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
      const externalResult = await withTimeout(
        createFeedUtil.fetchExternalDeviceData({ device, adapter: externalAdapter }),
        EXTERNAL_API_TIMEOUT_MS,
        "External API"
      );

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
        // Empty/unsuccessful response — fall back to lastRawData rather than
        // immediately marking offline
        isRawOnline = isDeviceRawActive(device.lastRawData);
        updateReason = "stale_lastRawData";
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
 *
 * Uses a conditional filter on lastRawData so we never overwrite fresher data
 * that the batch job may have written between our fetch and this write.
 */
const writeDeviceUpdate = async (device, isRawOnline, lastFeedTime, reason) => {
  try {
    const { setUpdate, incUpdate } = getUptimeAccuracyUpdateObject({
      isCurrentlyOnline: device.rawOnlineStatus,
      isNowOnline: isRawOnline,
      currentStats: device.onlineStatusAccuracy,
      reason,
    });

    const updateFields = {
      rawOnlineStatus: isRawOnline,
      // Durable throttle timestamp — used by the recency guard so devices with
      // no feed data are also dampened correctly
      lastRawStatusCheckedAt: new Date(),
      ...setUpdate,
    };

    if (lastFeedTime) {
      const parsedTime = new Date(lastFeedTime);
      if (!isNaN(parsedTime.getTime())) {
        updateFields.lastRawData = parsedTime;
        if (
          STATUSES_FOR_PRIMARY_UPDATE.includes(device.status) ||
          isDeviceActuallyMobile(device)
        ) {
          updateFields.lastActive = parsedTime;
        }
      }
    }

    if (
      STATUSES_FOR_PRIMARY_UPDATE.includes(device.status) ||
      isDeviceActuallyMobile(device)
    ) {
      updateFields.isOnline = isRawOnline;
    }

    const updateDoc = { $set: updateFields };
    if (incUpdate) {
      updateDoc.$inc = incUpdate;
    }

    // Conditional write: only apply if lastRawData hasn't advanced since we
    // fetched the device, preventing overwrites from the concurrent batch job.
    const filter = { _id: device._id, lastRawData: device.lastRawData || null };
    const updated = await DeviceModel(device.tenant || "airqo").findOneAndUpdate(
      filter,
      updateDoc,
      { new: false }
    );

    if (!updated) {
      logger.debug(
        `[update-raw-status] skipped write for ${device.name} — lastRawData advanced by another writer`
      );
    }
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
          "lastRawStatusCheckedAt status deployment_type mobility site_id " +
          "isPrimaryInLocation onlineStatusAccuracy"
      )
      .lean();
  } catch (err) {
    logger.warn(`[update-raw-status] device fetch failed: ${err.message}`);
    return;
  }

  // Recency guard: prefer lastRawStatusCheckedAt (always written), fall back to
  // lastRawData. Treat invalid/missing timestamps as stale (include in batch).
  const staleDevices = devices.filter((d) => {
    const checkField = d.lastRawStatusCheckedAt || d.lastRawData;
    if (!checkField) return true;
    const t = new Date(checkField).getTime();
    if (isNaN(t)) return true;
    return Date.now() - t >= RECENCY_THRESHOLD_MS;
  });

  if (!staleDevices.length) return;

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
