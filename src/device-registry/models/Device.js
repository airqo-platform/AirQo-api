const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const { HttpError } = require("@utils/errors");
const { monthsInfront } = require("@utils/date");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-model`);
const httpStatus = require("http-status");
const maxLength = [
  40,
  "The value of path `{PATH}` (`{VALUE}`) exceeds the maximum allowed length ({MAXLENGTH}).",
];

const minLength = [
  3,
  "The value of path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).",
];

const noSpaces = /^\S*$/;

const accessCodeGenerator = require("generate-password");

function sanitizeObject(obj, invalidKeys) {
  invalidKeys.forEach((key) => {
    if (obj.hasOwnProperty(key)) {
      delete obj[key];
    }
  });
  return obj;
}

const DEVICE_CATEGORIES = Object.freeze({
  GAS: "gas",
  LOWCOST: "lowcost",
  BAM: "bam",
});

const deviceSchema = new mongoose.Schema(
  {
    cohorts: {
      type: [
        {
          type: ObjectId,
          ref: "cohort",
        },
      ],
    },
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    approximate_distance_in_km: {
      type: Number,
    },
    bearing_in_radians: {
      type: Number,
    },
    writeKey: {
      type: String,
    },
    readKey: {
      type: String,
    },
    network: {
      type: String,
      trim: true,
      required: [true, "the network is required!"],
    },
    group: {
      type: String,
      trim: true,
    },
    manufacturer_id: {
      type: String,
      trim: true,
      unique: true,
    },
    authRequired: {
      type: Boolean,
      trim: true,
      default: true,
    },
    api_code: {
      type: String,
      trim: true,
      unique: true,
    },
    access_code: {
      type: String,
    },
    alias: {
      type: String,
      trim: true,
      maxlength: maxLength,
      unique: true,
      minlength: minLength,
      match: noSpaces,
    },
    name: {
      type: String,
      required: [true, "the Device name is required!"],
      trim: true,
      maxlength: maxLength,
      unique: true,
      minlength: minLength,
      match: noSpaces,
      lowercase: true,
    },
    long_name: {
      type: String,
      trim: true,
      unique: true,
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    createdAt: {
      type: Date,
    },
    lastActive: { type: Date },
    isOnline: {
      type: Boolean,
      trim: true,
      default: false,
    },
    generation_version: {
      type: Number,
    },
    generation_count: {
      type: Number,
    },
    tags: {
      type: Array,
    },
    description: {
      type: String,
      trim: true,
    },
    mobility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    height: {
      type: Number,
      default: 0,
    },
    mountType: {
      type: String,
      trim: true,
      lowercase: true,
    },
    device_codes: [
      {
        type: String,
        trim: true,
      },
    ],

    previous_sites: [
      {
        type: ObjectId,
        trim: true,
      },
    ],

    status: {
      type: String,
      default: "not deployed",
    },
    ISP: {
      type: String,
    },
    phoneNumber: {
      type: String,
    },
    powerType: {
      type: String,
      trim: true,
      lowercase: true,
    },
    host_id: {
      type: ObjectId,
    },
    site_id: {
      type: ObjectId,
    },
    isPrimaryInLocation: {
      type: Boolean,
      default: false,
    },
    nextMaintenance: {
      type: Date,
      default: monthsInfront(3),
    },
    deployment_date: {
      type: Date,
    },
    maintenance_date: {
      type: Date,
    },
    recall_date: {
      type: Date,
    },
    device_number: {
      type: Number,
      trim: true,
    },
    category: {
      type: String,
      default: "lowcost",
      enum: Object.values(DEVICE_CATEGORIES),
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    pictures: [{ type: String }],
  },
  {
    timestamps: true,
  }
);

deviceSchema.plugin(uniqueValidator, {
  message: `{VALUE} must be unique!`,
});

deviceSchema.post("save", async function(doc) {});

deviceSchema.pre("save", function(next) {
  // Set default network if not provided
  if (!this.network) {
    this.network = constants.DEFAULT_NETWORK;
  }

  // Manage manufacturer_id based on device_number and network
  if (this.network === "airqo" && this.device_number) {
    this.manufacturer_id = String(this.device_number); // Assign device_number as a string
  } else if (!this.manufacturer_id && this.network !== "airqo") {
    next(
      new HttpError(
        "Devices not part of the AirQo network must include a manufacturer_id as a string.",
        httpStatus.BAD_REQUEST
      )
    );
  }

  // Generate name based on generation version and count
  if (this.generation_version && this.generation_count) {
    this.name = `aq_g${this.generation_version}_${this.generation_count}`;
  }

  // Handle alias generation
  if (!this.alias && (this.long_name || this.name)) {
    this.alias = (this.long_name || this.name).trim().replace(/ /g, "_");
    if (!this.alias) {
      return next(
        new HttpError(
          "Unable to generate ALIAS for the device.",
          httpStatus.INTERNAL_SERVER_ERROR
        )
      );
    }
  }

  // Sanitize name
  const sanitizeName = (name) => {
    return name
      .replace(/[^a-zA-Z0-9]/g, "_")
      .slice(0, 41)
      .trim()
      .toLowerCase();
  };

  if (this.name) {
    this.name = sanitizeName(this.name);
  } else if (this.long_name) {
    this.name = sanitizeName(this.long_name);
  }

  // Set long_name if not provided
  if (!this.long_name && this.name) {
    this.long_name = this.name;
  }

  // Encrypt keys if modified
  if (this.isModified("name") && this.writeKey && this.readKey) {
    this.writeKey = this._encryptKey(this.writeKey);
    this.readKey = this._encryptKey(this.readKey);
  }

  // Generate device codes
  this.device_codes = [this._id, this.name];
  if (this.device_number) {
    this.device_codes.push(this.device_number);
  }
  if (this.alias) {
    this.device_codes.push(this.alias);
  }

  // Check for duplicate values in cohorts array
  const duplicateValues = this.cohorts.filter(
    (value, index, self) => self.indexOf(value) !== index
  );

  if (duplicateValues.length > 0) {
    return next(
      new HttpError(
        "Duplicate values found in cohorts array.",
        httpStatus.BAD_REQUEST
      )
    );
  }

  return next();
});

deviceSchema.pre(
  ["update", "findByIdAndUpdate", "updateMany", "updateOne"],
  function(next) {
    // Enable validation on update
    this.setOptions({ runValidators: true });

    const updateData = this.getUpdate(); // Get the data being updated

    // Handling the network condition
    if (updateData.network === "airqo") {
      if (updateData.device_number) {
        updateData.manufacturer_id = String(updateData.device_number);
      } else if (updateData.manufacturer_id) {
        updateData.device_number = Number(updateData.manufacturer_id);
      }
    }

    // Sanitize name if modified
    if (updateData.name) {
      const sanitizeName = (name) => {
        return name
          .replace(/[^a-zA-Z0-9]/g, "_")
          .slice(0, 41)
          .trim()
          .toLowerCase();
      };
      updateData.name = sanitizeName(updateData.name);
    }

    // Generate access code if present in update
    if (updateData.access_code) {
      const access_code = accessCodeGenerator.generate({
        length: 16,
        excludeSimilarCharacters: true,
      });
      updateData.access_code = access_code.toUpperCase();
    }

    // Handle $addToSet for device_codes, previous_sites, and pictures
    const addToSetUpdates = {};

    if (updateData.device_codes) {
      addToSetUpdates.device_codes = { $each: updateData.device_codes };
      delete updateData.device_codes; // Remove from main update object
    }

    if (updateData.previous_sites) {
      addToSetUpdates.previous_sites = { $each: updateData.previous_sites };
      delete updateData.previous_sites; // Remove from main update object
    }

    if (updateData.pictures) {
      addToSetUpdates.pictures = { $each: updateData.pictures };
      delete updateData.pictures; // Remove from main update object
    }

    // If there are any $addToSet updates, merge them into the main update object
    if (Object.keys(addToSetUpdates).length > 0) {
      updateData.$addToSet = addToSetUpdates;
    }

    next();
  }
);
deviceSchema.methods = {
  _encryptKey(key) {
    let encryptedKey = cryptoJS.AES.encrypt(
      key,
      constants.KEY_ENCRYPTION_KEY
    ).toString();
    return encryptedKey;
  },
  toJSON() {
    return {
      id: this._id,
      name: this.name,
      alias: this.alias,
      mobility: this.mobility,
      network: this.network,
      group: this.group,
      api_code: this.api_code,
      manufacturer_id: this.manufacturer_id,
      authRequired: this.authRequired,
      long_name: this.long_name,
      latitude: this.latitude,
      longitude: this.longitude,
      approximate_distance_in_km: this.approximate_distance_in_km,
      bearing_in_radians: this.bearing_in_radians,
      createdAt: this.createdAt,
      ISP: this.ISP,
      phoneNumber: this.phoneNumber,
      visibility: this.visibility,
      description: this.description,
      name_id: this.name_id,
      isPrimaryInLocation: this.isPrimaryInLocation,
      nextMaintenance: this.nextMaintenance,
      deployment_date: this.deployment_date,
      maintenance_date: this.maintenance_date,
      recall_date: this.recall_date,
      device_number: this.device_number,
      status: this.status,
      powerType: this.powerType,
      mountType: this.mountType,
      isActive: this.isActive,
      writeKey: this.writeKey,
      lastActive: this.lastActive,
      isOnline: this.isOnline,
      isRetired: this.isRetired,
      readKey: this.readKey,
      pictures: this.pictures,
      site_id: this.site_id,
      host_id: this.host_id,
      height: this.height,
      device_codes: this.device_codes,
      category: this.category,
      access_code: this.access_code,
      cohorts: this.cohorts,
    };
  },
};

deviceSchema.statics = {
  async register(args, next) {
    try {
      const createdDevice = await this.create(args);

      if (!createdDevice) {
        logger.error("Operation successful but device is not created");
        return next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "operation successful but device not created" }
          )
        );
      }

      return {
        success: true,
        message: "Successfully created the device",
        data: createdDevice._doc,
        status: httpStatus.CREATED,
      };
    } catch (error) {
      logObject("The error in the Device Model", error);
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);

      let response = {};
      let message = "Validation errors for some of the provided fields";

      // Check if the error is an instance of HttpError
      if (error instanceof HttpError) {
        // Log the HTTP error details
        logger.error(
          `HTTP Error: ${error.message}, Status: ${error.statusCode}`
        );
        response.message = error.message; // Use the message from HttpError
        response.details = error.details || {}; // Capture additional details if available
      } else if (error.errors) {
        // Handle validation errors
        Object.entries(error.errors).forEach(([key, value]) => {
          response[key] = value.message; // Capture specific field errors
        });
      } else {
        // Fallback for unexpected errors
        response.message = "An unexpected error occurred.";
      }

      return next(new HttpError(message, httpStatus.CONFLICT, response));
    }
  },
  async list({ _skip = 0, _limit = 1000, filter = {} } = {}, next) {
    try {
      const inclusionProjection = constants.DEVICES_INCLUSION_PROJECTION;
      const exclusionProjection = constants.DEVICES_EXCLUSION_PROJECTION(
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
        .match(filter)
        .lookup({
          from: "sites",
          localField: "site_id",
          foreignField: "_id",
          as: "site",
        })
        .lookup({
          from: "hosts",
          localField: "host_id",
          foreignField: "_id",
          as: "host",
        })
        .lookup({
          from: "sites",
          localField: "previous_sites",
          foreignField: "_id",
          as: "previous_sites",
        })
        .lookup({
          from: "cohorts",
          localField: "cohorts",
          foreignField: "_id",
          as: "cohorts",
        })
        .lookup({
          from: "grids",
          localField: "site.grids",
          foreignField: "_id",
          as: "grids",
        })
        .sort({ createdAt: -1 })
        .project(inclusionProjection)
        .project(exclusionProjection)
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      const response = await pipeline;
      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the device details",
          data: response,
          status: httpStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "no device details exist for this search, please crosscheck",
          status: httpStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      logObject("error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${stringify(error)}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
  async modify({ filter = {}, update = {}, opts = {} } = {}, next) {
    try {
      const invalidKeys = ["name", "_id", "writeKey", "readKey"];
      const sanitizedUpdate = sanitizeObject(update, invalidKeys);

      const options = { new: true, ...opts };

      if (sanitizedUpdate.access_code) {
        const access_code = accessCodeGenerator.generate({
          length: 16,
          excludeSimilarCharacters: true,
        });
        sanitizedUpdate.access_code = access_code.toUpperCase();
      }

      const updatedDevice = await this.findOneAndUpdate(
        filter,
        sanitizedUpdate,
        options
      );

      if (updatedDevice) {
        let data = updatedDevice._doc;
        delete data.__v; // Exclude version key from response
        return {
          success: true,
          message: "Successfully modified the device",
          data,
          status: httpStatus.OK,
        };
      } else {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "Device does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
  async encryptKeys({ filter = {}, update = {} } = {}, next) {
    try {
      logObject("the filter", filter);
      let options = { new: true };
      let modifiedUpdate = update;
      validKeys = ["writeKey", "readKey"];
      Object.keys(modifiedUpdate).forEach(
        (key) => validKeys.includes(key) || delete modifiedUpdate[key]
      );

      logObject("modifiedUpdate", modifiedUpdate);
      if (update.writeKey) {
        let key = update.writeKey;
        modifiedUpdate.writeKey = cryptoJS.AES.encrypt(
          key,
          constants.KEY_ENCRYPTION_KEY
        ).toString();
      }
      if (update.readKey) {
        let key = update.readKey;
        modifiedUpdate.readKey = cryptoJS.AES.encrypt(
          key,
          constants.KEY_ENCRYPTION_KEY
        ).toString();
      }
      const updatedDevice = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedDevice)) {
        return {
          success: true,
          message: "successfully modified the device",
          data: updatedDevice._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(updatedDevice)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "device does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logObject("the error", error);
      logger.error(`🐛🐛 Internal Server Error -- ${error.message}`);
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
          device_number: 1,
          long_name: 1,
          category: 1,
        },
      };
      let removedDevice = await this.findOneAndRemove(filter, options).exec();

      if (!isEmpty(removedDevice)) {
        return {
          success: true,
          message: "successfully deleted device from the platform",
          data: removedDevice._doc,
          status: httpStatus.OK,
        };
      } else if (isEmpty(removedDevice)) {
        next(
          new HttpError("Bad Request Error", httpStatus.BAD_REQUEST, {
            message: "device does not exist, please crosscheck",
          })
        );
      }
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error --- ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          {
            message: error.message,
          }
        )
      );
    }
  },
};

const DeviceModel = (tenant) => {
  try {
    let devices = mongoose.model("devices");
    return devices;
  } catch (error) {
    let devices = getModelByTenant(tenant, "device", deviceSchema);
    return devices;
  }
};

module.exports = DeviceModel;
