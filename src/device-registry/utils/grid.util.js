const GridModel = require("@models/Grid");
const SiteModel = require("@models/Site");
const CohortModel = require("@models/Cohort");
const ComputedCacheModel = require("@models/ComputedCache");
const qs = require("qs");
const DeviceModel = require("@models/Device");
const AdminLevelModel = require("@models/AdminLevel");
const geolib = require("geolib");
const shapefile = require("shapefile");
const AdmZip = require("adm-zip");
const { logObject, logText, HttpError } = require("@utils/shared");
const isEmpty = require("is-empty");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const { generateFilter, stringify } = require("@utils/common");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- create-grid-util`);
const mongoose = require("mongoose");
const { Kafka } = require("kafkajs");
const fs = require("fs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

// ---------------------------------------------------------------------------
// Two-level cache for the private-site-IDs aggregation.
//
// Why two levels?
//   L1 (in-memory): pod-local, sub-millisecond reads, lost on pod restart.
//   L2 (MongoDB):   shared across all Kubernetes replicas, survives restarts.
//
// Flow on each request:
//   1. L1 hit  → return immediately (nanoseconds).
//   2. L1 miss → check MongoDB document (one indexed findOne, ~1 ms).
//      2a. L2 hit  → populate L1 (TTL aligned to L2's absolute expiresAt), return.
//      2b. L2 miss → try to acquire a cross-pod lease.
//          Lease acquired   → run aggregation, write L2 + L1, release lease.
//          Lease not held   → back off 500 ms, re-read L2; if still empty,
//                             fall through to a local recompute so the
//                             request never stalls indefinitely.
//
// Within-pod concurrency: concurrent callers share a single in-flight
// Promise (_inflight map) so only one goroutine-equivalent pays the DB cost.
// ---------------------------------------------------------------------------
const _privateSiteIdsCache = new Map(); // Map prevents prototype-pollution attacks
const _inflight = new Map(); // per-tenant in-flight recompute promises
const PRIVATE_SITE_IDS_TTL_MS = 5 * 60 * 1000; // 5 minutes
const LOCK_TTL_MS = 30 * 1000; // 30-second lease; TTL index cleans stale locks
const PRIVATE_SITE_IDS_CACHE_KEY = "private_site_ids";
const PRIVATE_SITE_IDS_LOCK_KEY = "private_site_ids_lock";

// ---------------------------------------------------------------------------
// Two-tier L1 cache for GET /grids/summary (used by the Countries & Cities
// tabs in the Data Export page).
//
// Why two separate caches?
//   DATA cache (3 min): the paginated grid documents change whenever sites are
//     reassigned to grids or grid metadata is updated — relatively common.
//   COUNT cache (10 min): the total number of grids matching a given
//     admin_level filter is much more stable; splitting it out means that when
//     the data cache expires the expensive $count aggregation stage is skipped
//     and only the paginated pipeline runs, saving a meaningful round-trip.
//
// Both caches are pod-local (L1 only). The private-site-IDs cache (above) is
// already shared via MongoDB (L2); adding L2 here would duplicate that
// infra for a short-lived result that already benefits from the private-IDs
// cache's L2 freshness guarantees.
//
// Only the "summary" detailLevel is cached — the "full" (dashboard) level
// includes mobileDevice join data that changes more frequently.
// ---------------------------------------------------------------------------
const _gridSummaryDataCache = new Map();
const _gridSummaryCountCache = new Map();
const GRID_SUMMARY_DATA_TTL_MS = 3 * 60 * 1000; // 3 minutes
const GRID_SUMMARY_COUNT_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Stable string key for the summary data cache.
 * Includes all parameters that affect the paginated result set.
 */
function makeGridSummaryDataKey(tenant, filterHash, skip, limit, sortField, sortOrder, cohortKey, detailLevel) {
  return `${tenant}:${filterHash}:${skip}:${limit}:${sortField}:${sortOrder}:${cohortKey}:${detailLevel}`;
}

/**
 * Stable string key for the count-only cache.
 * Excludes pagination parameters — the total count is the same for all pages
 * of the same filter.
 */
function makeGridSummaryCountKey(tenant, filterHash, cohortKey, detailLevel) {
  return `${tenant}:${filterHash}:count:${cohortKey}:${detailLevel}`;
}

/**
 * Removes all entries whose TTL has elapsed from both summary caches.
 * Called on a background interval so entries added by uncommon
 * filter/pagination combinations don't accumulate indefinitely.
 */
function pruneExpiredGridSummaryCacheEntries() {
  const now = Date.now();
  for (const [key, entry] of _gridSummaryDataCache) {
    if (now >= entry.expiresAt) _gridSummaryDataCache.delete(key);
  }
  for (const [key, entry] of _gridSummaryCountCache) {
    if (now >= entry.expiresAt) _gridSummaryCountCache.delete(key);
  }
}
// Prune every 5 minutes. .unref() prevents the interval from keeping the
// Node.js process alive in test environments or during graceful shutdown.
setInterval(pruneExpiredGridSummaryCacheEntries, 5 * 60 * 1000).unref();

// ---------------------------------------------------------------------------
// Fix 3: derive the site field list from the shared projection definition.
//
// GRIDS_INCLUSION_PROJECTION.sites.$map.in holds exactly the $$site.* field
// mapping that the final $project stage applies.  Reusing it here means the
// early-reduction stage and the projection can never drift out of sync: adding
// or removing a site field in db-projections.js is automatically reflected in
// the $lookup reduction without any change to this file.
// ---------------------------------------------------------------------------
const _siteInclusionFields = constants.GRIDS_INCLUSION_PROJECTION.sites.$map.in;

/**
 * Returns the $addFields stage that reduces each looked-up site document to
 * only the fields consumed by GRIDS_INCLUSION_PROJECTION.  Running this
 * immediately after the $lookup means every downstream stage (private-site
 * filter, cohort filter, $project, $sort, $facet) operates on small
 * documents instead of full site objects.
 *
 * For "summary" detailLevel, latitude/longitude are omitted because the
 * summary path-strategy exclusion projection strips them anyway — fetching
 * them from disk would be wasted I/O.
 */
function buildSiteEarlyProjectionStage(detailLevel) {
  let siteFields = _siteInclusionFields;
  if (detailLevel === "summary") {
    // Omit fields that the summary exclusion projection removes, so they are
    // never read from disk in the first place.
    // eslint-disable-next-line no-unused-vars
    const { latitude, longitude, ...rest } = _siteInclusionFields;
    siteFields = rest;
  }
  return {
    $addFields: {
      sites: {
        $map: {
          input: "$sites",
          as: "site",
          in: siteFields,
        },
      },
    },
  };
}

/**
 * Builds the pagination meta object for grid list responses.
 * Extracted so both the cache-hit and cold paths produce identical shapes,
 * ensuring backward-compatible response structure regardless of cache state.
 */
function buildGridListMeta({ total, _skip, _limit, request }) {
  const meta = {
    total,
    limit: _limit,
    skip: _skip,
    page: Math.floor(_skip / _limit) + 1,
    totalPages: Math.ceil(total / _limit),
  };

  const baseUrl =
    typeof request.protocol === "string" &&
    typeof request.get === "function" &&
    typeof request.originalUrl === "string"
      ? `${request.protocol}://${request.get("host")}${
          request.originalUrl.split("?")[0]
        }`
      : "";

  if (baseUrl) {
    const nextSkip = _skip + _limit;
    if (nextSkip < total) {
      const nextQuery = { ...request.query, skip: nextSkip, limit: _limit };
      meta.nextPage = `${baseUrl}?${qs.stringify(nextQuery)}`;
    }
    const prevSkip = _skip - _limit;
    if (prevSkip >= 0) {
      const prevQuery = { ...request.query, skip: prevSkip, limit: _limit };
      meta.previousPage = `${baseUrl}?${qs.stringify(prevQuery)}`;
    }
  }

  return meta;
}

// Attempt to insert a lock document. Returns true when this pod holds the
// lease, false when another pod already has it (duplicate-key error 11000).
// Any other DB error is treated as "lease acquired" to avoid starvation.
async function acquireComputeLease(tenant) {
  try {
    await ComputedCacheModel(tenant).create({
      key: PRIVATE_SITE_IDS_LOCK_KEY,
      tenant,
      data: 1,
      computedAt: new Date(),
      expiresAt: new Date(Date.now() + LOCK_TTL_MS),
    });
    return true;
  } catch (err) {
    if (err.code === 11000) {
      return false; // another pod holds the lease
    }
    return true; // allow recompute on unexpected errors to avoid starvation
  }
}

// Delete the lock document so the next TTL cycle can start immediately.
// Fire-and-forget; the TTL index on expiresAt is the safety net.
async function releaseComputeLease(tenant) {
  try {
    await ComputedCacheModel(tenant).deleteOne({
      key: PRIVATE_SITE_IDS_LOCK_KEY,
      tenant,
    });
  } catch (_err) {
    // best-effort; TTL index will clean it up within LOCK_TTL_MS
  }
}

async function computePrivateSiteIds(tenant) {
  const result = await CohortModel(tenant).aggregate([
    { $match: { visibility: false } },
    {
      $lookup: {
        from: "devices",
        localField: "_id",
        foreignField: "cohorts",
        as: "devices",
      },
    },
    { $unwind: "$devices" },
    { $match: { "devices.site_id": { $ne: null } } },
    { $group: { _id: null, site_ids: { $addToSet: "$devices.site_id" } } },
  ]);
  return result.length > 0 ? result[0].site_ids : [];
}

async function getPrivateSiteIds(tenant) {
  // Normalise to the same effective tenant the models use, so L1 keys,
  // L2 filter values, and upsert documents are always consistent even when
  // the caller omits or passes an empty tenant.
  const normalizedTenant =
    (tenant && tenant.toString().trim().toLowerCase()) ||
    constants.DEFAULT_TENANT ||
    "airqo";

  const now = Date.now();

  // ── L1: in-memory (pod-local, sub-millisecond) ────────────────────────
  // L1 entry stores the absolute expiresAt (ms) taken from L2, so its
  // effective lifetime tracks L2's expiry rather than resetting on warm.
  const l1 = _privateSiteIdsCache.get(normalizedTenant);
  if (l1 && now < l1.expiresAt) {
    return l1.data;
  }

  // ── L2: MongoDB (shared across all pods, ~1 ms) ───────────────────────
  try {
    const l2 = await ComputedCacheModel(normalizedTenant)
      .findOne({ key: PRIVATE_SITE_IDS_CACHE_KEY, tenant: normalizedTenant })
      .lean();

    if (l2 && l2.expiresAt > new Date()) {
      // Fresh L2 hit — align L1 TTL to L2's absolute expiry timestamp
      _privateSiteIdsCache.set(normalizedTenant, {
        data: l2.data,
        expiresAt: l2.expiresAt.getTime(),
      });
      return l2.data;
    }
  } catch (err) {
    // L2 read failure is non-fatal: fall through to full recompute
    logger.warn(
      `ComputedCache L2 read failed for ${PRIVATE_SITE_IDS_CACHE_KEY}/${normalizedTenant}: ${err.message}`
    );
  }

  // ── Within-pod deduplication ──────────────────────────────────────────
  // If a recompute is already in-flight on this pod, piggyback on its
  // promise rather than spawning a second concurrent aggregation.
  const inflight = _inflight.get(normalizedTenant);
  if (inflight) {
    return inflight;
  }

  // ── Cross-pod deduplication (lease) + full recompute ─────────────────
  // Store the promise BEFORE the first await so that any concurrent caller
  // reaching this point on the same event-loop tick gets the same promise.
  const promise = (async () => {
    // hasLease is declared here so the finally block can see it.
    let hasLease = false;
    try {
      hasLease = await acquireComputeLease(normalizedTenant);

      if (!hasLease) {
        // Another pod is already computing. Back off and re-read L2.
        await new Promise((resolve) => setTimeout(resolve, 500));
        try {
          const l2Retry = await ComputedCacheModel(normalizedTenant)
            .findOne({
              key: PRIVATE_SITE_IDS_CACHE_KEY,
              tenant: normalizedTenant,
            })
            .lean();
          if (l2Retry && l2Retry.expiresAt > new Date()) {
            _privateSiteIdsCache.set(normalizedTenant, {
              data: l2Retry.data,
              expiresAt: l2Retry.expiresAt.getTime(),
            });
            return l2Retry.data;
          }
        } catch (_err) {
          // fall through to local recompute so the request never stalls
        }
      }

      // ── Full aggregation ─────────────────────────────────────────────
      const data = await computePrivateSiteIds(normalizedTenant);
      const expiresAt = new Date(now + PRIVATE_SITE_IDS_TTL_MS);

      // Write L1 (aligned to L2's expiresAt)
      _privateSiteIdsCache.set(normalizedTenant, {
        data,
        expiresAt: expiresAt.getTime(),
      });

      // Write L2 — fire-and-forget so a cache write failure never blocks
      // the API response. $setOnInsert keeps key/tenant explicit on insert
      // so the unique-index filter is never the sole source of those fields.
      ComputedCacheModel(normalizedTenant)
        .findOneAndUpdate(
          { key: PRIVATE_SITE_IDS_CACHE_KEY, tenant: normalizedTenant },
          {
            $set: { data, computedAt: new Date(now), expiresAt },
            $setOnInsert: {
              key: PRIVATE_SITE_IDS_CACHE_KEY,
              tenant: normalizedTenant,
            },
          },
          { upsert: true, new: false }
        )
        .catch((err) =>
          logger.warn(
            `ComputedCache L2 write failed for ${PRIVATE_SITE_IDS_CACHE_KEY}/${normalizedTenant}: ${err.message}`
          )
        );

      return data;
    } finally {
      _inflight.delete(normalizedTenant);
      if (hasLease) {
        releaseComputeLease(normalizedTenant); // fire-and-forget, TTL is safety net
      }
    }
  })();

  _inflight.set(normalizedTenant, promise);
  return promise;
}

function filterOutPrivateIDs(privateIds, randomIds) {
  // Create a Set from the privateIds array
  const privateIdSet = new Set(privateIds);

  // Check if privateIds array is empty
  if (privateIdSet.size === 0) {
    return randomIds;
  }

  // Filter randomIds array to exclude privateIds
  const filteredIds = randomIds.filter(
    (randomId) => !privateIdSet.has(randomId)
  );

  return filteredIds;
}

const getSiteIdsFromCohort = async (tenant, cohort_id) => {
  try {
    const cohortIdArray = Array.isArray(cohort_id)
      ? cohort_id
      : cohort_id.split(",").map((id) => id.trim());

    const devicesInCohort = await DeviceModel(tenant)
      .find({
        cohorts: { $in: cohortIdArray },
        site_id: { $ne: null },
      })
      .distinct("site_id");

    if (devicesInCohort.length === 0) {
      return {
        success: true,
        data: [],
        message: "No sites found for the specified cohort(s).",
      };
    }

    return {
      success: true,
      data: devicesInCohort,
      message: "Successfully retrieved site IDs from cohort(s).",
    };
  } catch (error) {
    logger.error(`Error in getSiteIdsFromCohort: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
    };
  }
};

const createGrid = {
  batchCreate: async (request, next) => {
    try {
      const { shape } = request.body; // Assuming the input data is passed in the request body as 'data' field
      const { coordinates, type } = shape;
      const batchSize = 100; // Define the size of each batch
      const totalBatches = Math.ceil(data.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, coordinates.length);
        const batchData = coordinates.slice(startIdx, endIdx);

        // Process the batch of data using the Grid Schema
        const gridModels = batchData.map((item) => {
          // Perform any necessary transformations on 'item' before creating a Grid Model
          return new GridModel(tenant)(item);
        });

        // Bulk insert the gridModels using your preferred method (e.g., mongoose insertMany)
        await GridModel(tenant).insertMany(gridModels);
      }

      /************* END batch processing ************ */
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  create: async (request, next) => {
    try {
      const { tenant } = request.query;
      let modifiedBody = request.body;
      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        request,
        next
      );
      logObject(
        "responseFromCalculateGeographicalCenter",
        responseFromCalculateGeographicalCenter
      );
      if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      } else {
        modifiedBody["centers"] = responseFromCalculateGeographicalCenter.data;

        if (
          modifiedBody.admin_level &&
          modifiedBody.admin_level.toLowerCase() === "country"
        ) {
          modifiedBody.flag_url = constants.getFlagUrl(modifiedBody.name);
        }
        // logObject("modifiedBody", modifiedBody);

        const responseFromRegisterGrid = await GridModel(tenant).register(
          modifiedBody,
          next
        );

        // logObject("responseFromRegisterGrid in UTIL", responseFromRegisterGrid);

        if (responseFromRegisterGrid.success === true) {
          try {
            const kafkaProducer = kafka.producer({
              groupId: constants.UNIQUE_PRODUCER_GROUP,
            });
            await kafkaProducer.connect();
            await kafkaProducer.send({
              topic: constants.GRID_TOPIC,
              messages: [
                {
                  action: "create",
                  value: stringify(responseFromRegisterGrid.data),
                },
              ],
            });
            await kafkaProducer.disconnect();
          } catch (error) {
            logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
          }
          return responseFromRegisterGrid;
        } else if (responseFromRegisterGrid.success === false) {
          return responseFromRegisterGrid;
        }
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  update: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;

      const update = body;
      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromModifyGrid = await GridModel(tenant).modify(
          {
            filter,
            update,
          },
          next
        );
        return responseFromModifyGrid;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  delete: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { query } = request;
      const { tenant } = query;
      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      } else {
        const responseFromRemoveGrid = await GridModel(tenant).remove(
          {
            filter,
          },
          next
        );
        return responseFromRemoveGrid;
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  refresh: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;
      const BATCH_SIZE = 50;

      if (isEmpty(grid_id)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "the Grid Object ID is required",
          })
        );
        return;
      }

      const grid = await GridModel(tenant).findById(grid_id);
      logObject("grid", grid);

      if (!grid) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          })
        );
        return;
      }

      const responseFromFindSites = await createGrid.findSites(
        request,
        grid.shape,
        next
      );

      if (responseFromFindSites.success === false) {
        return responseFromFindSites;
      } else if (isEmpty(responseFromFindSites.data)) {
        return {
          success: true,
          message: `Refresh successful but NO active sites yet for Grid ${grid_id.toString()}`,
          status: httpStatus.OK,
        };
      }

      const site_ids = responseFromFindSites.data.map(({ _id }) =>
        _id.toString()
      );

      // Create an array to hold all operations
      const operations = [];

      // Process the  active site_ids in batches
      for (let i = 0; i < site_ids.length; i += BATCH_SIZE) {
        const batchSiteIds = site_ids.slice(i, i + BATCH_SIZE);
        // Add new grid_id to sites
        operations.push({
          updateMany: {
            filter: {
              _id: { $in: batchSiteIds },
              grids: { $ne: grid_id.toString() },
            },
            update: {
              $addToSet: { grids: grid_id.toString() },
            },
          },
        });
      }

      // Execute the bulk operation
      const addToSetResponse = await SiteModel(tenant).bulkWrite(operations);
      logObject("addToSetResponse", addToSetResponse);

      // Check if addToSet operation was successful
      if (!addToSetResponse.ok) {
        logger.error(
          `🐛🐛 Internal Server Error -- Some associated sites may not have been updated during Grid refresh`
        );
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: `Only ${addToSetResponse.nModified} out of ${site_ids.length} sites were updated`,
            }
          )
        );
        return;
      }

      try {
        // Remove the Grid from INACTIVE Sites
        const pullResponse = await SiteModel(tenant).updateMany(
          {
            _id: { $nin: site_ids }, // select INACTIVE sites
            grids: { $in: [grid_id.toString()] }, // Select sites that contain the grid_id
          },
          {
            $pull: { grids: grid_id.toString() }, // Remove grid_id from the selected sites
          }
        );

        logObject("pullResponse", pullResponse);

        // Check if pull operation was successful
        if (!pullResponse.ok) {
          logger.error(
            `🐛🐛 Internal Server Error -- Some associated sites may not have been updated during Grid refresh`
          );
        }
      } catch (error) {
        logger.error(
          `🐛🐛 Internal Server Error -- grid refresh -- Remove the Grid from INACTIVE Sites -- ${stringify(
            error
          )}`
        );
      }

      return {
        success: true,
        message: `The Refresh for Grid ${grid_id.toString()} has been successful`,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },
  calculateGeographicalCenter: async (request, next) => {
    try {
      const { coordinates, type } = request.body.shape;
      logObject("coordinates", coordinates);
      logObject("type", type);

      if (isEmpty(coordinates)) {
        return {
          success: false,
          message: "Missing coordinates to calculate the center of the grid",
          errors: { message: "Missing coordinates" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let centers = [];
      if (type === "Polygon") {
        const flattenedPolygon = coordinates.flat();
        centers = [geolib.getCenter(flattenedPolygon)];
      } else if (type === "MultiPolygon") {
        const flattenedPolygons = coordinates.map((polygon) => polygon.flat());
        centers = flattenedPolygons.map((polygon) => geolib.getCenter(polygon));
      }

      return {
        success: true,
        message: "Successfully calculated the centers",
        data: centers,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  findSites: async (request, shape, next) => {
    try {
      logText("we are now finding Sites................");
      const { query } = request;
      const { tenant } = query;

      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === false) {
        return filter;
      }

      if (isEmpty(filter)) {
        return {
          success: false,
          message: "Internal Server Error",
          errors: { message: "Getting an empty filter object for grids" },
          status: httpStatus.INTERNAL_SERVER_ERROR,
        };
      }

      const grid = await GridModel(tenant)
        .findOne(filter)
        .lean();

      logObject("the grid in findSites", grid);

      if (isEmpty(grid)) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Unable to find the provided grid model" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      let gridPolygon = [];
      const { type, coordinates } = shape;

      if (type === "Polygon") {
        gridPolygon = coordinates[0].map(([longitude, latitude]) => ({
          longitude,
          latitude,
        }));
      } else if (type === "MultiPolygon") {
        coordinates.forEach((polygon) => {
          const polygonPoints = polygon[0].map(([longitude, latitude]) => ({
            longitude,
            latitude,
          }));
          gridPolygon.push(...polygonPoints);
        });
      }

      const sitesWithDeployedDevices = await DeviceModel(tenant).distinct(
        "site_id"
      );

      // logObject("sitesWithDeployedDevices", sitesWithDeployedDevices);

      // Calculate the bounding box of the grid polygon
      const minLongitude = Math.min(
        ...gridPolygon.map((point) => point.longitude)
      );
      const maxLongitude = Math.max(
        ...gridPolygon.map((point) => point.longitude)
      );
      const minLatitude = Math.min(
        ...gridPolygon.map((point) => point.latitude)
      );
      const maxLatitude = Math.max(
        ...gridPolygon.map((point) => point.latitude)
      );

      // Fetch only sites within the bounding box
      const sites = await SiteModel(tenant)
        .find({
          _id: { $in: sitesWithDeployedDevices },
          longitude: { $gte: minLongitude, $lte: maxLongitude },
          latitude: { $gte: minLatitude, $lte: maxLatitude },
        })
        .lean();

      const site_ids = sites
        .filter(
          ({ latitude, longitude }) => !isEmpty(latitude) && !isEmpty(longitude)
        )
        .filter(({ latitude, longitude }) =>
          geolib.isPointInPolygon({ latitude, longitude }, gridPolygon)
        )
        .map(({ _id }) => _id);

      const successMessage = isEmpty(site_ids)
        ? "No associated Sites found"
        : "Successfully searched for the associated Sites";

      return {
        success: true,
        message: successMessage,
        data: site_ids,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
      return;
    }
  },

  list: async (request, next) => {
    try {
      const {
        tenant,
        limit,
        skip,
        detailLevel = "full",
        sortBy,
        order,
      } = request.query;
      const { cohort_id } = request.query;
      const filter = generateFilter.grids(request, next);

      // Normalise tenant once, up-front, so cache keys and every model call
      // below use the identical string.  Without this, a caller that passes
      // "AirQo" (mixed-case) would produce a cache key of "airqo" but query
      // a different logical DB, potentially returning cached data from another
      // tenant's request — a cross-tenant data leak.
      const normalizedTenant =
        (tenant && tenant.toString().trim().toLowerCase()) ||
        constants.DEFAULT_TENANT ||
        "airqo";

      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));
      const sortOrder = order === "asc" ? 1 : -1;
      const sortField = sortBy ? sortBy : "createdAt";

      let cohortSiteIds = [];
      if (cohort_id && cohort_id.trim() !== "") {
        const siteIdsResponse = await getSiteIdsFromCohort(normalizedTenant, cohort_id);
        if (!siteIdsResponse.success) {
          return siteIdsResponse; // Propagate error
        }
        cohortSiteIds = siteIdsResponse.data;
      }

      // Handle case where cohort_id is provided but no sites are found
      if (cohort_id && cohortSiteIds.length === 0) {
        logger.info(`No sites found for cohort_id: ${cohort_id}`);
        return {
          success: true,
          message: "No grids found for the specified cohort(s).",
          data: [],
          status: httpStatus.OK,
          meta: {
            total: 0,
            limit: _limit,
            skip: _skip,
            page: 1,
            totalPages: 0,
          },
        };
      }

      // Use cached helper — avoids a full Cohort→Device join on every request.
      // Cache is per-tenant with a 5-minute TTL (see getPrivateSiteIds above).
      const privateSiteIds = await getPrivateSiteIds(normalizedTenant);

      // ── Fix 3 + Fix 4: L1 cache check ─────────────────────────────────────
      // Only cache "summary" responses — "full" (dashboard) includes mobile-
      // device join data that changes more frequently and benefits less from
      // short-lived caching.
      const shouldCache = detailLevel === "summary";
      const filterHash = JSON.stringify(filter);
      const cohortKey =
        cohortSiteIds.length > 0
          ? JSON.stringify(cohortSiteIds.map((id) => id.toString()).sort())
          : "none";
      const now = Date.now();

      let cachedTotal = null; // populated from count cache when available

      if (shouldCache) {
        const dataCacheKey = makeGridSummaryDataKey(
          normalizedTenant, filterHash, _skip, _limit,
          sortField, sortOrder, cohortKey, detailLevel
        );
        const cachedData = _gridSummaryDataCache.get(dataCacheKey);
        if (cachedData) {
          if (now < cachedData.expiresAt) {
            // Full L1 data hit — recompute meta URLs from the live request so
            // nextPage/previousPage reflect the actual host on every call.
            const { paginatedResults, total } = cachedData;
            const meta = buildGridListMeta({ total, _skip, _limit, request });
            return {
              success: true,
              message: "Successfully retrieved grids",
              data: paginatedResults,
              status: httpStatus.OK,
              meta,
            };
          }
          // Lazy eviction: remove the stale entry immediately on read rather
          // than waiting for the background pruning interval.
          _gridSummaryDataCache.delete(dataCacheKey);
        }

        // Data cache missed; check count cache so we can skip the $count stage.
        const countCacheKey = makeGridSummaryCountKey(
          normalizedTenant, filterHash, cohortKey, detailLevel
        );
        const cachedCount = _gridSummaryCountCache.get(countCacheKey);
        if (cachedCount) {
          if (now < cachedCount.expiresAt) {
            cachedTotal = cachedCount.total;
          } else {
            _gridSummaryCountCache.delete(countCacheKey); // lazy eviction
          }
        }
      }
      // ── End cache check ────────────────────────────────────────────────────

      const exclusionProjection = constants.GRIDS_EXCLUSION_PROJECTION(
        detailLevel
      );

      // ── Fix 2: Build base pipeline with early site-field projection ────────
      // The $lookup fetches full site documents. The stage immediately after it
      // ($map) reduces each site to only the fields that GRIDS_INCLUSION_PROJECTION
      // actually uses, shrinking the working set for every downstream stage
      // (private-site filter, cohort filter, $project, $sort, $facet).
      const basePipeline = [
        { $match: filter },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "grids", // uses the new { grids: 1 } index on sites
            as: "sites",
          },
        },
        // Early projection — reduce site documents to only needed fields before
        // any filtering stage touches them (Fix 2).
        buildSiteEarlyProjectionStage(detailLevel),
        // Filter out private sites (IDs are pre-cached by getPrivateSiteIds).
        {
          $addFields: {
            sites: {
              $filter: {
                input: "$sites",
                as: "site",
                cond: { $not: { $in: ["$$site._id", privateSiteIds] } },
              },
            },
          },
        },
        // If cohort_id is provided, further restrict to cohort-member sites.
        {
          $addFields: {
            sites: cohort_id
              ? {
                  $filter: {
                    input: "$sites",
                    as: "site",
                    cond: { $in: ["$$site._id", cohortSiteIds] },
                  },
                }
              : "$sites",
          },
        },
      ];

      if (detailLevel === "full") {
        basePipeline.push({
          $lookup: {
            from: "devices",
            localField: "activeMobileDevices.device_id",
            foreignField: "_id",
            as: "mobileDevices",
          },
        });
      }

      basePipeline.push(
        { $project: constants.GRIDS_INCLUSION_PROJECTION },
        { $project: exclusionProjection }
      );
      // ── End base pipeline ──────────────────────────────────────────────────

      let paginatedResults;
      let total;

      if (shouldCache && cachedTotal !== null) {
        // ── Fix 4: count cache hit — skip the $count stage entirely ──────────
        // Run only the paginated data pipeline; the total is served from cache.
        // This is the common case once the count warms up (10-min TTL).
        const dataOnlyPipeline = [
          ...basePipeline,
          { $sort: { [sortField]: sortOrder } },
          { $skip: _skip },
          { $limit: _limit },
        ];
        paginatedResults = await GridModel(normalizedTenant)
          .aggregate(dataOnlyPipeline)
          .option({ maxTimeMS: 45000 })
          .allowDiskUse(true);
        total = cachedTotal;
      } else {
        // ── Cold path — run $facet to get data + count in one aggregation ─────
        const facetPipeline = [
          ...basePipeline,
          {
            $facet: {
              paginatedResults: [
                { $sort: { [sortField]: sortOrder } },
                { $skip: _skip },
                { $limit: _limit },
              ],
              totalCount: [{ $count: "count" }],
            },
          },
        ];

        const results = await GridModel(normalizedTenant)
          .aggregate(facetPipeline)
          .option({ maxTimeMS: 45000 })
          .allowDiskUse(true);

        const agg =
          Array.isArray(results) && results[0]
            ? results[0]
            : { paginatedResults: [], totalCount: [] };
        paginatedResults = agg.paginatedResults || [];
        total =
          Array.isArray(agg.totalCount) && agg.totalCount[0]
            ? agg.totalCount[0].count
            : 0;

        // Cache the count with the longer TTL (Fix 4).
        if (shouldCache) {
          const countCacheKey = makeGridSummaryCountKey(
            normalizedTenant, filterHash, cohortKey, detailLevel
          );
          _gridSummaryCountCache.set(countCacheKey, {
            total,
            expiresAt: now + GRID_SUMMARY_COUNT_TTL_MS,
          });
        }
      }

      // Cache the paginated data (Fix 3).
      if (shouldCache) {
        const dataCacheKey = makeGridSummaryDataKey(
          normalizedTenant, filterHash, _skip, _limit,
          sortField, sortOrder, cohortKey, detailLevel
        );
        _gridSummaryDataCache.set(dataCacheKey, {
          paginatedResults,
          total,
          expiresAt: now + GRID_SUMMARY_DATA_TTL_MS,
        });
      }

      const meta = buildGridListMeta({ total, _skip, _limit, request });

      return {
        success: true,
        message: "Successfully retrieved grids",
        data: paginatedResults,
        status: httpStatus.OK,
        meta,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  updateShape: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { shape, update_reason } = body;

      const filter = generateFilter.grids(request, next);
      if (filter.success && filter.success === "false") {
        return filter;
      }

      // First, get the existing grid to validate it exists
      const existingGrid = await GridModel(tenant)
        .findOne(filter)
        .lean();
      if (!existingGrid) {
        return {
          success: false,
          message: "Grid not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "The specified grid does not exist" },
        };
      }

      // Calculate new centers for the updated shape
      const modifiedRequest = {
        ...request,
        body: { shape },
      };

      const responseFromCalculateGeographicalCenter = await createGrid.calculateGeographicalCenter(
        modifiedRequest,
        next
      );

      if (responseFromCalculateGeographicalCenter.success === false) {
        return responseFromCalculateGeographicalCenter;
      }

      const newCenters = responseFromCalculateGeographicalCenter.data;

      // Prepare the update object with shape and recalculated centers
      const update = {
        shape,
        centers: newCenters,
        $push: {
          shape_update_history: {
            updated_at: new Date(),
            reason: update_reason,
            previous_shape: existingGrid.shape,
            previous_centers: existingGrid.centers,
          },
        },
      };

      const responseFromUpdateGridShape = await GridModel(tenant).modifyShape(
        {
          filter,
          update,
        },
        next
      );

      if (responseFromUpdateGridShape.success === true) {
        // Refresh the grid to update associated sites with new boundaries
        try {
          const refreshRequest = {
            ...request,
            params: { grid_id: existingGrid._id.toString() },
          };
          await createGrid.refresh(refreshRequest, next);
        } catch (refreshError) {
          logger.error(
            `Grid shape updated but refresh failed: ${refreshError.message}`
          );
        }
      }

      return responseFromUpdateGridShape;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /************* admin levels **************************************/
  listAdminLevels: async (request, next) => {
    try {
      const { tenant, limit, skip } = request.query;
      const filter = generateFilter.admin_levels(request, next);
      const _skip = Math.max(0, parseInt(skip, 10) || 0);
      const _limit = Math.max(1, Math.min(parseInt(limit, 10) || 30, 80));

      const responseFromListAdminLevels = await AdminLevelModel(tenant).list(
        {
          filter,
          limit: _limit,
          skip: _skip,
        },
        next
      );
      return responseFromListAdminLevels;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  updateAdminLevel: async (request, next) => {
    try {
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request, next);

      logObject("filter", filter);
      const update = request.body;
      const responseFromUpdateAdminLevel = await AdminLevelModel(tenant).modify(
        {
          filter,
          update,
        },
        next
      );
      logObject("responseFromUpdateAdminLevel", responseFromUpdateAdminLevel);
      return responseFromUpdateAdminLevel;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  deleteAdminLevel: async (request, next) => {
    try {
      return {
        success: false,
        message: "feature temporarily disabled --coming soon",
        status: httpStatus.SERVICE_UNAVAILABLE,
        errors: { message: "Service Unavailable" },
      };
      const { tenant } = request.query;
      const filter = generateFilter.admin_levels(request, next);

      const responseFromDeleteAdminLevel = await AdminLevelModel(tenant).remove(
        {
          filter,
        },
        next
      );
      return responseFromDeleteAdminLevel;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createAdminLevel: async (request, next) => {
    try {
      const { tenant } = request.query;
      const responseFromCreateAdminLevel = await AdminLevelModel(
        tenant
      ).register(request.body, next);
      return responseFromCreateAdminLevel;
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  /********************* manage grids **********************************  */
  findGridUsingGPSCoordinates: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { latitude, longitude } = body;

      const grids = await GridModel(tenant)
        .find()
        .lean();

      const matchingGrid = grids.find((grid) => {
        const { type, coordinates } = grid.shape;
        if (type === "Polygon") {
          const polygon = coordinates[0].map(([longitude, latitude]) => ({
            latitude,
            longitude,
          }));
          return geolib.isPointInPolygon({ latitude, longitude }, polygon);
        } else if (type === "MultiPolygon") {
          const polygons = coordinates.map((polygon) =>
            polygon[0].map(([longitude, latitude]) => ({
              latitude,
              longitude,
            }))
          );
          return polygons.some((polygon) =>
            geolib.isPointInPolygon({ latitude, longitude }, polygon)
          );
        }
        return false;
      });

      if (!matchingGrid) {
        return {
          success: true,
          message: "No Grid found for the provided coordinates",
          status: httpStatus.OK,
          data: [],
        };
      }

      return {
        success: true,
        message: "Grid found",
        data: matchingGrid,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  createGridFromShapefile: async (request, next) => {
    const uploadedFile = request.file;
    const shapefilePath = uploadedFile.path;
    try {
      const zip = new AdmZip(uploadedFile.path);
      zip.extractAllTo("uploads/", true);
      logObject("uploadedFile", uploadedFile);
      logObject("shapefilePath", shapefilePath);
      const file = await shapefile.open(shapefilePath);
      const source = await file.source();

      // Read all features from the shapefile
      const features = [];
      while (true) {
        const result = await source.read();
        if (result.done) break;
        features.push(result.value);
      }

      const coordinates = features[0].geometry.coordinates;
      const shapeType = features[0].geometry.type;

      const gridData = {
        shape: {
          type: shapeType,
          coordinates: coordinates,
        },
      };
      fs.unlinkSync(shapefilePath);
      return {
        success: true,
        data: gridData,
        message: "Successfully retrieved the Grid format",
        status: httpStatus.OK,
      };
    } catch (error) {
      logObject("error", error);
      if (fs.existsSync(shapefilePath)) {
        fs.unlinkSync(shapefilePath);
      }
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAvailableSites: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;

      const grid = await GridModel(tenant).findById(grid_id);

      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const assignedSiteIds = await DeviceModel(tenant)
        .distinct("site_id", { site_id: { $exists: true } })
        .lean();

      const sites = await createGrid.findSites(request, grid.shape, next);

      const availableSites = Array.isArray(sites)
        ? sites.filter(({ _id }) => !assignedSiteIds.includes(_id.toString()))
        : [];

      return {
        success: true,
        message: `Retrieved all available sites for grid ${grid_id}`,
        data: availableSites,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listAssignedSites: async (request, next) => {
    try {
      const { tenant } = request.query;
      const { grid_id } = request.params;
      const grid = await GridModel(tenant).findById(grid_id);
      if (!grid) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: {
            message: `Invalid grid ID ${grid_id}, please crosscheck`,
          },
          status: httpStatus.BAD_REQUEST,
        };
      }

      const responseFromListAssignedSites = await SiteModel(tenant)
        .aggregate([
          {
            $match: {
              grids: { $in: [grid_id] },
            },
          },
          {
            $project: {
              _id: 1,
              name: 1,
              long_name: 1,
              description: 1,
              generated_name: 1,
              country: 1,
              district: 1,
              region: 1,
              createdAt: {
                $dateToString: {
                  format: "%Y-%m-%d %H:%M:%S",
                  date: "$_id",
                },
              },
            },
          },
        ])
        .option({ maxTimeMS: 45000 })
        .exec();

      logObject("responseFromListAssignedSites", responseFromListAssignedSites);

      return {
        success: true,
        message: `retrieved all assigned sites for grid ${grid_id}`,
        data: responseFromListAssignedSites,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  getSiteAndDeviceIds: async (request, next) => {
    try {
      const { grid_id, tenant } = { ...request.query, ...request.params };
      const gridDetails = await GridModel(tenant).findById(grid_id);
      if (isEmpty(gridDetails)) {
        return {
          success: false,
          message: "Bad Request Errors",
          errors: { message: "This Grid does not exist" },
          status: httpStatus.BAD_REQUEST,
        };
      }
      // Fetch sites based on the provided Grid ID
      const sites = await SiteModel(tenant).find({ grids: grid_id });

      // Extract site IDs from the fetched sites
      const site_ids = sites.map((site) => site._id);

      // Fetch devices for each site concurrently
      const device_ids_promises = site_ids.map(async (siteId) => {
        const devices = await DeviceModel(tenant).find({ site_id: siteId });
        return devices.map((device) => device._id);
      });

      const device_ids = await Promise.all(device_ids_promises).then((ids) =>
        ids.flat()
      );

      logObject("site_ids:", site_ids);
      logObject("device_ids:", device_ids);

      return {
        success: true,
        message: "Successfully returned the Site IDs and the Device IDs",
        status: httpStatus.OK,
        data: { site_ids, device_ids },
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  filterOutPrivateSites: async (request, next) => {
    try {
      const { tenant, sites, site_ids, site_names } = {
        ...request.body,
        ...request.query,
        ...request.params,
      };
      const privateGrids = await GridModel(tenant)
        .find({
          visibility: false,
        })
        .select("_id")
        .lean();

      const privateGridIds = privateGrids.map((grid) => grid._id);
      const privateSites = await SiteModel(tenant).find({
        grids: { $in: privateGridIds },
      });

      const privateSiteIds = privateSites.map((site) => site._id.toString());
      const privateSiteNames = privateSites.map((site) => site.generated_name);

      let idsForSites, siteIds, siteNames;

      if (sites || site_ids) {
        idsForSites = sites ? sites : site_ids || [];
        siteIds = idsForSites.map((site) => site.toString());
      } else if (site_names) {
        siteNames = site_names;
      }

      let publicSites;
      if (siteIds) {
        publicSites = filterOutPrivateIDs(privateSiteIds, siteIds);
      } else if (siteNames) {
        publicSites = filterOutPrivateIDs(privateSiteNames, siteNames);
      }

      return {
        success: true,
        status: httpStatus.OK,
        data: publicSites,
        message: "operation successful",
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  findNearestCountry: async (request, next) => {
    try {
      const { query, body } = request;
      const { tenant } = query;
      const { latitude, longitude } = body;
      const { limit = 1 } = query; // Default to returning just 1 nearest country

      // Validate the inputs
      if (!latitude || !longitude) {
        return {
          success: false,
          message: "Bad Request Error",
          errors: { message: "Both latitude and longitude are required" },
          status: httpStatus.BAD_REQUEST,
        };
      }

      // Find grids where admin_level is 'country'
      const countryGrids = await GridModel(tenant)
        .find({ admin_level: "country" })
        .lean();

      if (isEmpty(countryGrids)) {
        return {
          success: true,
          message: "No country grids found in the database",
          status: httpStatus.OK,
          data: [],
        };
      }

      // Calculate distance to each country's center point
      const countriesWithDistances = countryGrids.map((grid) => {
        // Use the first center point of the grid
        if (isEmpty(grid.centers) || isEmpty(grid.centers[0])) {
          return {
            ...grid,
            distance: Number.MAX_VALUE, // If no center point, set to max distance
          };
        }

        const center = grid.centers[0];
        const distance = geolib.getDistance(
          { latitude, longitude },
          { latitude: center.latitude, longitude: center.longitude }
        );

        return {
          ...grid,
          distance,
        };
      });

      // Sort by distance (ascending)
      const sortedCountries = countriesWithDistances.sort(
        (a, b) => a.distance - b.distance
      );

      // Return the nearest country(ies) based on the limit
      const nearestCountries = sortedCountries.slice(0, Number(limit));

      return {
        success: true,
        message: "Successfully found nearest country(ies)",
        data: nearestCountries,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  listCountries: async (request, next) => {
    try {
      const { tenant, cohort_id } = request.query;
      // Use cached helper — avoids a full Cohort→Device join on every request.
      // Cache is per-tenant with a 5-minute TTL (see getPrivateSiteIds above).
      const privateSiteIds = await getPrivateSiteIds(tenant);

      let cohortSiteIds = [];
      if (cohort_id) {
        const siteIdsResponse = await getSiteIdsFromCohort(tenant, cohort_id);
        if (!siteIdsResponse.success) {
          return siteIdsResponse;
        }
        cohortSiteIds = siteIdsResponse.data;

        // If a cohort_id is provided but no sites are found for it, return an empty array.
        if (cohortSiteIds.length === 0) {
          return {
            success: true,
            message: "No countries found for the specified cohort(s).",
            data: [],
            status: httpStatus.OK,
          };
        }
      }

      const pipeline = [
        {
          $match: { admin_level: "country" },
        },
        {
          $lookup: {
            from: "sites",
            localField: "_id",
            foreignField: "grids",
            as: "sites",
          },
        },
        {
          $addFields: {
            sites: {
              $filter: {
                input: "$sites",
                as: "site",
                cond:
                  cohort_id && cohortSiteIds.length > 0
                    ? {
                        $and: [
                          { $not: { $in: ["$$site._id", privateSiteIds] } },
                          { $in: ["$$site._id", cohortSiteIds] },
                        ],
                      }
                    : { $not: { $in: ["$$site._id", privateSiteIds] } },
              },
            },
          },
        },
        {
          $project: {
            _id: 0,
            country: { $toLower: "$name" },
            sites: { $size: "$sites" },
          },
        },
        {
          $match: { sites: { $gt: 0 } },
        },
        {
          $sort: {
            country: 1,
          },
        },
      ];

      const results = await GridModel(tenant)
        .aggregate(pipeline)
        .option({ maxTimeMS: 45000 })
        .allowDiskUse(true);

      const countriesWithFlags = results.map((countryData) => {
        // Safely handle null or undefined country names
        const rawCountryName =
          typeof countryData.country === "string" ? countryData.country : "";

        // Normalize name: handle underscores, hyphens, apostrophes, and extra spaces
        // before converting to a standardized Title Case format.
        const formattedCountryName = rawCountryName
          .replace(/_/g, " ")
          .split(/(\s+|-|')/) // Split by spaces, hyphens, or apostrophes, keeping delimiters
          .filter(Boolean) // Remove empty strings from the result
          .map((part) => {
            // Only capitalize word parts, not delimiters
            if (part.match(/^[a-zA-Z0-9]+$/)) {
              return (
                part.charAt(0).toLocaleUpperCase() + part.slice(1).toLowerCase()
              );
            }
            return part; // Return delimiters as is
          })
          .join("")
          .trim();

        return {
          ...countryData,
          flag_url: constants.getFlagUrl(formattedCountryName),
        };
      });

      return {
        success: true,
        message: "Successfully retrieved countries and site counts.",
        data: countriesWithFlags,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

// Exported under private-convention names so unit tests can exercise the
// two-level cache logic directly without going through a full HTTP request.
// Not intended for use outside of tests.
createGrid._getPrivateSiteIds = getPrivateSiteIds;
createGrid._clearPrivateSiteIdsCache = () => {
  _privateSiteIdsCache.clear();
  _inflight.clear();
};

module.exports = createGrid;
