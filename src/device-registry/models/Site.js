const mongoose = require("mongoose");
const { Schema } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const httpStatus = require("http-status");
const { logObject, HttpError } = require("@utils/shared");
const { getModelByTenant } = require("@config/database");

const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- site-model`);

function sanitizeObject(obj, invalidKeys) {
  invalidKeys.forEach((key) => {
    if (Object.hasOwn(obj, key)) {
      delete obj[key];
    }
  });
  return obj;
}

const categorySchema = new Schema(
  {
    area_name: { type: String },
    category: { type: String },
    highway: { type: String },
    landuse: { type: String },
    latitude: { type: Number },
    longitude: { type: Number },
    natural: { type: String },
    search_radius: { type: Number },
    waterway: { type: String },
    tags: [
      {
        type: String,
        trim: true,
      },
    ],
  },
  {
    _id: false,
  }
);

const siteSchema = new Schema(
  {
    site_category: { type: categorySchema },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    grids: {
      type: [
        {
          type: ObjectId,
          ref: "grid",
        },
      ],
    },
    share_links: {
      preview: { type: String, trim: true },
      short_link: { type: String, trim: true },
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    search_name: {
      type: String,
      trim: true,
    },
    network: {
      type: String,
      trim: true,
      required: [true, "network is required!"],
    },
    groups: {
      type: [String],
      trim: true,
    },
    data_provider: {
      type: String,
      trim: true,
    },
    location_name: {
      type: String,
      trim: true,
    },
    generated_name: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "generated name is required!"],
      immutable: true,
    },
    airqloud_id: {
      type: ObjectId,
      trim: true,
    },
    airqlouds: [
      {
        type: ObjectId,
        ref: "airqloud",
      },
    ],
    formatted_name: {
      type: String,
      trim: true,
    },
    lat_long: {
      type: String,
      trim: true,
      unique: true,
      required: [true, "lat_long is required!"],
      immutable: true,
    },
    description: {
      type: String,
      trim: true,
      unique: true,
    },
    site_codes: [
      {
        type: String,
        trim: true,
      },
    ],
    latitude: {
      type: Number,
      required: [true, "latitude is required!"],
      immutable: true,
    },
    approximate_latitude: {
      type: Number,
      required: [true, "approximate_latitude is required!"],
    },
    longitude: {
      type: Number,
      required: [true, "longitude is required!"],
      immutable: true,
    },
    approximate_longitude: {
      type: Number,
      required: [true, "approximate_longitude is required!"],
    },
    approximate_distance_in_km: {
      type: Number,
      required: [true, "approximate_distance_in_km is required!"],
    },
    bearing_in_radians: {
      type: Number,
      required: [true, "bearing_in_radians is required!"],
    },
    site_tags: { type: Array, default: [] },
    altitude: {
      type: Number,
    },
    distance_to_nearest_road: {
      type: Number,
      trim: true,
    },
    google_place_id: {
      type: String,
    },
    distance_to_nearest_motorway: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_city: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_residential_road: {
      type: Number,
      trim: true,
    },
    distance_to_kampala_center: {
      type: Number,
      trim: true,
    },
    bearing_to_kampala_center: {
      type: Number,
      trim: true,
    },
    distance_to_capital_city_center: {
      type: Number,
      trim: true,
    },
    bearing_to_capital_city_center: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_primary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_secondary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_tertiary_road: {
      type: Number,
      trim: true,
    },
    distance_to_nearest_unclassified_road: {
      type: Number,
      trim: true,
    },
    terrain: {
      type: String,
      trim: true,
    },
    land_use: [
      {
        type: String,
        trim: true,
      },
    ],
    road_intensity: {
      type: Number,
    },
    road_status: {
      type: String,
    },
    aspect: {
      type: Number,
    },
    status: {
      type: String,
    },
    landform_90: {
      type: Number,
    },
    landform_270: {
      type: Number,
    },
    greenness: {
      type: Number,
    },
    traffic_factor: {
      type: Number,
    },
    parish: {
      type: String,
      trim: true,
    },
    village: {
      type: String,
      trim: true,
    },
    district: {
      type: String,
      trim: true,
    },
    region: {
      type: String,
      trim: true,
    },
    town: {
      type: String,
      trim: true,
    },
    city: {
      type: String,
      trim: true,
    },
    street: {
      type: String,
      trim: true,
    },
    geometry: {
      type: Object,
      trim: true,
    },
    county: {
      type: String,
      trim: true,
    },
    sub_county: {
      type: String,
      trim: true,
    },
    lastActive: { type: Date },
    isOnline: {
      type: Boolean,
      trim: true,
      default: false,
    },
    count: { type: Number },
    country: {
      type: String,
      trim: true,
    },
    weather_stations: [
      {
        code: {
          type: String,
          trim: true,
          default: null,
        },
        name: {
          type: String,
          trim: true,
          default: null,
        },
        country: {
          type: String,
          trim: true,
          default: null,
        },
        longitude: {
          type: Number,
          trim: true,
          default: -1,
        },
        latitude: {
          type: Number,
          trim: true,
          default: -1,
        },
        timezone: {
          type: String,
          trim: true,
          default: null,
        },
        distance: {
          type: Number,
          trim: true,
          default: -1,
        },
      },
    ],
    nearest_tahmo_station: {
      id: {
        type: Number,
        trim: true,
        default: -1,
      },
      code: {
        type: String,
        trim: true,
        default: null,
      },
      longitude: {
        type: Number,
        trim: true,
        default: -1,
      },
      latitude: {
        type: Number,
        trim: true,
        default: -1,
      },
      timezone: {
        type: String,
        trim: true,
        default: null,
      },
    },
    onlineStatusAccuracy: {
      totalAttempts: { type: Number, default: 0 },
      successfulUpdates: { type: Number, default: 0 },
      failedUpdates: { type: Number, default: 0 },
      lastUpdate: { type: Date },
      lastSuccessfulUpdate: { type: Date },
      lastFailureReason: { type: String },
      successPercentage: { type: Number, default: 0 },
      failurePercentage: { type: Number, default: 0 },
    },
    // Precomputed activity fields for performance
    cached_activities_by_type: {
      type: Object,
      default: {},
    },
    cached_latest_activities_by_type: {
      type: Object,
      default: {},
    },
    cached_total_activities: {
      type: Number,
      default: 0,
    },
    cached_device_activity_summary: {
      type: Array,
      default: [],
    },
    cached_latest_deployment_activity: {
      type: Object,
    },
    cached_latest_maintenance_activity: {
      type: Object,
    },
    cached_latest_recall_activity: {
      type: Object,
    },
    cached_site_creation_activity: {
      type: Object,
    },
    cached_total_devices: {
      type: Number,
      default: 0,
    },
    activities_cache_updated_at: { type: Date },
  },
  {
    timestamps: true,
  }
);

const checkDuplicates = (arr, fieldName) => {
  const duplicateValues = arr.filter(
    (value, index, self) => self.indexOf(value) !== index
  );

  if (duplicateValues.length > 0) {
    return new HttpError(
      `Duplicate values found in ${fieldName} array.`,
      httpStatus.BAD_REQUEST
    );
  }
  return null;
};

siteSchema.pre(
  ["updateOne", "findOneAndUpdate", "updateMany", "update", "save"],
  function(next) {
    if (this.getUpdate) {
      const updates = this.getUpdate();
      if (updates) {
        // Handle data_provider update based on groups
        const hasExplicitDataProvider =
          updates.data_provider || (updates.$set && updates.$set.data_provider);

        // Check for groups in different possible update operations
        const groupsUpdate =
          updates.groups ||
          (updates.$set && updates.$set.groups) ||
          (updates.$addToSet &&
            updates.$addToSet.groups &&
            updates.$addToSet.groups.$each) ||
          (updates.$push && updates.$push.groups && updates.$push.groups.$each);

        // Update data_provider if groups are being updated and no explicit data_provider is provided
        if (groupsUpdate && !hasExplicitDataProvider) {
          const groupsArray = Array.isArray(groupsUpdate)
            ? groupsUpdate
            : groupsUpdate.$each
            ? groupsUpdate.$each
            : [groupsUpdate];

          if (groupsArray.length > 0) {
            updates.data_provider = groupsArray[0]; // Direct assignment instead of using $set
          }
        }
        // Prevent modification of restricted fields
        const restrictedFields = [
          "latitude",
          "longitude",
          "_id",
          "generated_name",
          "lat_long",
        ];
        restrictedFields.forEach((field) => {
          // Remove from top-level updates
          if (updates[field]) delete updates[field];

          // Remove from $set
          if (updates.$set && updates.$set[field]) {
            if (field === "latitude" || field === "longitude") {
              return next(
                new HttpError(
                  "Cannot modify latitude or longitude after creation",
                  httpStatus.BAD_REQUEST,
                  {
                    message:
                      "Cannot modify latitude or longitude after creation",
                  }
                )
              );
            }
            delete updates.$set[field];
          }

          // Remove from $push
          if (updates.$push && updates.$push[field])
            delete updates.$push[field];
        });

        // Handle array fields using $addToSet
        const arrayFieldsToAddToSet = [
          "site_tags",
          "images",
          "land_use",
          "site_codes",
          "airqlouds",
          "groups",
          "grids",
        ];
        arrayFieldsToAddToSet.forEach((field) => {
          if (updates[field]) {
            updates.$addToSet = updates.$addToSet || {};
            updates.$addToSet[field] = { $each: updates[field] };
            delete updates[field];
          }
        });
      }
    }

    if (this.isNew) {
      // Prepare site_codes array
      this.site_codes = [
        this._id,
        this.name,
        this.generated_name,
        this.lat_long,
      ];

      // Optionally add additional site codes
      const optionalSiteCodes = [
        "search_name",
        "location_name",
        "formatted_name",
      ];
      optionalSiteCodes.forEach((field) => {
        if (this[field]) this.site_codes.push(this[field]);
      });

      // Check for duplicates in grids
      const gridsDuplicateError = checkDuplicates(this.grids, "grids");
      if (gridsDuplicateError) {
        return next(gridsDuplicateError);
      }

      // Check for duplicates in groups
      const groupsDuplicateError = checkDuplicates(this.groups, "groups");
      if (groupsDuplicateError) {
        return next(groupsDuplicateError);
      }
    }

    next();
  }
);

siteSchema.index({ lat_long: 1 }, { unique: true });
siteSchema.index({ generated_name: 1 }, { unique: true });
siteSchema.index({ createdAt: -1 });
// Index for stale entity checks
siteSchema.index({ "onlineStatusAccuracy.lastCheck": 1 });
// Index for offline entity checks
siteSchema.index({ isOnline: 1, lastActive: 1, createdAt: 1 });

siteSchema.plugin(uniqueValidator, {
  message: `{VALUE} must be unique!`,
});

siteSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      grids: this.grids,
      devices: this.devices,
      name: this.name,
      site_category: this.site_category,
      visibility: this.visibility,
      generated_name: this.generated_name,
      search_name: this.search_name,
      network: this.network,
      groups: this.groups,
      data_provider: this.data_provider,
      location_name: this.location_name,
      formatted_name: this.formatted_name,
      lat_long: this.lat_long,
      latitude: this.latitude,
      approximate_latitude: this.approximate_latitude,
      longitude: this.longitude,
      approximate_longitude: this.approximate_longitude,
      approximate_distance_in_km: this.approximate_distance_in_km,
      bearing_in_radians: this.bearing_in_radians,
      airqlouds: this.airqlouds,
      createdAt: this.createdAt,
      description: this.description,
      site_tags: this.site_tags,
      country: this.country,
      district: this.district,
      sub_county: this.sub_county,
      parish: this.parish,
      region: this.region,
      geometry: this.geometry,
      village: this.village,
      site_codes: this.site_codes,
      images: this.images,
      share_links: this.share_links,
      city: this.city,
      lastActive: this.lastActive,
      isOnline: this.isOnline,
      street: this.street,
      county: this.county,
      altitude: this.altitude,
      greenness: this.greenness,
      landform_270: this.landform_270,
      landform_90: this.landform_90,
      aspect: this.aspect,
      status: this.status,
      distance_to_nearest_road: this.distance_to_nearest_road,
      distance_to_nearest_primary_road: this.distance_to_nearest_primary_road,
      distance_to_nearest_secondary_road: this
        .distance_to_nearest_secondary_road,
      distance_to_nearest_tertiary_road: this.distance_to_nearest_tertiary_road,
      distance_to_nearest_unclassified_road: this
        .distance_to_nearest_unclassified_road,
      bearing_to_kampala_center: this.bearing_to_kampala_center,
      distance_to_kampala_center: this.distance_to_kampala_center,
      bearing_to_capital_city_center: this.bearing_to_capital_city_center,
      distance_to_capital_city_center: this.distance_to_capital_city_center,
      distance_to_nearest_residential_road: this
        .distance_to_nearest_residential_road,
      nearest_tahmo_station: this.nearest_tahmo_station,
      onlineStatusAccuracy: this.onlineStatusAccuracy,
      weather_stations: this.weather_stations,
      road_intensity: this.road_intensity,
    };
  },
  createSite(args) {
    return this.create({
      ...args,
    });
  },
};

siteSchema.statics = {
  async register(args, next) {
    try {
      let modifiedArgs = args;
      modifiedArgs.description = modifiedArgs.name;

      if (isEmpty(modifiedArgs.network)) {
        modifiedArgs.network = constants.DEFAULT_NETWORK;
      }

      logObject("modifiedArgs", modifiedArgs);
      let createdSite = await this.create({
        ...modifiedArgs,
      });

      if (!isEmpty(createdSite)) {
        let data = createdSite._doc;
        delete data.geometry;
        delete data.google_place_id;
        delete data.updatedAt;
        delete data.__v;
        delete data.formatted_name;
        delete data.airqlouds;
        delete data.site_tags;
        delete data.nearest_tahmo_station;
        delete data.weather_stations;
        return {
          success: true,
          data,
          message: "site created",
          status: httpStatus.CREATED,
        };
      } else if (isEmpty(createdSite)) {
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            {
              message: "site not created despite successful operation",
            }
          )
        );
      }
    } catch (error) {
      logObject("the error", error);
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      Object.entries(error.errors).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      next(new HttpError(message, status, response));
    }
  },
  async list({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.SITES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITES_EXCLUSION_PROJECTION(
        filter.path ? filter.path : "none"
      );

      if (!isEmpty(filter.path)) {
        delete filter.path;
      }
      if (!isEmpty(filter.dashboard)) {
        delete filter.dashboard;
      }
      if (!isEmpty(filter.summary)) {
        delete filter.summary;
      }
      let maxActivities = 500;
      if (!isEmpty(filter.maxActivities)) {
        const rawMax = Number(filter.maxActivities);
        if (Number.isFinite(rawMax) && rawMax > 0) {
          maxActivities = Math.min(rawMax, 1000);
        }
        delete filter.maxActivities;
      }
      const pipeline = await this.aggregate()
        .match(filter)
        .lookup({
          from: "devices",
          localField: "_id",
          foreignField: "site_id",
          as: "devices",
        })
        .lookup({
          from: "grids",
          localField: "grids",
          foreignField: "_id",
          as: "grids",
        })
        .lookup({
          from: "airqlouds",
          localField: "airqlouds",
          foreignField: "_id",
          as: "airqlouds",
        })

        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$site_id", "$$siteId"] } } },
            { $sort: { createdAt: -1 } },
            {
              $project: {
                _id: 1,
                site_id: 1,
                device_id: 1,
                device: 1,
                activityType: 1,
                maintenanceType: 1,
                recallType: 1,
                date: 1,
                description: 1,
                nextMaintenance: 1,
                createdAt: 1,
                tags: 1,
              },
            },
            { $limit: maxActivities },
          ],
          as: "activities",
        })

        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    { $eq: ["$activityType", "deployment"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "latest_deployment_activity",
        })

        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    { $eq: ["$activityType", "maintenance"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "latest_maintenance_activity",
        })

        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    {
                      $or: [
                        { $eq: ["$activityType", "recall"] },
                        { $eq: ["$activityType", "recallment"] },
                      ],
                    },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "latest_recall_activity",
        })

        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    { $eq: ["$activityType", "site-creation"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: 1 } },
            { $limit: 1 },
          ],
          as: "site_creation_activity",
        })

        .addFields({
          total_activities: {
            $cond: [{ $isArray: "$activities" }, { $size: "$activities" }, 0],
          },
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit ? limit : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_SITES)
        )
        .allowDiskUse(true);

      const response = await pipeline;

      // Process activities for consistency
      if (!isEmpty(response)) {
        response.forEach((site) => {
          // Process latest activities to extract single objects
          site.latest_deployment_activity =
            site.latest_deployment_activity &&
            site.latest_deployment_activity.length > 0
              ? site.latest_deployment_activity[0]
              : null;

          site.latest_maintenance_activity =
            site.latest_maintenance_activity &&
            site.latest_maintenance_activity.length > 0
              ? site.latest_maintenance_activity[0]
              : null;

          site.latest_recall_activity =
            site.latest_recall_activity &&
            site.latest_recall_activity.length > 0
              ? site.latest_recall_activity[0]
              : null;

          site.site_creation_activity =
            site.site_creation_activity &&
            site.site_creation_activity.length > 0
              ? site.site_creation_activity[0]
              : null;

          // Create activities by type mapping
          if (site.activities && site.activities.length > 0) {
            const activitiesByType = {};
            const latestActivitiesByType = {};

            site.activities.forEach((activity) => {
              const type = activity.activityType || "unknown";
              activitiesByType[type] = (activitiesByType[type] || 0) + 1;

              if (
                !latestActivitiesByType[type] ||
                new Date(activity.createdAt) >
                  new Date(latestActivitiesByType[type].createdAt)
              ) {
                latestActivitiesByType[type] = activity;
              }
            });

            site.activities_by_type = activitiesByType;
            site.latest_activities_by_type = latestActivitiesByType;

            // Create device activity summary
            const deviceActivitySummary = site.devices.map((device) => {
              const deviceActivities = site.activities.filter(
                (activity) =>
                  activity.device === device.name ||
                  (activity.device_id &&
                    activity.device_id.toString() === device._id.toString())
              );
              return {
                device_id: device._id,
                device_name: device.name,
                activity_count: deviceActivities.length,
              };
            });
            site.device_activity_summary = deviceActivitySummary;
          } else {
            site.activities_by_type = {};
            site.latest_activities_by_type = {};
            site.device_activity_summary = site.devices.map((device) => ({
              device_id: device._id,
              device_name: device.name,
              activity_count: 0,
            }));
          }
        });

        return {
          success: true,
          message: "successfully retrieved the site details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no sites match this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async listAirQoActive({ skip = 0, limit = 1000, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.SITES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.SITES_EXCLUSION_PROJECTION(
        filter.path ? filter.path : "none"
      );

      if (!isEmpty(filter.path)) {
        delete filter.path;
      }

      if (!isEmpty(filter.dashboard)) {
        delete filter.dashboard;
      }
      if (!isEmpty(filter.summary)) {
        delete filter.summary;
      }

      const pipeline = await this.aggregate()
        .match({ ...filter, network: "airqo" })
        .lookup({
          from: "devices",
          localField: "_id",
          foreignField: "site_id",
          as: "devices",
        })
        .unwind("$devices")
        .match({ devices: { $exists: true, $ne: [] } })
        .lookup({
          from: "grids",
          localField: "grids",
          foreignField: "_id",
          as: "grids",
        })
        .lookup({
          from: "airqlouds",
          localField: "airqlouds",
          foreignField: "_id",
          as: "airqlouds",
        })
        // Simplified activity lookups
        .lookup({
          from: "activities",
          localField: "_id",
          foreignField: "site_id",
          as: "activities",
        })
        // Simple latest deployment lookup
        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    { $eq: ["$activityType", "deployment"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "latest_deployment_activity",
        })
        // Simple latest maintenance lookup
        .lookup({
          from: "activities",
          let: { siteId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$site_id", "$$siteId"] },
                    { $eq: ["$activityType", "maintenance"] },
                  ],
                },
              },
            },
            { $sort: { createdAt: -1 } },
            { $limit: 1 },
          ],
          as: "latest_maintenance_activity",
        })
        // Simple computed fields only
        .addFields({
          total_activities: {
            $cond: [{ $isArray: "$activities" }, { $size: "$activities" }, 0],
          },
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(skip ? skip : 0)
        .limit(
          limit ? limit : parseInt(constants.DEFAULT_LIMIT_FOR_QUERYING_SITES)
        )
        .allowDiskUse(true);

      const response = await pipeline;

      // Process activities in JavaScript for consistency
      if (!isEmpty(response)) {
        response.forEach((site) => {
          // Process latest activities to extract single objects
          site.latest_deployment_activity =
            site.latest_deployment_activity &&
            site.latest_deployment_activity.length > 0
              ? site.latest_deployment_activity[0]
              : null;

          site.latest_maintenance_activity =
            site.latest_maintenance_activity &&
            site.latest_maintenance_activity.length > 0
              ? site.latest_maintenance_activity[0]
              : null;

          // Create activities by type mapping
          if (site.activities && site.activities.length > 0) {
            const activitiesByType = {};
            const latestActivitiesByType = {};

            site.activities.forEach((activity) => {
              const type = activity.activityType || "unknown";
              activitiesByType[type] = (activitiesByType[type] || 0) + 1;

              if (
                !latestActivitiesByType[type] ||
                new Date(activity.createdAt) >
                  new Date(latestActivitiesByType[type].createdAt)
              ) {
                latestActivitiesByType[type] = activity;
              }
            });

            site.activities_by_type = activitiesByType;
            site.latest_activities_by_type = latestActivitiesByType;
          } else {
            site.activities_by_type = {};
            site.latest_activities_by_type = {};
          }
        });

        return {
          success: true,
          message: "successfully retrieved the site details",
          data: response,
          status: httpStatus.OK,
        };
      } else if (isEmpty(response)) {
        return {
          success: true,
          message: "no sites match this search",
          data: [],
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);

      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  async modify({ filter = {}, update = {} } = {}, next) {
    try {
      let options = { new: true, useFindAndModify: false, upsert: false };

      let updatedSite = await this.findOneAndUpdate(
        filter,
        update,
        options
      ).exec();

      if (!isEmpty(updatedSite)) {
        return {
          success: true,
          message: "successfully modified the site",
          data: updatedSite._doc,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "site does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async bulkModify({ filter = {}, update = {}, opts = {} }, next) {
    try {
      const invalidKeys = [
        "_id",
        "longitude",
        "latitude",
        "lat_long",
        "generated_name",
      ];
      const sanitizedUpdate = sanitizeObject(update, invalidKeys);

      let updateOperation = { $set: { ...sanitizedUpdate } };

      if (update.groups) {
        // Check the original update object for groups
        updateOperation.$addToSet = { groups: { $each: update.groups } }; //Merge $addToSet
        delete updateOperation.$set.groups; // Delete .groups from the $set
      }

      // Perform bulk update with additional options
      const bulkUpdateResult = await this.updateMany(filter, updateOperation, {
        new: true,
        runValidators: true,
        ...opts,
      });

      if (bulkUpdateResult.nModified > 0) {
        return {
          success: true,
          message: `Successfully modified ${bulkUpdateResult.nModified} sites`,
          data: {
            modifiedCount: bulkUpdateResult.nModified,
            matchedCount: bulkUpdateResult.n,
          },
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "No sites were updated",
          data: {
            modifiedCount: 0,
            matchedCount: bulkUpdateResult.n,
          },
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      const stringifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Bulk Modify Sites Error -- ${stringifiedMessage}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async remove({ filter = {} } = {}, next) {
    try {
      let options = {
        projection: {
          _id: 1,
          name: 1,
          generated_name: 1,
          lat_long: 1,
          country: 1,
          district: 1,
        },
      };
      const removedSite = await this.findOneAndRemove(filter, options).exec();
      if (!isEmpty(removedSite)) {
        return {
          success: true,
          message: "successfully removed the site",
          data: removedSite._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedSite)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "site does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      const stingifiedMessage = JSON.stringify(error ? error : "");
      logger.error(`🐛🐛 Internal Server Error -- ${stingifiedMessage}`);
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

const SiteModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let sites = mongoose.model("sites");
    return sites;
  } catch (error) {
    let sites = getModelByTenant(dbTenant, "site", siteSchema);
    return sites;
  }
};

module.exports = SiteModel;
