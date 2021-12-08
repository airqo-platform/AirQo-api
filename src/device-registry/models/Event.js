/*
Changes made to `valueSchema` schema may affect the format of messages 
received from the message broker (Kafka). Consider updating 
the schema `AirQo-api/kafka/schemas/transformed-device-measurements.avsc`
and following up on its deployment. :)
*/
const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");
const { logObject, logElement, logText } = require("../utils/log");
const ObjectId = Schema.Types.ObjectId;
const constants = require("../config/constants");
const { isElement, isEmpty } = require("underscore");
const httpStatus = require("http-status");
const { getModelByTenant } = require("../utils/multitenancy");
const log4js = require("log4js");
const logger = log4js.getLogger("event-model");

const valueSchema = new Schema({
  time: {
    type: Date,
    required: [true, "the timestamp is required"],
  },
  frequency: {
    type: String,
    required: [true, "the frequency is required"],
    trim: true,
  },
  is_test_data: {
    type: Boolean,
    trim: true,
  },
  /**** */
  device: {
    type: String,
    trim: true,
    default: null,
  },
  is_device_primary: {
    type: Boolean,
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
    default: null,
  },
  site_id: {
    type: ObjectId,
  },
  /**** */
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
  average_pm2_5: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  average_pm10: {
    value: {
      type: Number,
      trim: true,
      default: null,
    },
    calibratedValue: { type: Number, default: null },
    uncertaintyValue: { type: Number, default: null },
    standardDeviationValue: { type: Number, default: null },
  },
  externalPressure: {
    value: { type: Number, default: null },
  },
  externalAltitude: {
    value: {
      type: Number,
      default: null,
    },
  },
});

const eventSchema = new Schema(
  {
    day: {
      type: String,
      required: [true, "the day is required"],
    },
    device: {
      type: String,
      trim: true,
      default: null,
    },
    is_device_primary: {
      type: Boolean,
      trim: true,
    },
    device_id: {
      type: ObjectId,
    },
    device_number: {
      type: Number,
      default: null,
    },
    site: {
      type: String,
      default: null,
    },
    site_id: {
      type: ObjectId,
    },
    first: {
      type: Date,
      required: [true, "the first day's event is required"],
    },
    last: {
      type: Date,
      required: [true, "the last day's event is required"],
    },
    nValues: {
      type: Number,
    },
    values: [valueSchema],
  },
  {
    timestamps: true,
  }
);

eventSchema.index(
  {
    "values.time": 1,
    device_id: 1,
    site_id: 1,
    "values.frequency": 1,
    day: 1,
  },
  {
    unique: true,
    partialFilterExpression: { nValues: { $lt: parseInt(constants.N_VALUES) } },
  }
);

eventSchema.index(
  {
    "values.time": 1,
    "values.device": 1,
    "values.device_id": 1,
    "values.site_id": 1,
    day: 1,
    "values.frequency": 1,
  },
  {
    unique: true,
    partialFilterExpression: { nValues: { $lt: parseInt(constants.N_VALUES) } },
  }
);

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

const elementAtIndexName = (metadata, recent) => {
  if (metadata === "site" || metadata === "site_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$siteDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$siteDetails", 0] };
    }
  }

  if (!metadata || metadata === "device" || metadata === "device_id") {
    if (!recent || recent === "yes") {
      return { $first: { $arrayElemAt: ["$deviceDetails", 0] } };
    }
    if (recent === "no") {
      return { $arrayElemAt: ["$deviceDetails", 0] };
    }
  }
};

eventSchema.statics = {
  createEvent(args) {
    return this.create({
      ...args,
    });
  },
  async removeMany({ filter = {} } = {}) {
    try {
      let options = {
        projection: { _id: 0, email: 1, firstName: 1, lastName: 1 },
      };
      let removedEvents = await this.deleteMany(filter, options).exec();
      let data = jsonify(removedEvents);
      if (!isEmpty(data)) {
        return {
          success: true,
          message:
            "successfully cleared the device measurements from the system",
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
        message: "Event model server error - remove",
        error: error.message,
      };
    }
  },
  async list({ skip = 0, limit = 100, filter = {} } = {}) {
    try {
      const { metadata, frequency, external, tenant, device, recent } = filter;
      let search = filter;
      let groupId = "$device";
      let localField = "device";
      let foreignField = "name";
      let from = "devices";
      let _as = "_deviceDetails";
      let as = "deviceDetails";
      let pm2_5 = "$average_pm2_5";
      let pm10 = "$average_pm10";
      let s1_pm2_5 = "$pm2_5";
      let s1_pm10 = "$pm10";
      let elementAtIndex0 = elementAtIndexName(metadata, recent);
      let projection = {
        _id: 0,
      };
      let siteProjection = {};
      let deviceProjection = {};

      delete search["external"];
      delete search["frequency"];
      delete search["metadata"];
      delete search["tenant"];
      delete search["device"];
      delete search["recent"];

      if (tenant !== "airqo") {
        pm2_5 = "$pm2_5";
        pm10 = "$pm10";
      }

      if (!metadata || metadata === "device" || metadata === "device_id") {
        groupId = "$" + metadata ? metadata : groupId;
        localField = metadata ? metadata : localField;
        if (metadata === "device_id") {
          foreignField = "_id";
        }
        if (metadata === "device" || !metadata) {
          foreignField = "name";
        }

        from = "devices";
        _as = "_deviceDetails";
        as = "deviceDetails";
        elementAtIndex0 = elementAtIndexName(metadata, recent);
        deviceProjection = constants.EVENTS_METADATA_PROJECTION("device", as);
        Object.assign(projection, deviceProjection);
      }

      if (metadata === "site_id" || metadata === "site") {
        groupId = "$" + metadata;
        localField = metadata;
        if (metadata === "site") {
          foreignField = "generated_name";
        }
        if (metadata === "site_id") {
          foreignField = "_id";
        }
        from = "sites";
        _as = "_siteDetails";
        as = "siteDetails";
        elementAtIndex0 = elementAtIndexName(metadata, recent);
        siteProjection = constants.EVENTS_METADATA_PROJECTION("site", as);
        Object.assign(projection, siteProjection);
      }

      if (external === "yes") {
        projection["s2_pm10"] = 0;
        projection["s1_pm10"] = 0;
        projection["s2_pm2_5"] = 0;
        projection["s1_pm2_5"] = 0;
        projection[as] = 0;
      }
      logObject("the query for this request", search);
      if (!recent || recent === "yes") {
        let data = await this.aggregate()
          .unwind("values")
          .match(search)
          .replaceRoot("values")
          .lookup({
            from,
            localField,
            foreignField,
            as,
          })
          .sort({ time: -1 })
          .group({
            _id: "$device",
            device: { $first: "$device" },
            device_id: { $first: "$device_id" },
            device_number: { $first: "$device_number" },
            site: { $first: "$site" },
            site_id: { $first: "$site_id" },
            time: { $first: "$time" },
            average_pm2_5: { $first: "$average_pm2_5" },
            pm2_5: { $first: pm2_5 },
            s1_pm2_5: { $first: s1_pm2_5 },
            s2_pm2_5: { $first: "$s2_pm2_5" },
            average_pm10: { $first: "$average_pm10" },
            pm10: { $first: pm10 },
            s1_pm10: { $first: s1_pm10 },
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
            [as]: elementAtIndex0,
          })
          .project(projection)
          .facet({
            total: [{ $count: "device" }],
            data: [{ $addFields: { device: "$device" } }],
          })
          .project({
            meta: {
              total: { $arrayElemAt: ["$total.device", 0] },
              limit: { $literal: limit },
              page: { $literal: skip / limit + 1 },
              pages: {
                $ceil: {
                  $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
                },
              },
            },
            data: {
              $slice: [
                "$data",
                skip,
                {
                  $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
                },
              ],
            },
          })
          .allowDiskUse(true);
        return {
          success: true,
          data,
          status: httpStatus.OK,
        };
      }

      if (recent === "no") {
        let data = await this.aggregate()
          .unwind("values")
          .match(search)
          .replaceRoot("values")
          .lookup({
            from,
            localField,
            foreignField,
            as,
          })
          .sort({ time: -1 })
          .project({
            _device: "$device",
            _time: "$time",
            _average_pm2_5: "$average_pm2_5",
            _pm2_5: pm2_5,
            _s1_pm2_5: s1_pm2_5,
            _s2_pm2_5: "$s2_pm2_5",
            _average_pm10: "$average_pm10",
            _pm10: pm10,
            _s1_pm10: s1_pm10,
            _s2_pm10: "$s2_pm10",
            _frequency: "$frequency",
            _battery: "$battery",
            _location: "$location",
            _altitude: "$altitude",
            _speed: "$speed",
            _satellites: "$satellites",
            _hdop: "$hdop",
            _site_id: "$site_id",
            _device_id: "$device_id",
            _site: "$site",
            _device_number: "$device_number",
            _internalTemperature: "$internalTemperature",
            _externalTemperature: "$externalTemperature",
            _internalHumidity: "$internalHumidity",
            _externalHumidity: "$externalHumidity",
            _externalAltitude: "$externalAltitude",
            _pm1: "$pm1",
            _no2: "$no2",
            [_as]: elementAtIndex0,
          })
          .project({
            device: "$_device",
            device_id: "$_device_id",
            device_number: "$_device_number",
            site: "$_site",
            site_id: "$_site_id",
            time: "$_time",
            average_pm2_5: "$_average_pm2_5",
            pm2_5: "$_pm2_5",
            s1_pm2_5: "$_s1_pm2_5",
            s2_pm2_5: "$_s2_pm2_5",
            average_pm10: "$_average_pm10",
            pm10: "$_pm10",
            s1_pm10: "$_s1_pm10",
            s2_pm10: "$_s2_pm10",
            frequency: "$_frequency",
            battery: "$_battery",
            location: "$_location",
            altitude: "$_altitude",
            speed: "$_speed",
            satellites: "$_satellites",
            hdop: "$_hdop",
            internalTemperature: "$_internalTemperature",
            externalTemperature: "$_externalTemperature",
            internalHumidity: "$_internalHumidity",
            externalHumidity: "$_externalHumidity",
            externalAltitude: "$_externalAltitude",
            pm1: "$_pm1",
            no2: "$_no2",
            [as]: "$" + _as,
          })
          .project(projection)
          .facet({
            total: [{ $count: "device" }],
            data: [
              {
                $addFields: { device: "$device" },
              },
            ],
          })
          .project({
            meta: {
              total: { $arrayElemAt: ["$total.device", 0] },
              limit: { $literal: limit },
              page: { $literal: skip / limit + 1 },
              pages: {
                $ceil: {
                  $divide: [{ $arrayElemAt: ["$total.device", 0] }, limit],
                },
              },
            },
            data: {
              $slice: [
                "$data",
                skip,
                {
                  $ifNull: [limit, { $arrayElemAt: ["$total.device", 0] }],
                },
              ],
            },
          })
          .allowDiskUse(true);
        return {
          success: true,
          data,
          status: httpStatus.OK,
        };
      }
    } catch (error) {
      logger.error(`list events -- ${error.message}`);
      return {
        success: false,
        message: "Internal Server Error",
        errors: { message: error.message },
        status: httpStatus.INTERNAL_SERVER_ERROR,
      };
    }
  },
  async view({ skipInt = 0, limitInt = 100, filter = {} } = {}) {
    try {
      logObject("the filter", filter);
      let { device, site, site_id, device_id, frequency } = filter;
      logElement("filter.frequency", filter.frequency);
      let groupOperator = "$avg";
      let search = filter;
      let groupId = {};
      let average = frequency;
      let localField = "device_id";
      let foreignField = "_id";
      let from = "devices";
      let as = "deviceDetails";
      let elementAtIndex0 = { $first: { $arrayElemAt: ["$deviceDetails", 0] } };

      if (device) {
        localField = "device";
        foreignField = "name";
        from = "devices";
        as = "deviceDetails";
        elementAtIndex0 = { $first: { $arrayElemAt: ["$deviceDetails", 0] } };
      }

      if (device_id) {
        localField = "device_id";
        foreignField = "_id";
        from = "devices";
        as = "deviceDetails";
        elementAtIndex0 = { $first: { $arrayElemAt: ["$deviceDetails", 0] } };
      }

      if (site) {
        localField = "site";
        foreignField = "name";
        from = "sites";
        as = "siteDetails";
        elementAtIndex0 = { $first: { $arrayElemAt: ["$siteDetails", 0] } };
      }

      if (site_id) {
        localField = "site_id";
        foreignField = "_id";
        from = "sites";
        as = "siteDetails";
        elementAtIndex0 = { $first: { $arrayElemAt: ["$siteDetails", 0] } };
      }

      if (frequency === "hourly") {
        groupId = {
          $dateToString: { format: "%Y-%m-%dT%H:00:00.%LZ", date: "$time" },
        };
        average = "hourly";
        delete search["frequency"];
      }

      if (frequency === "daily") {
        groupId = { $dateToString: { format: "%Y-%m-%d", date: "$time" } };
        average = "daily";
        delete search["frequency"];
      }

      if (frequency === "raw") {
        groupId = {
          $dateToString: { format: "%Y-%m-%dT%H:%M:%S.%LZ", date: "$time" },
        };
        groupOperator = "$first";
        average = "average";
        delete search["frequency"];
      }

      if (isEmpty(frequency)) {
        groupId = {
          $dateToString: { format: "%Y-%m-%dT%H:%M:%S.%LZ", date: "$time" },
        };
        groupOperator = "$first";
        delete search["frequency"];
      }

      logElement("the groupId to be used", groupId);
      logElement("the [groupOperator] to be used", [groupOperator]);
      logElement("the -as- to be used", as);
      logElement("the -from- to be used", from);
      logElement("the -localField- to be used", localField);
      logElement("the -foreignField- to be used", foreignField);
      logObject("the justing", { [groupOperator]: "$pm2_5.value" });
      let result = await this.aggregate()
        .unwind("values")
        .match(search)
        .replaceRoot("values")
        .lookup({
          from,
          localField,
          foreignField,
          as,
        })
        .sort({ time: -1 })
        .group({
          _id: groupId,
          time: { $first: groupId },
          device_id: { $first: "$device_id" },
          site_id: { $first: "$site_id" },
          site: { $first: "$site" },
          device: { $first: "$device" },
          is_test_data: { $first: "$is_test_data" },
          "pm2_5-value": { [groupOperator]: "$pm2_5.value" },
          "pm2_5-calibrationValue": {
            [groupOperator]: "$pm2_5.calibrationValue",
          },
          "pm2_5-standardDeviationValue": {
            [groupOperator]: "$pm2_5.standardDeviationValue",
          },

          "pm10-value": { [groupOperator]: "$pm10.value" },
          "pm10-calibrationValue": {
            [groupOperator]: "$pm10.calibrationValue",
          },
          "pm10-standardDeviationValue": {
            [groupOperator]: "$pm10.standardDeviationValue",
          },

          location: { $first: "$location" },
          is_test_data: { $first: "$is_test_data" },
          "s2_pm10-value": { [groupOperator]: "$s2_pm10.value" },
          "s2_pm10-calibrationValue": {
            [groupOperator]: "$s2_pm10.calibrationValue",
          },
          "s2_pm10-standardDeviationValue": {
            [groupOperator]: "$s2_pm10.standardDeviationValue",
          },

          "battery-value": { [groupOperator]: "$battery.value" },
          "altitude-value": { [groupOperator]: "$altitude.value" },
          "speed-value": { [groupOperator]: "$speed.value" },
          "satellites-value": { [groupOperator]: "$satellites.value" },
          "hdop-value": { [groupOperator]: "$hdop.value" },
          "internalTemperature-value": {
            [groupOperator]: "$internalTemperature.value",
          },
          "externalTemperature-value": {
            [groupOperator]: "$externalTemperature.value",
          },
          "internalHumidity-value": {
            [groupOperator]: "$internalHumidity.value",
          },
          "externalHumidity-value": {
            [groupOperator]: "$externalHumidity.value",
          },
          "externalAltitude-value": {
            [groupOperator]: "$externalAltitude.value",
          },

          "pm1-value": { [groupOperator]: "$pm1.value" },
          "pm1-calibrationValue": { [groupOperator]: "$pm1.calibrationValue" },
          "pm1-standardDeviationValue": {
            [groupOperator]: "$pm1.standardDeviationValue",
          },

          "no2-value": { [groupOperator]: "$no2.value" },
          "no2-calibrationValue": { [groupOperator]: "$no2.calibrationValue" },
          "no2-standardDeviationValue": {
            [groupOperator]: "$no2.standardDeviationValue",
          },
          [as]: elementAtIndex0,
        })
        .project({
          _id: 0,
        })
        .skip(skipInt)
        .limit(limitInt)
        .allowDiskUse(true);
      if (!isEmpty(result)) {
        return {
          success: true,
          message: "successfully fetched the measurements",
          data: result,
        };
      } else {
        return {
          success: true,
          message: "no measurements exist for this search",
          data: result,
        };
      }
    } catch (error) {
      return {
        success: false,
        message: "model server error",
        error: error.message,
      };
    }
  },
};

const eventsModel = (tenant) => {
  return getModelByTenant(tenant.toLowerCase(), "event", eventSchema);
};

module.exports = eventsModel;
