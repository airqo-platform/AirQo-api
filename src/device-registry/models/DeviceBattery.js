const mongoose = require("mongoose");
const { Schema } = mongoose;
const httpStatus = require("http-status");
const { HttpError } = require("@utils/errors");
const isEmpty = require("is-empty");
const constants = require("@config/constants");
const { getModelByTenant } = require("@config/database");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- device_battery model`
);
const BigQuery = require("@google-cloud/bigquery");
const moment = require("moment-timezone");

const deviceBatterySchema = new Schema(
  {
    timestamp: {
      type: Date,
      required: true,
      index: true,
    },
    device_name: {
      type: String,
      required: true,
      index: true,
    },
    voltage: {
      type: Number,
      required: true,
    },
    channel_id: {
      type: String,
      index: true,
    },
    battery_status: {
      type: String,
      enum: ["low", "normal", "critical"],
      default: "normal",
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Add indexes for common queries
deviceBatterySchema.index({ timestamp: 1, device_name: 1 });
deviceBatterySchema.index({ created_at: -1 });

// Add virtual for battery percentage
deviceBatterySchema.virtual("batteryPercentage").get(function() {
  const MAX_VOLTAGE = 4.2; // Maximum battery voltage
  const MIN_VOLTAGE = 3.3; // Minimum battery voltage
  const percentage =
    ((this.voltage - MIN_VOLTAGE) / (MAX_VOLTAGE - MIN_VOLTAGE)) * 100;
  return Math.max(0, Math.min(100, Math.round(percentage)));
});

deviceBatterySchema.statics = {
  async getDeviceBattery(
    tenant,
    { device, startDateTime, endDateTime, limit = null }
  ) {
    try {
      const bigqueryClient = new BigQuery.BigQuery();

      const cols = [
        "timestamp",
        "device_id as device_name",
        "battery as voltage",
        "channel_id",
      ];

      const dataTable = `\`${constants.BIGQUERY_RAW_DATA}\``;

      let query = `
        SELECT DISTINCT ${cols.join(", ")}
        FROM ${dataTable}
        WHERE ${dataTable}.timestamp >= '${startDateTime}'
        AND ${dataTable}.timestamp <= '${endDateTime}'
        AND ${dataTable}.device_id = '${device}'
        AND ${dataTable}.battery IS NOT NULL
        ORDER BY timestamp DESC
      `;

      if (limit) {
        query += ` LIMIT ${parseInt(limit)}`;
      }

      const [rows] = await bigqueryClient.query(query);

      // Add battery status based on voltage levels
      const enrichedData = rows.map((row) => ({
        ...row,
        battery_status: this._calculateBatteryStatus(row.voltage),
      }));

      return {
        success: true,
        message: "Successfully retrieved device battery data",
        data: enrichedData,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving device battery:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },

  formatDeviceBattery(data, options = {}) {
    try {
      const {
        rounding = null,
        minutesAverage = null,
        timezone = "Africa/Kampala",
      } = options;

      if (!data || data.length === 0) {
        return [];
      }

      let processedData = [...data];

      if (minutesAverage) {
        processedData = this._resampleData(processedData, minutesAverage);
      }

      processedData = processedData.map((item) => {
        const formattedItem = { ...item };

        if (rounding !== null) {
          formattedItem.voltage = Number(item.voltage.toFixed(rounding));
        }

        // Format timestamp to specified timezone
        formattedItem.timestamp = moment(item.timestamp)
          .tz(timezone)
          .format("YYYY-MM-DDTHH:mm:ssZ");

        return formattedItem;
      });

      // Sort by timestamp descending
      processedData.sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      );

      return processedData;
    } catch (error) {
      logger.error("Error formatting device battery data:", error);
      throw new HttpError(
        "Data Processing Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },

  _resampleData(data, minutesAverage) {
    try {
      const groupedByDevice = {};
      const timeWindows = new Map();

      // Group data by device and create time windows
      data.forEach((item) => {
        const deviceName = item.device_name;
        const timestamp = moment(item.timestamp);
        const windowKey = timestamp.startOf("minute").format();

        if (!groupedByDevice[deviceName]) {
          groupedByDevice[deviceName] = new Map();
        }

        if (!groupedByDevice[deviceName].has(windowKey)) {
          groupedByDevice[deviceName].set(windowKey, []);
        }

        groupedByDevice[deviceName].get(windowKey).push(item);
      });

      const resampledData = [];

      // Process each device's time windows
      Object.entries(groupedByDevice).forEach(([deviceName, timeWindows]) => {
        const sortedWindows = new Map([...timeWindows.entries()].sort());

        for (const [windowKey, readings] of sortedWindows) {
          const avgVoltage =
            readings.reduce((sum, item) => sum + item.voltage, 0) /
            readings.length;
          const avgReading = {
            device_name: deviceName,
            timestamp: windowKey,
            voltage: avgVoltage,
            battery_status: this._calculateBatteryStatus(avgVoltage),
            channel_id: readings[0].channel_id,
          };

          resampledData.push(avgReading);
        }
      });

      return resampledData;
    } catch (error) {
      logger.error("Error in _resampleData:", error);
      throw new HttpError(
        "Resampling Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },

  _calculateBatteryStatus(voltage) {
    if (voltage <= 3.4) return "critical";
    if (voltage <= 3.6) return "low";
    return "normal";
  },

  async getBatteryStats(tenant, { device, startDateTime, endDateTime }) {
    try {
      const data = await this.getDeviceBattery(tenant, {
        device,
        startDateTime,
        endDateTime,
      });
      const voltages = data.data.map((reading) => reading.voltage);

      return {
        success: true,
        message: "Successfully calculated battery statistics",
        data: {
          average_voltage: this._calculateAverage(voltages),
          min_voltage: Math.min(...voltages),
          max_voltage: Math.max(...voltages),
          latest_reading: data.data[0],
          readings_count: voltages.length,
        },
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error calculating battery statistics:", error);
      throw new HttpError(
        "Statistics Calculation Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        {
          message: error.message,
        }
      );
    }
  },

  _calculateAverage(numbers) {
    return numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  },
};

const DeviceBatteryModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;

  try {
    return mongoose.model("device_battery");
  } catch (error) {
    return getModelByTenant(
      dbTenant.toLowerCase(),
      "device_battery",
      deviceBatterySchema
    );
  }
};

module.exports = DeviceBatteryModel;
