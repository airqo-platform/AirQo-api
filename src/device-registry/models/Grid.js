const mongoose = require("mongoose");
const { Schema } = mongoose;
const isEmpty = require("is-empty");
const ObjectId = Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");

const httpStatus = require("http-status");
const { logObject, logText, HttpError } = require("@utils/shared");
const constants = require("@config/constants");
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- grid-model`
);
const { getModelByTenant } = require("@config/database");

const {
  validatePolygonClosure,
  TOLERANCE_LEVELS,
  validateAndFixPolygon,
} = require("@validators/common");

const shapeSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["Polygon", "MultiPolygon"],
      required: true,
    },
    coordinates: {
      type: Schema.Types.Mixed,
      required: true,
    },
  },
  { _id: false }
);

const centerPointSchema = new Schema(
  {
    longitude: { type: Number },
    latitude: { type: Number },
  },
  {
    _id: false,
  }
);

const gridSchema = new Schema(
  {
    network: {
      type: String,
      trim: true,
      required: [true, "the network is required!"],
    },
    lastActive: {
      type: Date,
      default: null,
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    mobileDeviceCount: {
      type: Number,
      default: 0,
    },
    activeMobileDevices: [
      {
        device_id: {
          type: ObjectId,
          ref: "devices",
        },
        lastSeen: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    groups: {
      type: [String],
      trim: true,
    },
    geoHash: {
      type: String,
      index: true,
    },
    centers: [centerPointSchema],
    long_name: {
      type: String,
      trim: true,
      unique: true,
    },
    flag_url: {
      type: String,
      trim: true,
      default: null,
    },
    description: {
      type: String,
      trim: true,
    },
    grid_tags: {
      type: Array,
      default: [],
    },
    admin_level: {
      type: String,
      required: [true, "admin_level is required!"],
    },
    name: {
      type: String,
      trim: true,
      required: [true, "name is required!"],
      unique: true,
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: true,
    },
    grid_codes: [
      {
        type: String,
        trim: true,
      },
    ],
    shape: {
      type: shapeSchema,
      required: [true, "shape is required!"],
    },
    shape_update_history: [
      {
        updated_at: {
          type: Date,
          default: Date.now,
        },
        reason: {
          type: String,
          required: true,
        },
        previous_shape: {
          type: shapeSchema,
        },
        previous_centers: [centerPointSchema],
      },
    ],
  },
  { timestamps: true }
);

gridSchema.index({ "activeMobileDevices.device_id": 1 });
gridSchema.index({ lastActive: 1, isOnline: 1 });
gridSchema.index({
  shape: "2dsphere", // For geospatial queries
  mobileDeviceCount: 1,
});
gridSchema.index({ admin_level: 1, isOnline: 1 });

gridSchema.post("save", async function(doc) {});

gridSchema.pre("save", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  this.grid_codes = [this._id, this.name];

  // Backup validation using geometry utility
  if ((this.isModified("shape") || this.isNew) && this.shape) {
    try {
      const fixed = validateAndFixPolygon(this.shape);
      validatePolygonClosure(fixed, TOLERANCE_LEVELS.STRICT);
      this.shape = fixed;
    } catch (error) {
      return next(
        new Error(
          `Invalid polygon detected at model level - route validation may have been bypassed: ${error.message}`
        )
      );
    }
  }

  return next();
});

gridSchema.pre("update", function(next) {
  if (this.isModified("_id")) {
    delete this._id;
  }
  return next();
});

gridSchema.pre(["findOneAndUpdate", "updateOne", "updateMany"], function(next) {
  const update = this.getUpdate();

  // Check if shape is being updated directly
  if (update && update.shape) {
    try {
      const fixed = validateAndFixPolygon(update.shape);
      validatePolygonClosure(fixed, TOLERANCE_LEVELS.STRICT);
      update.shape = fixed;
    } catch (error) {
      return next(
        new Error(`Invalid polygon in update operation: ${error.message}`)
      );
    }
  }

  // Check if using $set operator with shape
  if (update && update.$set && update.$set.shape) {
    try {
      const fixed = validateAndFixPolygon(update.$set.shape);
      validatePolygonClosure(fixed, TOLERANCE_LEVELS.STRICT);
      update.$set.shape = fixed;
    } catch (error) {
      return next(
        new Error(`Invalid polygon in $set update operation: ${error.message}`)
      );
    }
  }

  next();
});

gridSchema.plugin(uniqueValidator, {
  message: `{VALUE} is a duplicate value!`,
});

gridSchema.methods.toJSON = function() {
  const {
    _id,
    name,
    long_name,
    network,
    flag_url,
    groups,
    visibility,
    description,
    grid_tags,
    admin_level,
    grid_codes,
    centers,
    shape,
    geoHash,
    lastActive,
    isOnline,
    mobileDeviceCount,
    activeMobileDevices,
  } = this;
  return {
    _id,
    name,
    visibility,
    long_name,
    flag_url,
    description,
    grid_tags,
    network,
    groups,
    admin_level,
    grid_codes,
    centers,
    shape,
    geoHash,
    lastActive,
    isOnline,
    mobileDeviceCount,
    activeMobileDevices,
  };
};

gridSchema.statics.register = async function(args, next) {
  try {
    let modifiedArgs = { ...args };

    if (isEmpty(modifiedArgs.network)) {
      modifiedArgs.network = constants.DEFAULT_NETWORK;
    }

    if (!isEmpty(modifiedArgs.long_name && isEmpty(modifiedArgs.name))) {
      modifiedArgs.name = modifiedArgs.long_name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 41)
        .trim()
        .toLowerCase();
    }

    if (isEmpty(modifiedArgs.long_name && !isEmpty(modifiedArgs.name))) {
      modifiedArgs.long_name = modifiedArgs.name;
    }

    if (!isEmpty(modifiedArgs.name) && !isEmpty(modifiedArgs.long_name)) {
      modifiedArgs.name = modifiedArgs.name
        .replace(/[^a-zA-Z0-9]/g, "_")
        .slice(0, 41)
        .trim()
        .toLowerCase();
    }

    const createdGrid = await this.create(modifiedArgs);

    if (!isEmpty(createdGrid)) {
      return {
        success: true,
        data: createdGrid._doc,
        message: "grid created",
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: "grid not created despite successful operation",
          }
        )
      );
    }
  } catch (error) {
    logObject("error", error);
    let response = {
      message: "validation errors for some of the provided fields",
      success: false,
      status: httpStatus.CONFLICT,
      errors: { message: error.message },
    };

    if (!isEmpty(error.errors)) {
      response.errors = {};

      Object.entries(error.errors).forEach(([key, value]) => {
        response.errors.message = value.message;
        response.errors[value.path] = value.message;
      });
    } else {
      response.errors = { message: error.message };
    }
    next(new HttpError(response.message, response.status, response.errors));
  }
};

gridSchema.statics.list = async function(
  { filter = {}, limit = 1000, skip = 0 } = {},
  next
) {
  try {
    logText("we are inside model's list....");
    const inclusionProjection = constants.GRIDS_INCLUSION_PROJECTION;
    const exclusionProjection = constants.GRIDS_EXCLUSION_PROJECTION(
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

    logObject("filter", filter);
    logObject("exclusionProjection", exclusionProjection);

    const pipeline = this.aggregate()
      .match(filter)
      .lookup({
        from: "sites",
        localField: "_id",
        foreignField: "grids",
        as: "sites",
      })
      .lookup({
        from: "devices",
        localField: "activeMobileDevices.device_id",
        foreignField: "_id",
        as: "mobileDevices",
      })
      .project({
        ...inclusionProjection,
        // Include mobile device fields
        lastActive: 1,
        isOnline: 1,
        mobileDeviceCount: 1,
        activeMobileDevices: 1,
        mobileDevices: 1,
      })
      .project(exclusionProjection)
      .sort({ createdAt: -1 })
      .skip(skip ? skip : 0)
      .limit(limit ? limit : 1000)
      .allowDiskUse(true);

    const data = await pipeline;
    if (!isEmpty(data)) {
      return {
        success: true,
        message: "Successful Operation",
        data,
        status: httpStatus.OK,
      };
    } else {
      return {
        success: true,
        message: "There are no records for this search",
        data: [],
        status: httpStatus.OK,
      };
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
    return;
  }
};

gridSchema.statics.modify = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { shape: 0, __v: 0 },
    };

    const modifiedUpdateBody = { ...update };
    delete modifiedUpdateBody._id;
    delete modifiedUpdateBody.name;
    delete modifiedUpdateBody.long_name;
    delete modifiedUpdateBody.grid_codes;
    delete modifiedUpdateBody.centers;
    delete modifiedUpdateBody.shape;
    delete modifiedUpdateBody.geoHash;

    const updatedGrid = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedGrid)) {
      return {
        success: true,
        message: "successfully modified the grid",
        data: updatedGrid._doc,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "grid does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

gridSchema.statics.remove = async function({ filter = {} } = {}, next) {
  try {
    const options = {
      projection: {
        _id: 1,
        name: 1,
        admin_level: 1,
      },
    };

    const removedGrid = await this.findOneAndRemove(filter, options).exec();

    if (!isEmpty(removedGrid)) {
      return {
        success: true,
        message: "successfully removed the grid",
        data: removedGrid._doc,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "grid does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

// Add these static methods to the gridSchema

gridSchema.statics.updateMobileDeviceActivity = async function(
  gridId,
  deviceId,
  next
) {
  try {
    if (!gridId || !deviceId) {
      throw new Error("Both gridId and deviceId are required");
    }
    const result = await this.findByIdAndUpdate(
      gridId,
      {
        $set: {
          lastActive: new Date(),
          isOnline: true,
          "activeMobileDevices.$[elem].lastSeen": new Date(),
        },
        $addToSet: {
          activeMobileDevices: {
            device_id: deviceId,
            lastSeen: new Date(),
          },
        },
      },
      {
        arrayFilters: [{ "elem.device_id": deviceId }],
        new: true,
        upsert: false,
      }
    );

    // Update mobile device count
    if (result) {
      await this.findByIdAndUpdate(gridId, {
        $set: { mobileDeviceCount: result.activeMobileDevices.length },
      });
    }

    return {
      success: true,
      message: "Mobile device activity updated",
      data: result,
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(
      `🐛🐛 Error updating mobile device activity: ${error.message}`
    );
    return {
      success: false,
      message: "Failed to update mobile device activity",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

gridSchema.statics.cleanupInactiveDevices = async function(
  inactiveThresholdHours = 5,
  next
) {
  try {
    const thresholdTime = new Date(
      Date.now() - inactiveThresholdHours * 60 * 60 * 1000
    );

    const result = await this.updateMany(
      {},
      {
        $pull: {
          activeMobileDevices: {
            lastSeen: { $lt: thresholdTime },
          },
        },
      }
    );
    try {
      await this.updateMany({}, [
        {
          $set: {
            activeMobileDevices: {
              $ifNull: ["$activeMobileDevices", []],
            },
          },
        },
        {
          $set: {
            mobileDeviceCount: {
              $size: {
                $ifNull: ["$activeMobileDevices", []],
              },
            },
            isOnline: {
              $gt: [
                {
                  $size: {
                    $ifNull: ["$activeMobileDevices", []],
                  },
                },
                0,
              ],
            },
          },
        },
      ]);
    } catch (error) {
      logger.error(
        `🐛🐛 Error updating counts and online status: ${error.message}`
      );
    }

    return {
      success: true,
      message: "Inactive mobile devices cleaned up",
      data: { modifiedCount: result.modifiedCount },
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Error cleaning up inactive devices: ${error.message}`);
    return {
      success: false,
      message: "Failed to cleanup inactive devices",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

gridSchema.statics.getMobileDeviceStats = async function(filter = {}, next) {
  try {
    const pipeline = [
      { $match: filter },
      {
        $group: {
          _id: null,
          totalGrids: { $sum: 1 },
          gridsWithMobileDevices: {
            $sum: { $cond: [{ $gt: ["$mobileDeviceCount", 0] }, 1, 0] },
          },
          totalMobileDevices: { $sum: "$mobileDeviceCount" },
          onlineGrids: {
            $sum: { $cond: ["$isOnline", 1, 0] },
          },
        },
      },
    ];

    const stats = await this.aggregate(pipeline);

    return {
      success: true,
      message: "Mobile device statistics retrieved",
      data: stats[0] || {
        totalGrids: 0,
        gridsWithMobileDevices: 0,
        totalMobileDevices: 0,
        onlineGrids: 0,
      },
      status: httpStatus.OK,
    };
  } catch (error) {
    logger.error(`🐛🐛 Error getting mobile device stats: ${error.message}`);
    return {
      success: false,
      message: "Failed to get mobile device statistics",
      errors: { message: error.message },
      status: httpStatus.INTERNAL_SERVER_ERROR,
    };
  }
};

gridSchema.statics.modifyShape = async function(
  { filter = {}, update = {} } = {},
  next
) {
  try {
    const options = {
      new: true,
      useFindAndModify: false,
      projection: { __v: 0 },
    };

    // Only allow shape, centers, and shape_update_history updates
    const allowedFields = ["shape", "centers", "$push"];
    const modifiedUpdateBody = {};

    Object.keys(update).forEach((key) => {
      if (allowedFields.includes(key)) {
        modifiedUpdateBody[key] = update[key];
      }
    });

    const updatedGrid = await this.findOneAndUpdate(
      filter,
      modifiedUpdateBody,
      options
    ).exec();

    if (!isEmpty(updatedGrid)) {
      return {
        success: true,
        message: "Successfully updated the grid shape and recalculated centers",
        data: updatedGrid._doc,
        status: httpStatus.OK,
      };
    } else {
      next(
        new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
          ...filter,
          message: "Grid does not exist, please crosscheck",
        })
      );
    }
  } catch (error) {
    logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
    next(
      new HttpError("Internal Server Error", httpStatus.INTERNAL_SERVER_ERROR, {
        message: error.message,
      })
    );
  }
};

const GridModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    const grids = mongoose.model("grids");
    return grids;
  } catch (error) {
    const grids = getModelByTenant(dbTenant, "grid", gridSchema);
    return grids;
  }
};

module.exports = GridModel;
