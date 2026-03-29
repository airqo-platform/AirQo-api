"use strict";
/**
 * network.util.js
 *
 * Single source of truth for all Network business logic:
 *   • Adapter configuration resolution (getNetworkAdapter)
 *   • Network CRUD (createNetwork, listNetworks, updateNetwork, deleteNetwork)
 *
 * Both feed.util.js / device.util.js import getNetworkAdapter from here.
 * cohort.util.js delegates its Network functions here so the implementation
 * lives in exactly one place while the legacy /cohorts/networks endpoints
 * remain fully backward-compatible.
 *
 * Adapter precedence:
 *   1. Network document's `adapter` field in the DB (admin-editable at runtime)
 *   2. Static NETWORK_ADAPTERS constant bundled with the service
 *
 * Merging strategy: DB values WIN for keys they define; keys absent from the
 * DB record fall back to the static adapter. This means a partial DB override
 * (e.g. only `field_map` updated) does not silently drop other required fields
 * such as `api_base_url` or `serial_number_regex`.
 */

const crypto = require("crypto");
const constants = require("@config/constants");
const NetworkModel = require("@models/Network");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- network-util`);
const { generateFilter } = require("@utils/common");
const { logObject, HttpError } = require("@utils/shared");

// ─────────────────────────────────────────────────────────────────────────────
// Adapter resolution
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Network CRUD
// ─────────────────────────────────────────────────────────────────────────────

const listNetworks = async (request, next) => {
  try {
    const { tenant, limit, skip } = request.query;
    const filter = generateFilter.networks(request, next);
    const responseFromListNetworks = await NetworkModel(tenant).list(
      { filter, limit, skip },
      next
    );
    return responseFromListNetworks;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const updateNetwork = async (request, next) => {
  try {
    const { query, body } = request;
    const { tenant } = query;

    const filter = generateFilter.networks(request, next);

    if (isEmpty(filter)) {
      return {
        success: false,
        message: "Unable to find filter value",
        errors: { message: "Unable to find filter value" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    const network = await NetworkModel(tenant).findOne(filter).lean();

    logObject("network", network);

    if (!network) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: { message: "Invalid Network Data" },
        status: httpStatus.BAD_REQUEST,
      };
    }

    const networkId = network._id;
    const responseFromUpdateNetwork = await NetworkModel(tenant).findByIdAndUpdate(
      ObjectId(networkId),
      body,
      { new: true }
    );

    logObject("responseFromUpdateNetwork in Util", responseFromUpdateNetwork);

    if (!isEmpty(responseFromUpdateNetwork)) {
      return {
        success: true,
        message: "successfully updated the network",
        status: httpStatus.OK,
        data: responseFromUpdateNetwork,
      };
    }

    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: "unable to update the Network" },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const deleteNetwork = async (request, next) => {
  try {
    const { query } = request;
    const { tenant } = query;

    const filter = generateFilter.networks(request, next);

    if (isEmpty(filter)) {
      return {
        success: false,
        message: "Unable to find filter value",
        errors: { message: "Unable to find filter value" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    const network = await NetworkModel(tenant).findOne(filter).lean();

    logObject("network", network);

    if (!network) {
      return {
        success: false,
        message: "Bad Request Error",
        errors: { message: "Invalid Network Data" },
        status: httpStatus.BAD_REQUEST,
      };
    }

    const networkId = network._id;
    const responseFromDeleteNetwork = await NetworkModel(tenant).findByIdAndDelete(
      ObjectId(networkId)
    );

    if (!isEmpty(responseFromDeleteNetwork)) {
      return {
        success: true,
        message: "successfully deleted the network",
        status: httpStatus.OK,
        data: responseFromDeleteNetwork,
      };
    }

    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: "unable to delete the Network" },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const getNetwork = async (request, next) => {
  try {
    const { tenant } = request.query;
    const filter = generateFilter.networks(request, next);

    if (isEmpty(filter)) {
      return {
        success: false,
        message: "Unable to find filter value",
        errors: { message: "Unable to find filter value" },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }

    const network = await NetworkModel(tenant).findOne(filter).lean();

    if (!network) {
      return {
        success: false,
        message: "Network not found",
        errors: { message: "Network not found" },
        status: httpStatus.NOT_FOUND,
      };
    }

    return {
      success: true,
      message: "Successfully retrieved network",
      status: httpStatus.OK,
      data: network,
    };
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const createNetwork = async (request, next) => {
  try {
    const { query, body } = request;
    const { tenant } = query;
    const { admin_secret } = body;

    // 1. Verify that the secret is configured on the server
    if (!constants.ADMIN_SETUP_SECRET) {
      logger.error(
        "CRITICAL: ADMIN_SETUP_SECRET is not configured in environment variables."
      );
      return next(
        new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
          message: "Admin secret not configured on server",
        })
      );
    }

    // 2. Perform a constant-time comparison to prevent timing attacks
    const provided = Buffer.from(admin_secret || "");
    const expected = Buffer.from(constants.ADMIN_SETUP_SECRET);

    if (
      provided.length !== expected.length ||
      !crypto.timingSafeEqual(provided, expected)
    ) {
      return next(
        new HttpError("Forbidden", httpStatus.FORBIDDEN, {
          message: "Invalid admin secret provided",
        })
      );
    }

    const { admin_secret: _removed, ...sanitizedBody } = body;
    const responseFromCreateNetwork = await NetworkModel(tenant).register(
      sanitizedBody,
      next
    );
    return responseFromCreateNetwork;
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

module.exports = {
  getNetworkAdapter,
  listNetworks,
  getNetwork,
  updateNetwork,
  deleteNetwork,
  createNetwork,
};
