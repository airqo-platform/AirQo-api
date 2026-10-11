// public-cohort.util.js
//
// Maintains the "public cohort": a small, rotating sample of public devices
// (DEFAULT_DEVICES_PER_GRID per lowest-level Grid) offered to consumers who
// want network-wide coverage without being handed every device.
//
// LOWEST-LEVEL GRID:
//   Grids carry no parent pointer — nesting is only observable through site
//   membership (Site.grids lists every Grid a site falls in, e.g. both its
//   city and its country). A Grid is therefore treated as lowest-level when
//   no other Grid's site set is a strict subset of its own. Grids with no
//   sites are ignored.
//
// NO DUPLICATES:
//   Lowest-level Grids can still overlap (or share an identical site set).
//   Grids are processed smallest-first and a device already selected for one
//   Grid counts towards the quota of every other Grid it sits in, so it is
//   never selected twice and overlapping Grids are not over-represented.
//
// REPLACEMENT:
//   A device is eligible only while it is public, active, deployed at a site
//   and has been seen within max_offline_hours. Existing members that are
//   still eligible are retained; the rest are dropped and replaced at random
//   from the Grid's other eligible devices. When a Grid has too few eligible
//   devices it is simply left under-represented.
const httpStatus = require("http-status");
const constants = require("@config/constants");
const CohortModel = require("@models/Cohort");
const DeviceModel = require("@models/Device");
const SiteModel = require("@models/Site");
const GridModel = require("@models/Grid");
const SystemConfigModel = require("@models/SystemConfig");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- public-cohort-util`,
);

const CONFIG_KEY = "public_cohort_config";
// Kept apart from CONFIG_KEY so the weekly refresh recording its outcome
// does not bump the admin-facing config's version/updated_by.
const STATE_KEY = "public_cohort_state";
const PUBLIC_COHORT_NAME = "airqo_public_cohort";
const DEFAULT_DEVICES_PER_GRID = 5;
const DEFAULT_MAX_OFFLINE_HOURS = 24;
const MAX_DEVICES_PER_GRID = 100;
const MAX_OFFLINE_HOURS_LIMIT = 24 * 7;
const QUERY_MAX_TIME_MS = 60000;

const isPositiveInteger = (value) => Number.isInteger(value) && value > 0;

function shuffle(items, random = Math.random) {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * @param {Array<{_id, grids: Array}>} sites
 * @returns {Map<string, Set<string>>} lowest-level grid id -> its site ids
 */
function findLowestLevelGrids(sites) {
  const gridSites = new Map();
  const siteGrids = new Map();
  for (const site of sites) {
    const siteId = String(site._id);
    const gridIds = [...new Set((site.grids || []).map(String))];
    if (gridIds.length === 0) continue;
    siteGrids.set(siteId, gridIds);
    for (const gridId of gridIds) {
      if (!gridSites.has(gridId)) gridSites.set(gridId, new Set());
      gridSites.get(gridId).add(siteId);
    }
  }

  const lowestLevel = new Map();
  for (const [gridId, siteIds] of gridSites) {
    // How many of this grid's sites each other grid also holds — a smaller
    // grid holding only sites of this one is nested inside it.
    const sharedCounts = new Map();
    for (const siteId of siteIds) {
      for (const otherId of siteGrids.get(siteId)) {
        if (otherId === gridId) continue;
        sharedCounts.set(otherId, (sharedCounts.get(otherId) || 0) + 1);
      }
    }
    let hasNestedGrid = false;
    for (const [otherId, shared] of sharedCounts) {
      const otherSize = gridSites.get(otherId).size;
      if (otherSize < siteIds.size && shared === otherSize) {
        hasNestedGrid = true;
        break;
      }
    }
    if (!hasNestedGrid) lowestLevel.set(gridId, siteIds);
  }
  return lowestLevel;
}

/**
 * @param {Map<string, Set<string>>} lowestLevelGrids - from findLowestLevelGrids
 * @param {Array<{_id, site_id}>} eligibleDevices
 * @param {Set<string>} currentMemberIds - device ids already in the cohort
 * @param {number} devicesPerGrid
 * @returns {{selected: Set<string>, grids: Array}}
 */
function selectDevices({
  lowestLevelGrids,
  eligibleDevices,
  currentMemberIds,
  devicesPerGrid,
  random = Math.random,
}) {
  const devicesBySite = new Map();
  for (const device of eligibleDevices) {
    const siteId = String(device.site_id);
    if (!devicesBySite.has(siteId)) devicesBySite.set(siteId, []);
    devicesBySite.get(siteId).push(String(device._id));
  }

  const orderedGrids = [...lowestLevelGrids.entries()].sort(
    (a, b) => a[1].size - b[1].size || a[0].localeCompare(b[0]),
  );

  const selected = new Set();
  const grids = [];
  for (const [gridId, siteIds] of orderedGrids) {
    const gridDevices = [];
    for (const siteId of siteIds) {
      gridDevices.push(...(devicesBySite.get(siteId) || []));
    }
    const alreadySelected = gridDevices.filter((id) => selected.has(id));
    const candidates = gridDevices.filter((id) => !selected.has(id));
    const needed = Math.max(devicesPerGrid - alreadySelected.length, 0);
    const picked = [
      ...shuffle(candidates.filter((id) => currentMemberIds.has(id)), random),
      ...shuffle(candidates.filter((id) => !currentMemberIds.has(id)), random),
    ].slice(0, needed);
    picked.forEach((id) => selected.add(id));

    grids.push({
      grid_id: gridId,
      eligible_devices: gridDevices.length,
      selected_devices: alreadySelected.length + picked.length,
    });
  }
  return { selected, grids };
}

const publicCohort = {
  CONFIG_KEY,
  STATE_KEY,
  PUBLIC_COHORT_NAME,
  DEFAULT_DEVICES_PER_GRID,
  DEFAULT_MAX_OFFLINE_HOURS,
  MAX_DEVICES_PER_GRID,
  MAX_OFFLINE_HOURS_LIMIT,
  findLowestLevelGrids,
  selectDevices,

  getConfig: async (tenant) => {
    const doc = await SystemConfigModel(tenant)
      .findOne({ key: CONFIG_KEY })
      .lean();
    const value = (doc && doc.value) || {};
    return {
      devices_per_grid: isPositiveInteger(value.devices_per_grid)
        ? value.devices_per_grid
        : DEFAULT_DEVICES_PER_GRID,
      max_offline_hours: isPositiveInteger(value.max_offline_hours)
        ? value.max_offline_hours
        : DEFAULT_MAX_OFFLINE_HOURS,
      is_default: !doc,
      version: doc ? doc.version : 0,
      updated_by: doc ? doc.updated_by : null,
      updated_at: doc ? doc.updatedAt : null,
    };
  },

  describe: async (tenant) => {
    const [config, stateDoc] = await Promise.all([
      publicCohort.getConfig(tenant),
      SystemConfigModel(tenant)
        .findOne({ key: STATE_KEY })
        .lean(),
    ]);
    const state = (stateDoc && stateDoc.value) || {};
    return {
      success: true,
      message: "Successfully retrieved the public cohort configuration",
      status: httpStatus.OK,
      data: {
        config,
        cohort_id: state.cohort_id || null,
        last_refresh: state.last_refresh || null,
      },
    };
  },

  updateConfig: async (
    tenant,
    { devices_per_grid, max_offline_hours, updated_by },
  ) => {
    const current = await publicCohort.getConfig(tenant);
    const value = {
      devices_per_grid:
        devices_per_grid !== undefined
          ? devices_per_grid
          : current.devices_per_grid,
      max_offline_hours:
        max_offline_hours !== undefined
          ? max_offline_hours
          : current.max_offline_hours,
    };
    await SystemConfigModel(tenant).upsert(
      CONFIG_KEY,
      value,
      updated_by || null,
    );
    const result = await publicCohort.describe(tenant);
    return {
      ...result,
      message: "Successfully updated the public cohort configuration",
    };
  },

  // Resolved by the stored id first so a later rename of the cohort does not
  // orphan it and spawn a second one.
  resolveCohort: async (tenant, storedCohortId) => {
    if (storedCohortId) {
      const byId = await CohortModel(tenant)
        .findById(storedCohortId)
        .lean();
      if (byId) return byId;
    }
    const byName = await CohortModel(tenant)
      .findOne({ name: PUBLIC_COHORT_NAME })
      .lean();
    if (byName) return byName;
    const created = await CohortModel(tenant).create({
      name: PUBLIC_COHORT_NAME,
      network: constants.DEFAULT_NETWORK || "airqo",
      visibility: true,
      description:
        "Automatically maintained sample of public devices from every lowest-level Grid",
      cohort_tags: ["public-cohort"],
    });
    return created.toObject();
  },

  refresh: async (tenant) => {
    const startedAt = new Date();
    const config = await publicCohort.getConfig(tenant);
    const stateDoc = await SystemConfigModel(tenant)
      .findOne({ key: STATE_KEY })
      .lean();
    const state = (stateDoc && stateDoc.value) || {};
    const cohort = await publicCohort.resolveCohort(tenant, state.cohort_id);
    const cohortId = cohort._id;

    const cutoff = new Date(
      startedAt.getTime() - config.max_offline_hours * 60 * 60 * 1000,
    );
    const [sites, eligibleDevices, currentMembers] = await Promise.all([
      SiteModel(tenant)
        .find({ "grids.0": { $exists: true } })
        .select("_id grids")
        .lean()
        .maxTimeMS(QUERY_MAX_TIME_MS),
      DeviceModel(tenant)
        .find({
          visibility: true,
          isActive: true,
          site_id: { $ne: null },
          lastActive: { $gte: cutoff },
        })
        .select("_id site_id")
        .lean()
        .maxTimeMS(QUERY_MAX_TIME_MS),
      DeviceModel(tenant)
        .find({ cohorts: cohortId })
        .select("_id")
        .lean()
        .maxTimeMS(QUERY_MAX_TIME_MS),
    ]);

    const lowestLevelGrids = findLowestLevelGrids(sites);
    const currentMemberIds = new Set(currentMembers.map((d) => String(d._id)));
    const { selected, grids } = selectDevices({
      lowestLevelGrids,
      eligibleDevices,
      currentMemberIds,
      devicesPerGrid: config.devices_per_grid,
    });

    // An empty selection against a populated cohort means the inputs are
    // broken (e.g. lastActive not being maintained), not that every device
    // went offline at once — leave the cohort as it is rather than empty it.
    if (selected.size === 0 && currentMemberIds.size > 0) {
      logger.warn(
        `public cohort refresh found no eligible devices (${sites.length} site(s), ${lowestLevelGrids.size} lowest-level grid(s)) — leaving the existing ${currentMemberIds.size} member(s) untouched`,
      );
      return {
        success: false,
        message: "No eligible devices found, the public cohort was left unchanged",
        status: httpStatus.CONFLICT,
        errors: {
          message:
            "No eligible devices found, the public cohort was left unchanged",
        },
      };
    }

    const toAdd = [...selected].filter((id) => !currentMemberIds.has(id));
    const toRemove = [...currentMemberIds].filter((id) => !selected.has(id));
    if (toRemove.length > 0) {
      await DeviceModel(tenant).updateMany(
        { _id: { $in: toRemove } },
        { $pull: { cohorts: cohortId } },
      );
    }
    if (toAdd.length > 0) {
      await DeviceModel(tenant).updateMany(
        { _id: { $in: toAdd } },
        { $addToSet: { cohorts: cohortId } },
      );
    }

    const gridDocs = await GridModel(tenant)
      .find({ _id: { $in: [...lowestLevelGrids.keys()] } })
      .select("_id name admin_level")
      .lean()
      .maxTimeMS(QUERY_MAX_TIME_MS);
    const gridById = new Map(gridDocs.map((g) => [String(g._id), g]));
    const gridSummaries = grids.map((grid) => {
      const doc = gridById.get(grid.grid_id) || {};
      return { ...grid, name: doc.name, admin_level: doc.admin_level };
    });

    const lastRefresh = {
      refreshed_at: startedAt,
      devices_per_grid: config.devices_per_grid,
      max_offline_hours: config.max_offline_hours,
      lowest_level_grids: grids.length,
      under_represented_grids: grids.filter(
        (g) => g.selected_devices < config.devices_per_grid,
      ).length,
      total_devices: selected.size,
      added: toAdd.length,
      removed: toRemove.length,
    };
    await SystemConfigModel(tenant).findOneAndUpdate(
      { key: STATE_KEY },
      { $set: { value: { cohort_id: cohortId, last_refresh: lastRefresh } } },
      { upsert: true, setDefaultsOnInsert: true },
    );

    return {
      success: true,
      message: "Successfully refreshed the public cohort",
      status: httpStatus.OK,
      data: {
        cohort_id: cohortId,
        ...lastRefresh,
        grids: gridSummaries,
      },
    };
  },
};

module.exports = publicCohort;
