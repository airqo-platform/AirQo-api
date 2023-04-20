const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("@utils/log");
const { monthsInfront } = require("@utils/date");
const constants = require("@config/constants");
const cryptoJS = require("crypto-js");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- device-model`);
const HTTPStatus = require("http-status");
const maxLength = [
  15,
  "The value of path `{PATH}` (`{VALUE}`) exceeds the maximum allowed length ({MAXLENGTH}).",
];

const minLength = [
  7,
  "The value of path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).",
];

const noSpaces = /^\S*$/;

const accessCodeGenerator = require("generate-password");

const deviceSchema = new mongoose.Schema(
  {
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
    access_code: {
      type: String,
    },
    name_id: {
      type: String,
      unique: true,
      trim: true,
      match: noSpaces,
      lowercase: true,
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
    },
    visibility: {
      type: Boolean,
      trim: true,
      default: false,
    },
    createdAt: {
      type: Date,
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
      unique: true,
      required: false,
    },
    category: {
      type: String,
      default: "lowcost",
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

deviceSchema.pre("save", function(next) {
  if (this.isModified("name")) {
    if (this.writeKey && this.readKey) {
      this.writeKey = this._encryptKey(this.writeKey);
      this.readKey = this._encryptKey(this.readKey);
    }
    let n = this.name;
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
      mobility: this.mobility,
      network: this.network,
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
      isRetired: this.isRetired,
      readKey: this.readKey,
      pictures: this.pictures,
      site_id: this.site_id,
      height: this.height,
      device_codes: this.device_codes,
      category: this.category,
      access_code: this.access_code,
    };
  },
};

deviceSchema.statics = {
  async register(args) {
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

      if (!isEmpty(modifiedArgs.name)) {
        try {
          let nameWithoutWhiteSpaces = modifiedArgs.name.replace(/\s/g, "");
          let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
          modifiedArgs.name = shortenedName.trim().toLowerCase();
        } catch (error) {
          logger.error(
            `internal server error -- sanitiseName-- ${error.message}`
          );
          return {
            success: false,
            errors: { message: error.message },
            message: "Internal Server Error",
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }

      if (!isEmpty(modifiedArgs.long_name && isEmpty(modifiedArgs.name))) {
        try {
          let nameWithoutWhiteSpaces = modifiedArgs.long_name.replace(
            /\s/g,
            ""
          );
          let shortenedName = nameWithoutWhiteSpaces.substring(0, 15);
          modifiedArgs.name = shortenedName.trim().toLowerCase();
        } catch (error) {
          logger.error(
            `internal server error -- sanitiseName-- ${error.message}`
          );
          return {
            success: false,
            errors: { message: error.message },
            message: "Internal Server Error",
            status: HTTPStatus.INTERNAL_SERVER_ERROR,
          };
        }
      }

      logObject("modifiedArgs", modifiedArgs);

      let createdDevice = await this.create({
        ...modifiedArgs,
      });
      if (!isEmpty(createdDevice)) {
        return {
          success: true,
          message: "successfully created the device",
          data: createdDevice._doc,
          status: HTTPStatus.CREATED,
        };
      }
      logger.warn("operation successful but device is not created");
      return {
        success: true,
        message: "operation successful but device not created",
        data: createdDevice._doc,
        status: HTTPStatus.OK,
      };
    } catch (err) {
      logObject("the error", err);
      let response = {};
      let message = "validation errors for some of the provided fields";
      let status = HTTPStatus.CONFLICT;
      Object.entries(err.errors).forEach(([key, value]) => {
        response.message = value.message;
        response[key] = value.message;
        return response;
      });

      return {
        errors: response,
        message,
        success: false,
        status,
      };
    }
  },
  async list({ _skip = 0, _limit = 1000, filter = {} } = {}) {
    try {
      // logger.info(
      //   `the filter received in the model -- ${JSON.stringify(filter)}`
      // );
      // logger.info(
      //   `the type of filter received in the model -- ${typeof filter}`
      // );
      const response = await this.aggregate()
        .match(filter)
        .lookup({
          from: "sites",
          localField: "site_id",
          foreignField: "_id",
          as: "site",
        })
        .lookup({
          from: "sites",
          localField: "previous_sites",
          foreignField: "_id",
          as: "previous_sites",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          long_name: 1,
          latitude: 1,
          longitude: 1,
          approximate_distance_in_km: 1,
          bearing_in_radians: 1,
          createdAt: 1,
          ISP: 1,
          phoneNumber: 1,
          visibility: 1,
          description: 1,
          isPrimaryInLocation: 1,
          nextMaintenance: 1,
          deployment_date: 1,
          name_id: 1,
          recall_date: 1,
          maintenance_date: 1,
          device_number: 1,
          powerType: 1,
          mountType: 1,
          isActive: 1,
          writeKey: 1,
          readKey: 1,
          access_code: 1,
          device_codes: 1,
          height: 1,
          mobility: 1,
          status: 1,
          network: 1,
          category: 1,
          previous_sites: 1,
          site: { $arrayElemAt: ["$site", 0] },
        })
        .project({
          "site.lat_long": 0,
          "site.country": 0,
          "site.district": 0,
          "site.sub_county": 0,
          "site.parish": 0,
          "site.county": 0,
          "site.altitude": 0,
          "site.altitude": 0,
          "site.greenness": 0,
          "site.landform_90": 0,
          "site.landform_270": 0,
          "site.aspect": 0,
          "site.distance_to_nearest_road": 0,
          "site.distance_to_nearest_primary_road": 0,
          "site.distance_to_nearest_secondary_road": 0,
          "site.distance_to_nearest_tertiary_road": 0,
          "site.distance_to_nearest_unclassified_road": 0,
          "site.distance_to_nearest_residential_road": 0,
          "site.bearing_to_kampala_center": 0,
          "site.distance_to_kampala_center": 0,
          "site.generated_name": 0,
          "site.updatedAt": 0,
          "site.updatedAt": 0,
          "site.city": 0,
          "site.formatted_name": 0,
          "site.geometry": 0,
          "site.google_place_id": 0,
          "site.region": 0,
          "site.site_tags": 0,
          "site.street": 0,
          "site.town": 0,
          "site.nearest_tahmo_station": 0,
          "site.__v": 0,
        })
        .project({
          "previous_sites.lat_long": 0,
          "previous_sites.country": 0,
          "previous_sites.district": 0,
          "previous_sites.sub_county": 0,
          "previous_sites.parish": 0,
          "previous_sites.county": 0,
          "previous_sites.altitude": 0,
          "previous_sites.altitude": 0,
          "previous_sites.greenness": 0,
          "previous_sites.landform_90": 0,
          "previous_sites.landform_270": 0,
          "previous_sites.aspect": 0,
          "previous_sites.distance_to_nearest_road": 0,
          "previous_sites.distance_to_nearest_primary_road": 0,
          "previous_sites.distance_to_nearest_secondary_road": 0,
          "previous_sites.distance_to_nearest_tertiary_road": 0,
          "previous_sites.distance_to_nearest_unclassified_road": 0,
          "previous_sites.distance_to_nearest_residential_road": 0,
          "previous_sites.bearing_to_kampala_center": 0,
          "previous_sites.distance_to_kampala_center": 0,
          "previous_sites.generated_name": 0,
          "previous_sites.updatedAt": 0,
          "previous_sites.updatedAt": 0,
          "previous_sites.city": 0,
          "previous_sites.formatted_name": 0,
          "previous_sites.geometry": 0,
          "previous_sites.google_place_id": 0,
          "previous_sites.region": 0,
          "previous_sites.previous_sites_tags": 0,
          "previous_sites.street": 0,
          "previous_sites.town": 0,
          "previous_sites.nearest_tahmo_station": 0,
          "previous_sites.__v": 0,
          "previous_sites.weather_stations": 0,
          "previous_sites.latitude": 0,
          "previous_sites.longitude": 0,
          "previous_sites.images": 0,
          "previous_sites.airqlouds": 0,
          "previous_sites.site_codes": 0,
          "previous_sites.site_tags": 0,
          "previous_sites.land_use": 0,
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);

      // logger.info(`the data produced in the model -- ${response}`);
      if (!isEmpty(response)) {
        return {
          success: true,
          message: "successfully retrieved the device details",
          data: response,
          status: HTTPStatus.OK,
        };
      } else {
        return {
          success: true,
          message: "no device details exist for this search, please crosscheck",
          status: HTTPStatus.OK,
          data: [],
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "unable to retrieve devices",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async modify({ filter = {}, update = {}, opts = {} } = {}) {
    try {
      let modifiedUpdate = Object.assign({}, update);
      modifiedUpdate["$addToSet"] = {};
      delete modifiedUpdate.name;
      delete modifiedUpdate.device_number;
      delete modifiedUpdate._id;
      delete modifiedUpdate.generation_count;
      delete modifiedUpdate.generation_version;
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
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(updatedDevice)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "device does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logObject("the error", error);
      return {
        success: false,
        message: "Device model server error - modify",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async encryptKeys({ filter = {}, update = {} } = {}) {
    try {
      logObject("the filter", filter);
      let options = { new: true };
      let modifiedUpdate = update;
      delete modifiedUpdate.name;
      delete modifiedUpdate.device_number;
      delete modifiedUpdate._id;
      delete modifiedUpdate.generation_count;
      delete modifiedUpdate.generation_version;

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
      let updatedDevice = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();

      if (!isEmpty(updatedDevice)) {
        return {
          success: true,
          message: "successfully modified the device",
          data: updatedDevice._doc,
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(updatedDevice)) {
        return {
          success: false,
          message: "Internal Server Error",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "device does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      logObject("the error", error);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async remove({ filter = {} } = {}) {
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
          status: HTTPStatus.OK,
        };
      } else if (isEmpty(removedDevice)) {
        return {
          success: false,
          message: "device does not exist, please crosscheck",
          status: HTTPStatus.BAD_REQUEST,
          errors: { message: "device does not exist, please crosscheck" },
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Device model server error - remove",
        errors: { message: error.message },
        status: HTTPStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
};

module.exports = deviceSchema;
