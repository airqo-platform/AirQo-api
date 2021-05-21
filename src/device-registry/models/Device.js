const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const uniqueValidator = require("mongoose-unique-validator");
const tranformDeviceName = require("../utils/transform-device-name");

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
      unique: true,
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
      type: String,
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
    },
    product_name: {
      type: String,
    },
    powerType: {
      type: String,
    },
    locationID: {
      type: String,
    },
    host: {
      name: String,
      phone: Number,
    },
    isPrimaryInLocation: {
      type: Boolean,
    },
    isUsedForCollocation: {
      type: Boolean,
    },
    nextMaintenance: {
      type: Date,
    },
    channelID: {
      type: Number,
      required: [true, "Channel ID is required!"],
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
    this.name = this._transformDeviceName(this.name);
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
      id: this.id,
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
      channelID: this.channelID,
      powerType: this.powerType,
      mountType: this.mountType,
      locationID: this.locationID,
      isActive: this.isActive,
      writeKey: this.writeKey,
      readKey: this.readKey,
      pictures: this.pictures,
      siteName: this.siteName,
      locationName: this.locationName,
      height: this.height,
    };
  },

  toUpdateJSON() {
    return {
      deviceName: this.deviceName,
      locationID: this.locationName,
      height: this.height,
      mountType: this.mountType,
      powerType: this.powerType,
      date: this.date,
      latitude: this.latitude,
      longitude: this.longitude,
      isPrimaryInLocation: this.isPrimaryInLocation,
      isUserForCollocaton: this.isUsedForCollocation,
      updatedAt: this.updatedAt,
      siteName: this.siteName,
      locationName: this.locationName,
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

  list({ skip = 0, limit = 5, filter = {} } = {}) {
    return this.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },

  listByLocation({ skip = 0, limit = 5, loc = "" } = {}) {
    return this.find({ locationID: loc })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

module.exports = deviceSchema;
