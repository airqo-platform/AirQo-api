const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const tranformDeviceName = require("../utils/transform-device-name");
const { logObject, logElement } = require("../utils/log");
const { monthsInfront } = require("../utils/date");
const Cryptr = require("cryptr");
const constants = require("../config/constants");
const cryptr = new Cryptr(constants.KEY_ENCRYPTION_KEY);

const maxLength = [
  9,
  "The value of path `{PATH}` (`{VALUE}`) exceeds the maximum allowed length ({MAXLENGTH}).",
];

const minLength = [
  5,
  "The value of path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).",
];

const noSpaces = /^\S*$/;

const deviceSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
    license: {
      type: String,
    },
    writeKey: {
      type: String,
    },
    readKey: {
      type: String,
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
      required: [true, "the Device long name is required"],
      trim: true,
    },
    visibility: {
      type: Boolean,
      require: [true, "visibility is required"],
      trim: true,
    },
    createdAt: {
      type: Date,
    },
    generation: {
      type: Number,
      required: [true, "the generation is required"],
    },
    generation_count: {
      type: Number,
      required: [
        true,
        "the number of the device in the provided generation is required",
      ],
    },
    elevation: {
      type: Number,
    },
    owner: {
      type: ObjectId,
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
      default: "wall",
      lowercase: true,
    },
    ISP: {
      type: String,
    },
    siteName: {
      type: String,
    },
    locationName: {
      type: String,
    },
    phoneNumber: {
      type: Number,
    },
    device_manufacturer: {
      type: String,
      default: "airqo",
    },
    product_name: {
      type: String,
      default: "gen1",
    },
    powerType: {
      type: String,
      lowercase: true,
    },
    isRetired: {
      type: Boolean,
      default: false,
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
    isUsedForCollocation: {
      type: Boolean,
      default: false,
    },
    nextMaintenance: {
      type: Date,
      default: monthsInfront(3),
    },
    device_number: {
      type: Number,
      required: [true, "device_number is required!"],
      trim: true,
      unique: true,
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
  message: `{VALUE} already taken!`,
});

deviceSchema.pre("save", function(next) {
  if (this.isModified("name")) {
    // this.name = this._transformDeviceName(this.name);
    if (this.writeKey && this.readKey) {
      this.writeKey = this._encryptKey(this.writeKey);
      this.readKey = this._encryptKey(this.readKey);
    }
    let n = this.name;
    console.log({ n });
  }
  return next();
});

deviceSchema.pre("update", function(next) {
  if (this.isModified("name")) {
    // this.name = this._transformDeviceName(this.name);
    let n = this.name;
    console.log({ n });
  }
  return next();
});

deviceSchema.pre("findByIdAndUpdate", function(next) {
  this.options.runValidators = true;
  if (this.isModified("name")) {
    // this.name = this._transformDeviceName(this.name);
    let n = this.name;
    console.log({ n });
  }
  return next();
});

deviceSchema.methods = {
  _transformDeviceName(name) {
    let transformedName = tranformDeviceName(name);
    return transformedName;
  },
  _encryptKey(key) {
    let encryptedKey = cryptr.encrypt(key);
    return encryptedKey;
  },
  _decryptKey(encryptedKey) {
    let decryptedKey = cryptr.decrypt(encryptedKey);
    return decryptedKey;
  },
  toJSON() {
    return {
      id: this._id,
      name: this.name,
      long_name: this.long_name,
      latitude: this.latitude,
      longitude: this.longitude,
      createdAt: this.createdAt,
      owner: this.owner,
      device_manufacturer: this.device_manufacturer,
      product_name: this.product_name,
      ISP: this.ISP,
      phoneNumber: this.phoneNumber,
      visibility: this.visibility,
      description: this.description,
      isPrimaryInLocation: this.isPrimaryInLocation,
      isUsedForCollocation: this.isUsedForCollocation,
      nextMaintenance: this.nextMaintenance,
      device_number: this.device_number,
      powerType: this.powerType,
      mountType: this.mountType,
      isActive: this.isActive,
      writeKey: this.writeKey,
      isRetired: this.isRetired,
      readKey: this.readKey,
      pictures: this.pictures,
      site_id: this.site_id,
      siteName: this.siteName,
      locationName: this.locationName,
      height: this.height,
    };
  },
};

deviceSchema.statics = {
  async register(args) {
    try {
      logObject("the args", args);
      let createdDevice = await this.create({
        ...args,
      });
      return {
        success: true,
        message: "successfully created the device",
        data: createdDevice,
      };
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },

  list({ _skip = 0, _limit = 100, filter = {} } = {}) {
    try {
      return this.aggregate()
        .match(filter)
        .lookup({
          from: "sites",
          localField: "site_id",
          foreignField: "_id",
          as: "site",
        })
        .sort({ createdAt: -1 })
        .project({
          _id: 1,
          name: 1,
          latitude: 1,
          longitude: 1,
          createdAt: 1,
          owner: 1,
          device_manufacturer: 1,
          product_name: 1,
          ISP: 1,
          phoneNumber: 1,
          visibility: 1,
          description: 1,
          isPrimaryInLocation: 1,
          isUsedForCollocation: 1,
          nextMaintenance: 1,
          device_number: 1,
          powerType: 1,
          mountType: 1,
          locationID: 1,
          isActive: 1,
          writeKey: 1,
          readKey: 1,
          pictures: 1,
          siteName: 1,
          locationName: 1,
          height: 1,
          site: { $arrayElemAt: ["$site", 0] },
        })
        .skip(_skip)
        .limit(_limit)
        .allowDiskUse(true);
    } catch (error) {
      return {
        success: false,
        message: "unable to retrieve devices",
        error: error.message,
      };
    }
  },
  async modify({ filter = {}, update = {} } = {}) {
    try {
      let options = { new: true };
      let modifiedUpdate = update;
      logObject("modifiedUpdate", modifiedUpdate);
      if (update.writeKey) {
        modifiedUpdate.writeKey = cryptr.encrypt(update.writeKey);
      }
      if (update.readKey) {
        modifiedUpdate.readKey = cryptr.encrypt(update.readKey);
      }
      let updatedDevice = await this.findOneAndUpdate(
        filter,
        modifiedUpdate,
        options
      ).exec();
      let data = jsonify(updatedDevice);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully modified the device",
          data,
        };
      } else {
        return {
          success: false,
          message: "device does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Device model server error - modify",
        error: error.message,
      };
    }
  },
  async remove({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, name: 1, device_number: 1, long_name: 1 },
      };
      let removedDevice = await this.findOneAndRemove(filter, options).exec();
      let data = jsonify(removedDevice);
      if (!isEmpty(data)) {
        return {
          success: true,
          message: "successfully removed the device",
          data,
        };
      } else {
        return {
          success: false,
          message: "device does not exist, please crosscheck",
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "Device model server error - remove",
        error: error.message,
      };
    }
  },
};

module.exports = deviceSchema;
