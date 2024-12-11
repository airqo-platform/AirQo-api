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
    },
    voltage: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

deviceBatterySchema.statics = {
  async getDeviceBattery(tenant, { device, startDateTime, endDateTime }) {
    try {
      const bigqueryClient = new BigQuery.BigQuery();

      const cols = [
        "timestamp",
        "device_id as device_name",
        "battery as voltage",
      ];

      const dataTable = `\`${constants.BIGQUERY_RAW_DATA}\``;

      const query = `
                SELECT DISTINCT ${cols.join(", ")}
                FROM ${dataTable}
                WHERE ${dataTable}.timestamp >= '${startDateTime}'
                AND ${dataTable}.timestamp <= '${endDateTime}'
                AND ${dataTable}.device_id = '${device}'
                AND ${dataTable}.battery IS NOT NULL
            `;

      const [rows] = await bigqueryClient.query(query);

      return {
        success: true,
        message: "Successfully retrieved device battery data",
        data: rows,
        status: httpStatus.OK,
      };
    } catch (error) {
      logger.error("Error retrieving device battery:", error);
      throw new HttpError(
        "Internal Server Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  formatDeviceBattery(data, options = {}) {
    try {
      const { rounding = null, minutesAverage = null } = options;

      if (!data || data.length === 0) {
        return [];
      }

      // Convert to DataFrame-like processing
      let processedData = [...data];

      if (minutesAverage) {
        // Implement resampling logic
        processedData = this._resampleData(processedData, minutesAverage);
      }

      if (rounding !== null) {
        processedData = processedData.map((item) => ({
          ...item,
          voltage: Number(item.voltage.toFixed(rounding)),
        }));
      }

      // Sort by timestamp
      processedData.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
      );

      return processedData;
    } catch (error) {
      logger.error("Error formatting device battery data:", error);
      throw new HttpError(
        "Data Processing Error",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  _resampleData(data, minutesAverage) {
    // Basic implementation of resampling
    // This is a simplified version and might need more sophisticated logic
    const groupedByDevice = {};

    // Group data by device
    data.forEach((item) => {
      if (!groupedByDevice[item.device_name]) {
        groupedByDevice[item.device_name] = [];
      }
      groupedByDevice[item.device_name].push(item);
    });

    const resampledData = [];

    // Process each device group
    Object.entries(groupedByDevice).forEach(([deviceName, deviceData]) => {
      // Sort data by timestamp
      deviceData.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      for (let i = 0; i < deviceData.length; i += minutesAverage) {
        const chunk = deviceData.slice(i, i + minutesAverage);

        // Calculate average voltage for the chunk
        const avgVoltage =
          chunk.reduce((sum, item) => sum + item.voltage, 0) / chunk.length;

        // Use the timestamp of the first item in the chunk
        resampledData.push({
          device_name: deviceName,
          timestamp: chunk[0].timestamp,
          voltage: avgVoltage,
        });
      }
    });

    return resampledData;
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
