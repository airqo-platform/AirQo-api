const { Schema } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = Schema.Types.ObjectId;

const measurementsSchema = [
  {
    time: {
      type: Date,
      required: [true, "the timestamp is required"],
    },
    frequency: {
      type: String,
      required: [true, "the frequency is required"],
    },
    device: {
      type: String,
      required: [true, "The device name is required"],
      trim: true,
    },
    deviceID: {
      type: ObjectId,
      required: [true, "The device ID is required"],
    },
    channelID: {
      type: Number,
      trim: true,
    },
    site: {
      type: String,
      required: [true, "the site ID is required"],
    },
    siteID: {
      type: ObjectId,
      required: [true, "The site ID is required"],
    },
    pm1: {
      value: {
        type: Number,
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    pm2_5: {
      value: {
        type: Number,
        required: [true, "the raw value is required"],
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    s2_pm2_5: {
      value: {
        type: Number,
        required: [true, "the raw value is required"],
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    pm10: {
      value: {
        type: Number,
        required: [true, "the raw value is required"],
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    s2_pm10: {
      value: {
        type: Number,
        required: [true, "the raw value is required"],
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    no2: {
      value: {
        type: Number,
      },
      calibratedValue: { type: Number },
      uncertaintyValue: { type: Number },
      standardDeviationValue: { type: Number },
    },
    battery: {
      value: {
        type: Number,
      },
    },
    location: {
      latitude: {
        value: {
          type: Number,
        },
      },
      longitude: {
        value: {
          type: Number,
        },
      },
    },
    altitude: {
      value: {
        type: Number,
      },
    },
    speed: {
      value: {
        type: Number,
      },
    },
    satellites: {
      value: {
        type: Number,
      },
    },
    hdop: {
      value: {
        type: Number,
      },
    },
    internalTemperature: {
      value: {
        type: Number,
      },
    },
    internalHumidity: {
      value: {
        type: Number,
      },
    },
    externalTemperature: {
      value: {
        type: Number,
      },
    },
    externalHumidity: {
      value: {
        type: Number,
      },
    },
    externalPressure: {
      value: { type: Number },
    },
    externalAltitude: {
      value: {
        type: Number,
      },
    },
  },
];

const eventSchema = new Schema(
  {
    day: {
      type: String,
    },
    first: { type: Date },
    last: { type: Date },
    nValues: {
      type: Number,
    },
    values: { type: [measurementsSchema], default: [measurementsSchema] },
  },
  {
    timestamps: true,
  }
);

eventSchema.index(
  { "values.time": 1, "values.device": 1, day: 1, "values.frequency": 1 },
  { unique: true }
);

eventSchema.index({ day: 1 }, { unique: true });

eventSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

eventSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

eventSchema.methods = {
  toJSON() {
    return {
      day: this.day,
      values: this.values,
    };
  },
};

eventSchema.statics = {
  createEvent(args) {
    return this.create({
      ...args,
    });
  },

  list({ skipInt = 0, limitInt = 100, filter = {} } = {}) {
    logObject("the filter", filter);
    return this.aggregate()
      .unwind("values")
      .match(filter)
      .replaceRoot("values")
      .sort({ time: -1 })
      .project({
        _id: 0,
        day: 0,
        __v: 0,
        createdAt: 0,
        first: 0,
        last: 0,
        nValues: 0,
        updatedAt: 0,
      })
      .skip(skipInt)
      .limit(limitInt)
      .allowDiskUse(true);
  },
  listRecent({ skipInt = 0, limitInt = 100, filter = {} } = {}) {
    logObject("the filter", filter);
    return this.aggregate()
      .unwind("values")
      .match(filter)
      .replaceRoot("values")
      .lookup({
        from: "devices",
        localField: "device",
        foreignField: "name",
        as: "deviceDetails",
      })
      .sort({ time: -1 })
      .group({
        _id: "$device",
        channelID: { $first: "$channelID" },
        time: { $first: "$time" },
        pm2_5: { $first: "$pm2_5" },
        s2_pm2_5: { $first: "$s2_pm2_5" },
        pm10: { $first: "$pm10" },
        s2_pm10: { $first: "$s2_pm10" },
        frequency: { $first: "$frequency" },
        battery: { $first: "$battery" },
        location: { $first: "$location" },
        altitude: { $first: "$altitude" },
        speed: { $first: "$speed" },
        satellites: { $first: "$satellites" },
        hdop: { $first: "$hdop" },
        internalTemperature: { $first: "$internalTemperature" },
        externalTemperature: { $first: "$externalTemperature" },
        internalHumidity: { $first: "$internalHumidity" },
        externalHumidity: { $first: "$externalHumidity" },
        externalAltitude: { $first: "$externalAltitude" },
        pm1: { $first: "$pm1" },
        no2: { $first: "$no2" },
        deviceDetails: { $first: { $arrayElemAt: ["$deviceDetails", 0] } },
      })
      .skip(skipInt)
      .limit(limitInt)
      .allowDiskUse(true);
  },
};

module.exports = eventSchema;
