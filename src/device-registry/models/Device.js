const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { getModelByTenant } = require("@config/database");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const { HttpError } = require("@utils/errors");
const { monthsInfront } = require("@utils/date");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
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
  if (this.isModified("name")) {
    if (this.writeKey && this.readKey) {
      this.writeKey = this._encryptKey(this.writeKey);
      this.readKey = this._encryptKey(this.readKey);
    }
    let n = this.name;
  }

  this.device_codes = [this._id, this.name];
  if (this.device_number) {
    this.device_codes.push(this.device_number);
  }
  if (this.alias) {
    this.device_codes.push(this.alias);
  }

  // Check for duplicate values in the grids array
  const duplicateValues = this.cohorts.filter(
    (value, index, self) => self.indexOf(value) !== index
  );
  if (duplicateValues.length > 0) {
    const error = new Error("Duplicate values found in cohorts array.");
    return next(error);
  }

  return next();
});

deviceSchema.pre("update", function(next) {
  if (this.isModified("name")) {
    let n = this.name;
  }
  return next();
});

deviceSchema.pre("findByIdAndUpdate", function(next) {
  this.options.runValidators = true;
  if (this.isModified("name")) {
    let n = this.name;
  }
  return next();
});

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
      let modifiedArgs = Object.assign({}, args);

      if (isEmpty(modifiedArgs.network)) {
        modifiedArgs.network = constants.DEFAULT_NETWORK;
      }

      if (
        !isEmpty(modifiedArgs.generation_version) &&
        !isEmpty(modifiedArgs.generation_count)
      ) {
        modifiedArgs.name = `aq_g${modifiedArgs.generation_version}_${modifiedArgs.generation_count}`;
      }

      if (!isEmpty(modifiedArgs.name) || !isEmpty(modifiedArgs.long_name)) {
        try {
          let alias = modifiedArgs.long_name
            ? modifiedArgs.long_name
            : modifiedArgs.name;
          if (!isEmpty(alias)) {
            modifiedArgs.alias = alias.trim().replace(/ /g, "_");
          } else if (isEmpty(alias)) {
            next(
              new HttpError(
                "Internal Server Error",
                httpStatus.INTERNAL_SERVER_ERROR,
                { message: "unable to generate the ALIAS for the device" }
              )
            );
          }
        } catch (error) {
          logger.error(
            `internal server error -- sanitise ALIAS -- ${error.message}`
          );
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: error.message }
            )
          );
        }
      }

      if (!isEmpty(modifiedArgs.name)) {
        try {
          let nameWithoutWhiteSpaces = modifiedArgs.name.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          );
          let shortenedName = nameWithoutWhiteSpaces.slice(0, 41);
          modifiedArgs.name = shortenedName.trim().toLowerCase();
        } catch (error) {
          logger.error(
            `internal server error -- sanitise NAME -- ${error.message}`
          );
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: error.message }
            )
          );
        }
      }

      if (!isEmpty(modifiedArgs.long_name && isEmpty(modifiedArgs.name))) {
        try {
          let nameWithoutWhiteSpaces = modifiedArgs.long_name.replace(
            /[^a-zA-Z0-9]/g,
            "_"
          );
          let shortenedName = nameWithoutWhiteSpaces.slice(0, 41);
          modifiedArgs.name = shortenedName.trim().toLowerCase();
        } catch (error) {
          logger.error(
            `internal server error -- sanitiseName-- ${error.message}`
          );
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: error.message }
            )
          );
        }
      }

      if (isEmpty(modifiedArgs.long_name && !isEmpty(modifiedArgs.name))) {
        try {
          modifiedArgs.long_name = modifiedArgs.name;
        } catch (error) {
          logger.error(
            `internal server error -- sanitiseName-- ${error.message}`
          );
          next(
            new HttpError(
              "Internal Server Error",
              httpStatus.INTERNAL_SERVER_ERROR,
              { message: error.message }
            )
          );
        }
      }

      let createdDevice = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(createdDevice)) {
        return {
          success: true,
          message: "successfully created the device",
          data: createdDevice._doc,
          status: httpStatus.CREATED,
        };
      } else {
        logger.error("operation successful but device is not created");
        next(
          new HttpError(
            "Internal Server Error",
            httpStatus.INTERNAL_SERVER_ERROR,
            { message: "operation successful but device not created" }
          )
        );
      }
      logger.warn("operation successful but device is not created");
    } catch (error) {
      logObject("the error in the Device Model", error);
      logger.error(`🐛🐛 Internal Server Error -- ${JSON.stringify(error)}`);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = httpStatus.CONFLICT;
      if (error.errors) {
        Object.entries(error.errors).forEach(([key, value]) => {
          response.message = value.message;
          response[key] = value.message;
          return response;
        });
      }
      next(new HttpError(message, status, response));
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
      logger.error(`🐛🐛 Internal Server Error -- ${JSON.stringify(error)}`);
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
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};
      //device_number, generation_count, generation_version, network
      const invalidKeys = ["name", "_id", "writeKey", "readKey"];
      modifiedUpdate = sanitizeObject(modifiedUpdate, invalidKeys);

      let options = { new: true, projected: modifiedUpdate, ...opts };

      if (!isEmpty(modifiedUpdate.access_code)) {
        const access_code = accessCodeGenerator.generate({
          length: 16,
          excludeSimilarCharacters: true,
        });
        modifiedUpdate.access_code = access_code.toUpperCase();
      }

      if (modifiedUpdate.device_codes) {
        modifiedUpdate["$addToSet"]["device_codes"] = {};
        modifiedUpdate["$addToSet"]["device_codes"]["$each"] =
          modifiedUpdate.device_codes;
        delete modifiedUpdate["device_codes"];
      }

      if (modifiedUpdate.previous_sites) {
        modifiedUpdate["$addToSet"]["previous_sites"] = {};
        modifiedUpdate["$addToSet"]["previous_sites"]["$each"] =
          modifiedUpdate.previous_sites;
        delete modifiedUpdate["previous_sites"];
      }

      if (modifiedUpdate.pictures) {
        modifiedUpdate["$addToSet"]["pictures"] = {};
        modifiedUpdate["$addToSet"]["pictures"]["$each"] =
          modifiedUpdate.pictures;
        delete modifiedUpdate["pictures"];
      }

      const updatedDevice = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      );

      if (!isEmpty(updatedDevice)) {
        let data = updatedDevice._doc;
        delete data.__v;
        return {
          success: true,
          message: "successfully modified the device",
          data,
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
