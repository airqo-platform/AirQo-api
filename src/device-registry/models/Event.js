/*
Changes made to `measurementsSchema` schema may affect the format of messages 
received from the message broker (Kafka). Consider updating 
the schema `AirQo-api/kafka/schemas/transformed-device-measurements.avsc`
and following up on its deployment. :)
*/

const { Schema, model } = require("mongoose");
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
      trim: true,
    },
    device: {
      type: String,
      required: [true, "The device name is required"],
      trim: true,
    },
    device_id: {
      type: ObjectId,
      required: [true, "The device ID is required"],
    },
    device_number: {
      type: Number,
      default: null,
    },
    site: {
      type: String,
      required: [true, "the site name is required"],
    },
    site_id: {
      type: ObjectId,
      required: [true, "The site ID is required"],
    },
    pm1: {
      value: {
        type: Number,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    pm2_5: {
      value: {
        type: Number,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    s2_pm2_5: {
      value: {
        type: Number,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    pm10: {
      value: {
        type: Number,
        trim: true,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    s2_pm10: {
      value: {
        type: Number,
        trim: true,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    no2: {
      value: {
        type: Number,
        default: null,
      },
      calibratedValue: { type: Number, default: null },
      uncertaintyValue: { type: Number, default: null },
      standardDeviationValue: { type: Number, default: null },
    },
    battery: {
      value: {
        type: Number,
        default: null,
      },
    },
    location: {
      latitude: {
        value: {
          type: Number,
          default: null,
        },
      },
      longitude: {
        value: {
          type: Number,
          default: null,
        },
      },
    },
    altitude: {
      value: {
        type: Number,
        default: null,
      },
    },
    speed: {
      value: {
        type: Number,
        default: null,
      },
    },
    satellites: {
      value: {
        type: Number,
        default: null,
      },
    },
    hdop: {
      value: {
        type: Number,
        default: null,
      },
    },
    internalTemperature: {
      value: {
        type: Number,
        default: null,
      },
    },
    internalHumidity: {
      value: {
        type: Number,
        default: null,
      },
    },
    externalTemperature: {
      value: {
        type: Number,
        default: null,
      },
    },
    externalHumidity: {
      value: {
        type: Number,
        default: null,
      },
    },
    externalPressure: {
      value: { type: Number, default: null },
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
      required: [true, "the day is required"],
    },
    first: {
      type: Date,
      required: [true, "the first day's event is required"],
    },
    last: { type: Date, required: [true, "the last day's event is required"] },
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
  {
    "values.time": 1,
    "values.device": 1,
    "values.device_id": 1,
    day: 1,
    "values.frequency": 1,
  },
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
