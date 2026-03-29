"use strict";
/**
 * network.util.js
 *
 * Shared helper for resolving a network's adapter configuration.
 * Imported by both feed.util.js and device.util.js so the DB-first,
 * static-fallback logic lives in exactly one place.
 *
 * Precedence:
 *   1. Network document's `adapter` field in the DB (admin-editable at runtime)
 *   2. Static NETWORK_ADAPTERS constant bundled with the service
 *
 * Merging strategy: DB values WIN for keys they define; keys absent from the
 * DB record fall back to the static adapter. This means a partial DB override
 * (e.g. only `field_map` updated) does not silently drop other required fields
 * such as `api_base_url` or `serial_number_regex`.
 */

const constants = require("@config/constants");
const NetworkModel = require("@models/Network");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-util`
);

/**
 * Retrieve the merged adapter config for a given network name.
 *
 * @param {string} networkName - value of device.network (e.g. "airgradient")
 * @param {string} [tenant="airqo"]
 * @returns {Promise<object|null>} merged adapter config, or null if unknown
 */
const getNetworkAdapter = async (networkName, tenant = "airqo") => {
  const staticAdapter = constants.NETWORK_ADAPTERS?.[networkName] || null;

  try {
    const record = await NetworkModel(tenant)
      .findOne({ name: networkName })
      .select("adapter")
      .lean();

    if (record?.adapter && Object.keys(record.adapter).length > 0) {
      // DB values win; static fills any gaps the DB record does not override.
      return { ...(staticAdapter || {}), ...record.adapter };
    }
  } catch (dbError) {
    logger.warn(
      `getNetworkAdapter: could not load adapter from DB for network ` +
        `"${networkName}": ${dbError.message}`
    );
  }

  // Return a shallow copy so callers cannot mutate the global NETWORK_ADAPTERS constant.
  return staticAdapter ? { ...staticAdapter } : null;
};

module.exports = { getNetworkAdapter };
