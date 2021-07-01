const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const tranformDeviceName = require("../utils/transform-device-name");
const { logObject, logElement } = require("../utils/log");
const { monthsInfront } = require("../utils/date");

const maxLength = [
  9,
  "The value of path `{PATH}` (`{VALUE}`) exceeds the maximum allowed length ({MAXLENGTH}).",
];

const minLength = [
  5,
  "The value of path `{PATH}` (`{VALUE}`) is shorter than the minimum allowed length ({MINLENGTH}).",
];

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
      required: [true, "Device name is required!"],
      trim: true,
      maxlength: maxLength,
      unique: true,
      minlength: minLength,
    },
    visibility: {
      type: Boolean,
      require: [true, "visibility is required"],
      trim: true,
    },
    createdAt: {
      type: Date,
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
  toJSON() {
    return {
      id: this._id,
      name: this.name,
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

  toUpdateJSON() {
    return {
      name: this.name,
      locationID: this.locationID,
      height: this.height,
      mountType: this.mountType,
      powerType: this.powerType,
      date: this.date,
      latitude: this.latitude,
      longitude: this.longitude,
      isPrimaryInLocation: this.isPrimaryInLocation,
      isUsedForCollocaton: this.isUsedForCollocation,
      updatedAt: this.updatedAt,
      siteName: this.siteName,
      locationName: this.locationName,
      site_id: this.site_id,
    };
  },
};

// I will add the check for the user after setting up the communications between services
deviceSchema.statics = {
  createDevice(args) {
    return this.create({
      ...args,
    });
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

  listByLocation({ skip = 0, limit = 5, loc = "" } = {}) {
    return this.find({ locationID: loc })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

module.exports = deviceSchema;
