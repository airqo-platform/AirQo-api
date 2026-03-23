// NetworkCoverageRegistry.js
// Stores metadata for monitors included in the Network Coverage map.
//
// Two kinds of entry exist in this collection:
//
//   1. AirQo-site enrichment  (site_id is set)
//      – Linked to an existing Site document via site_id.
//      – Base fields (name, city, country, lat/lng, status, lastActive) are
//        read live from the Site model; this document only stores the extra
//        metadata that the Site schema does not capture (equipment, calibration,
//        public-access flags, etc.).
//
//   2. Standalone external entry  (site_id is null / absent)
//      – A non-AirQo sensor contributed by an open data contributor
//        (think Wikipedia-style).
//      – All fields — including name, location, and status — live here because
//        there is no corresponding Site document in the system.

const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const httpStatus = require("http-status");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- network-coverage-registry-model`
);

const MONITOR_TYPES = ["Reference", "LCS", "Inactive"];
const MONITOR_STATUSES = ["active", "inactive"];
const PUBLIC_DATA_VALUES = ["Yes", "No"];

const networkCoverageRegistrySchema = new Schema(
  {
    // -----------------------------------------------------------------------
    // Link to an internal AirQo Site document (optional).
    // When present this entry enriches an AirQo-pipeline site.
    // When absent this entry is a standalone external monitor.
    // -----------------------------------------------------------------------
    site_id: {
      type: ObjectId,
      ref: "site",
      // No default — omit the field entirely for standalone entries so the
      // sparse unique index skips them. Defaulting to null would make MongoDB
      // treat null as an indexed value, allowing only one standalone document.
      index: true,
      sparse: true,
      unique: true,   // at most one registry entry per AirQo site
    },

    // -----------------------------------------------------------------------
    // Core location fields — required for standalone entries;
    // informational / override for AirQo-site entries.
    // -----------------------------------------------------------------------
    name: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    country: { type: String, trim: true, default: "" },

    // Use approximate coordinates (privacy — within 0.5 km radius)
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },

    // -----------------------------------------------------------------------
    // Monitor classification & live status (used directly for standalone entries;
    // for AirQo entries status is derived from Site.isOnline at query time).
    // -----------------------------------------------------------------------
    type: {
      type: String,
      enum: MONITOR_TYPES,
      default: "LCS",
    },

    // Status for standalone entries only. AirQo entries ignore this field.
    status: {
      type: String,
      enum: MONITOR_STATUSES,
      default: "active",
    },

    // ISO 3166-1 alpha-2 — optional override; util derives it from country name
    // when absent.
    iso2: { type: String, trim: true, default: "" },

    // Last time the external monitor was known to be active (ISO string or Date)
    lastActive: { type: Date, default: null },

    // -----------------------------------------------------------------------
    // Extended metadata fields (apply to both AirQo-site and standalone entries)
    // -----------------------------------------------------------------------
    network: { type: String, trim: true, default: "" },
    operator: { type: String, trim: true, default: "" },
    equipment: { type: String, trim: true, default: "" },
    manufacturer: { type: String, trim: true, default: "" },
    pollutants: { type: [String], default: [] },
    resolution: { type: String, trim: true, default: "" },
    transmission: { type: String, trim: true, default: "" },

    // Human-readable site description (e.g. "Downtown Kampala municipality tower")
    site: { type: String, trim: true, default: "" },

    // Land-use classification (e.g. "Urban", "Rural")
    landUse: { type: String, trim: true, default: "" },

    // Deployment date in human-readable form (e.g. "Dec 2020")
    deployed: { type: String, trim: true, default: "" },

    calibrationLastDate: { type: String, trim: true, default: "" },
    calibrationMethod: { type: String, trim: true, default: "" },

    // Uptime over the last 30 days (e.g. "96%")
    uptime30d: { type: String, trim: true, default: "" },

    publicData: {
      type: String,
      enum: PUBLIC_DATA_VALUES,
      default: "No",
    },

    organisation: { type: String, trim: true, default: "" },
    coLocation: { type: String, trim: true, default: "Not available" },
    coLocationNote: { type: String, trim: true, default: "" },

    // Deep-link to a data portal for this specific monitor
    viewDataUrl: { type: String, trim: true, default: "" },
  },
  {
    timestamps: true,
  }
);

// ---------------------------------------------------------------------------
// Statics
// ---------------------------------------------------------------------------

networkCoverageRegistrySchema.statics.list = async function (
  filter = {},
  projection = {}
) {
  try {
    const records = await this.find(filter, projection).lean();
    return {
      success: true,
      data: records,
      message: "Successfully retrieved registry records",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error listing registry records: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

/**
 * Upsert — create or update a registry record.
 * When site_id is present it is used as the upsert key (one entry per site).
 * When site_id is absent the record is always created fresh (standalone entry).
 */
networkCoverageRegistrySchema.statics.register = async function (data) {
  try {
    let record;
    let isNew;

    if (data.site_id) {
      // Use rawResult so we can detect create vs update via lastErrorObject
      const raw = await this.findOneAndUpdate(
        { site_id: data.site_id },
        { $set: data },
        { new: true, upsert: true, runValidators: true, rawResult: true }
      );
      record = raw.value;
      isNew = !raw.lastErrorObject.updatedExisting;
    } else {
      record = await this.create(data);
      isNew = true;
    }

    return {
      success: true,
      data: record,
      message: isNew
        ? "Registry record created successfully"
        : "Registry record updated successfully",
      status: isNew ? httpStatus.CREATED : httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error saving registry record: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

/**
 * Delete by the registry document's own _id.
 */
networkCoverageRegistrySchema.statics.removeById = async function (registryId) {
  try {
    const deleted = await this.findByIdAndDelete(registryId);
    if (!deleted) {
      return {
        success: false,
        message: "Registry record not found",
        errors: { message: `No registry record with id ${registryId}` },
        status: httpStatus.NOT_FOUND,
      };
    }
    return {
      success: true,
      message: "Registry record deleted",
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`Error deleting registry record: ${error.message}`);
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

const NetworkCoverageRegistryModel = (tenant) => {
  try {
    return getModelByTenant(
      tenant,
      "network_coverage_registry",
      networkCoverageRegistrySchema
    );
  } catch (error) {
    logger.error(
      `Error getting NetworkCoverageRegistry model for tenant ${tenant}: ${error.message}`
    );
    throw error;
  }
};

// Export shared enums so validators and other modules use the same values
NetworkCoverageRegistryModel.MONITOR_TYPES = MONITOR_TYPES;
NetworkCoverageRegistryModel.MONITOR_STATUSES = MONITOR_STATUSES;

module.exports = NetworkCoverageRegistryModel;
