const _ = require("lodash");
const httpStatus = require("http-status");
const { v4: uuidv4 } = require("uuid");
const isEmpty = require("is-empty");
const { HttpError } = require("@utils/errors");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- collocation-util`);
const { BigQuery } = require("@google-cloud/bigquery");
const CollocationBatchModel = require("@models/CollocationBatch");
const moment = require("moment");
const CollocationTypes = require("./collocation-types");
function validateBatchData(batch) {
  const errors = {};

  if (
    batch.data_completeness_threshold < 1 ||
    batch.data_completeness_threshold > 100
  ) {
    errors.dataCompletenessThreshold = "Must be between 1 and 100";
  }

  if (
    batch.intra_correlation_threshold < 0 ||
    batch.intra_correlation_threshold > 1
  ) {
    errors.intraCorrelationThreshold = "Must be between 0 and 1";
  }

  if (
    batch.inter_correlation_threshold < 0 ||
    batch.inter_correlation_threshold > 1
  ) {
    errors.interCorrelationThreshold = "Must be between 0 and 1";
  }

  if (batch.differences_threshold < 0 || batch.differences_threshold > 5) {
    errors.differencesThreshold = "Must be between 0 and 5";
  }

  return Object.keys(errors).length > 0 ? errors : null;
}
function processHourlyData(rows) {
  // Group data by device
  const deviceData = {};
  rows.forEach((row) => {
    if (!deviceData[row.device_name]) {
      deviceData[row.device_name] = [];
    }
    deviceData[row.device_name].push({
      ...row,
      pm2_5: (parseFloat(row.s1_pm2_5) + parseFloat(row.s2_pm2_5)) / 2,
      pm10: (parseFloat(row.s1_pm10) + parseFloat(row.s2_pm10)) / 2,
      timestamp: moment(row.timestamp).format(),
    });
  });

  // Convert to hourly data
  const hourlyRows = [];
  const timestamps = new Set(
    rows.map((row) =>
      moment(row.timestamp)
        .startOf("hour")
        .format()
    )
  );
  const devices = Object.keys(deviceData);

  timestamps.forEach((timestamp) => {
    const hourlyRow = { timestamp };

    devices.forEach((device) => {
      const deviceHourData = deviceData[device].filter(
        (row) =>
          moment(row.timestamp)
            .startOf("hour")
            .format() === timestamp
      );

      if (deviceHourData.length > 0) {
        // Calculate hourly averages
        const averages = {};
        const numericColumns = [
          "pm2_5",
          "pm10",
          "internal_temperature",
          "external_temperature",
          "internal_humidity",
          "external_humidity",
          "battery_voltage",
        ];

        numericColumns.forEach((col) => {
          const values = deviceHourData
            .map((row) => parseFloat(row[col]))
            .filter((val) => !isNaN(val));
          averages[col] =
            values.length > 0
              ? values.reduce((a, b) => a + b) / values.length
              : null;
        });

        hourlyRow[device] = averages;
      } else {
        hourlyRow[device] = null;
      }
    });

    hourlyRows.push(hourlyRow);
  });

  return hourlyRows;
}
function transformBatchToApiOutput(batch) {
  return {
    batch_id: batch.batch_id,
    batch_name: batch.batch_name,
    devices: batch.devices,
    base_device: batch.base_device,
    start_date: batch.start_date,
    end_date: batch.end_date,
    status: batch.status,
    created_by: batch.created_by,
    results: batch.results,
    // Add any other fields needed for API output
  };
}

const CollocationUtil = {
  populateMissingColumns: (data, cols) => {
    const updatedData = { ...data };
    cols.forEach((col) => {
      if (!Object.keys(updatedData).includes(col)) {
        console.log(`${col} missing in dataset`);
        updatedData[col] = null;
      }
    });
    return updatedData;
  },
  datesArray: (startDateTime, endDateTime) => {
    const dates = [];
    let varyingDate = moment(startDateTime).format("YYYY-MM-DDTHH:00:00.000Z");

    while (moment(varyingDate).isBefore(endDateTime)) {
      dates.push(moment(varyingDate).toDate());
      varyingDate = moment(varyingDate)
        .add(1, "hours")
        .format("YYYY-MM-DDTHH:00:00.000Z");
    }

    return [...new Set(dates)];
  },
  devicePairs: (devices) => {
    const uniqueDevices = [...new Set(devices)];
    const pairs = [];

    for (let deviceX of uniqueDevices) {
      for (let deviceY of uniqueDevices) {
        if (
          deviceX === deviceY ||
          pairs.some((pair) => _.isEqual(pair, [deviceY, deviceX]))
        ) {
          continue;
        }
        pairs.push([deviceX, deviceY]);
      }
    }

    return pairs;
  },
  computeDifferences: (
    statistics,
    parameter,
    threshold,
    baseDevice,
    devices
  ) => {
    if (devices.length < 2) {
      return new CollocationTypes.BaseResult({
        results: [],
        passedDevices: devices,
        failedDevices: [],
        errors: [],
        errorDevices: [],
      });
    }

    const statisticsList = _.cloneDeep(statistics);
    const differences = [];
    const data = {};

    statisticsList.forEach((deviceStatistics) => {
      const device = deviceStatistics.device_name;
      delete deviceStatistics.device_name;
      data[device] = deviceStatistics;
    });

    const pairs = CollocationUtil.devicePairs(Object.keys(data));
    const passedDevices = [];
    const failedDevices = [];

    pairs.forEach((devicePair) => {
      const [deviceX, deviceY] = devicePair;
      const deviceXData = data[deviceX];
      const deviceYData = data[deviceY];

      const differencesData = Object.keys(deviceXData).reduce((acc, key) => {
        acc[key] = Math.abs(deviceXData[key] - (deviceYData[key] || 0));
        return acc;
      }, {});

      const passed = differencesData[`${parameter}_mean`] <= threshold;

      differences.push({
        devices: devicePair,
        passed,
        differences: differencesData,
      });

      if (passed) {
        passedDevices.push(deviceX, deviceY);
      } else {
        failedDevices.push(deviceX, deviceY);
      }
    });

    const uniquePassedDevices = [...new Set(passedDevices)];
    const uniqueFailedDevices = [...new Set(failedDevices)].filter(
      (device) => !uniquePassedDevices.includes(device)
    );

    const errorDevices = devices.filter(
      (device) =>
        !uniquePassedDevices.includes(device) &&
        !uniqueFailedDevices.includes(device)
    );

    const errors = [];
    if (errorDevices.length) {
      errors.push(
        `Failed to compute differences for devices ${errorDevices.join(", ")}`
      );
    }

    if (uniqueFailedDevices.length) {
      errors.push(`${uniqueFailedDevices.join(", ")} failed differences.`);
    }

    return new CollocationTypes.BaseResult({
      passedDevices: uniquePassedDevices,
      failedDevices: uniqueFailedDevices,
      errors,
      results: differences,
      errorDevices,
    });
  },
  computeDevicesInterSensorCorrelation: (
    data,
    deviceX,
    deviceY,
    correlationCols,
    threshold,
    r2Threshold,
    parameter
  ) => {
    const deviceXData = data.get(deviceX, []);
    const deviceYData = data.get(deviceY, []);

    // Implement correlation computation logic similar to Python
    // This would require more complex data processing logic
    // You'll need to translate the pandas operations to lodash or custom functions
    const devicePairCorrelation = {};

    // Placeholder for actual correlation computation
    for (let col of correlationCols) {
      if (col === "timestamp") continue;

      // Compute correlation using custom methods or libraries
      // This is a simplified placeholder
      devicePairCorrelation[`${col}_pearson`] = 0.5;
      devicePairCorrelation[`${col}_r2_pearson`] = 0.25;
    }

    const parameterValue = devicePairCorrelation[`${parameter}_pearson`];
    const parameterR2Value = devicePairCorrelation[`${parameter}_r2_pearson`];

    let passed = parameterValue !== undefined && parameterValue >= threshold;
    if (passed) {
      passed =
        parameterR2Value !== undefined && parameterR2Value >= r2Threshold;
    }

    devicePairCorrelation.passed = passed;
    devicePairCorrelation.devices = [deviceX, deviceY];

    return devicePairCorrelation;
  },
  computeInterSensorCorrelation: (
    devices,
    data,
    threshold,
    r2Threshold,
    parameter,
    baseDevice,
    otherParameters
  ) => {
    if (devices.length < 2) {
      return new CollocationTypes.BaseResult({
        results: [],
        passedDevices: devices,
        failedDevices: [],
        errors: [],
        errorDevices: [],
      });
    }

    const passedDevices = [];
    const failedDevices = [];
    const results = [];

    const correlationCols = ["timestamp", parameter, ...otherParameters];
    const uniqueCorrelationCols = [...new Set(correlationCols)];

    if (baseDevice && baseDevice !== "") {
      Object.keys(data).forEach((device) => {
        if (device === baseDevice) return;

        const devicePairCorrelation = CollocationUtil.computeDevicesInterSensorCorrelation(
          data,
          baseDevice,
          device,
          uniqueCorrelationCols,
          threshold,
          r2Threshold,
          parameter
        );

        results.push(devicePairCorrelation);

        if (devicePairCorrelation.passed) {
          passedDevices.push(device);
        } else {
          failedDevices.push(device);
        }
      });
    } else {
      const passedPairs = [];
      const pairs = CollocationUtil.devicePairs(devices);

      pairs.forEach((devicePair) => {
        const [deviceX, deviceY] = devicePair;

        const devicePairCorrelation = CollocationUtil.computeDevicesInterSensorCorrelation(
          data,
          deviceX,
          deviceY,
          uniqueCorrelationCols,
          threshold,
          r2Threshold,
          parameter
        );

        results.push(devicePairCorrelation);

        if (devicePairCorrelation.passed) {
          passedPairs.push(devicePair);
        } else {
          failedDevices.push(deviceX, deviceY);
        }
      });

      // Additional logic for handling passed pairs similar to Python implementation
    }

    const uniquePassedDevices = [...new Set(passedDevices)];
    const uniqueFailedDevices = [...new Set(failedDevices)].filter(
      (device) => !uniquePassedDevices.includes(device)
    );

    const errorDevices = devices.filter(
      (device) =>
        !uniquePassedDevices.includes(device) &&
        !uniqueFailedDevices.includes(device)
    );

    const errors = [];
    if (errorDevices.length) {
      errors.push(
        `Failed to compute inter sensor correlation for devices ${errorDevices.join(
          ", "
        )}`
      );
    }

    if (uniqueFailedDevices.length) {
      errors.push(
        `${uniqueFailedDevices.join(", ")} failed inter sensor correlation.`
      );
    }

    return new CollocationTypes.BaseResult({
      results,
      passedDevices: uniquePassedDevices,
      failedDevices: uniqueFailedDevices,
      errors,
      errorDevices,
    });
  },
  computeStatistics: (data) => {
    const statistics = [];

    Object.entries(data).forEach(([device, deviceData]) => {
      const deviceStatistics = {};

      // Assume deviceData is an array of numeric objects
      const numericColumns = Object.keys(deviceData[0]).filter(
        (col) => typeof deviceData[0][col] === "number"
      );

      numericColumns.forEach((col) => {
        const values = deviceData.map((item) => item[col]);

        // Compute basic statistics
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance =
          values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        const std = Math.sqrt(variance);
        const min = Math.min(...values);
        const max = Math.max(...values);

        // Add statistics to device statistics
        deviceStatistics[`${col}_mean`] = mean;
        deviceStatistics[`${col}_std`] = std;
        deviceStatistics[`${col}_min`] = min;
        deviceStatistics[`${col}_max`] = max;

        // Add percentiles (simplified version)
        const sortedValues = [...values].sort((a, b) => a - b);
        deviceStatistics[`${col}_25_percentile`] =
          sortedValues[Math.floor(sortedValues.length * 0.25)];
        deviceStatistics[`${col}_50_percentile`] =
          sortedValues[Math.floor(sortedValues.length * 0.5)];
        deviceStatistics[`${col}_75_percentile`] =
          sortedValues[Math.floor(sortedValues.length * 0.75)];
      });

      statistics.push({
        ...deviceStatistics,
        device_name: device,
      });
    });

    return statistics;
  },
  mapDataToApiFormat: (data) => {
    const apiData = {};
    data.forEach((row) => {
      const deviceData = { ...row };
      const device = deviceData.device_name;
      delete deviceData.device_name;
      apiData[device] = deviceData;
    });
    return apiData;
  },
  exportCollection: async (request, next) => {
    try {
      const { query } = request;
      const { tenant } = query;

      // Get all documents from the collection
      const docs = await CollocationBatchModel(tenant)
        .find({})
        .lean();

      if (!docs) {
        return {
          success: false,
          message: "No collocation data found",
          status: httpStatus.NOT_FOUND,
          errors: { message: "No collocation data found" },
        };
      }

      // Transform documents to match Python output
      const transformedDocs = docs.map((doc) => ({
        ...doc,
        _id: doc._id.toString(), // Convert ObjectId to string
      }));

      // Create temp file
      const tempDir = os.tmpdir();
      const filePath = path.join(tempDir, "collocation_collection.json");

      // Write data to file
      await fs.writeFile(
        filePath,
        JSON.stringify(transformedDocs, null, 2),
        "utf8"
      );

      return {
        success: true,
        message: "Successfully exported collocation data",
        status: httpStatus.OK,
        data: filePath,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getHourlyData: async (request, devices, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // Get batch details from MongoDB
      const batch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!batch) {
        return {
          success: false,
          message: "Collocation batch not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Batch with ID ${batchId} not found` },
        };
      }

      // Filter devices if provided
      const batchDevices =
        devices.length > 0
          ? batch.devices.filter((device) => devices.includes(device))
          : batch.devices;

      if (batchDevices.length === 0) {
        return {
          success: true,
          message: "No matching devices found",
          data: [],
        };
      }

      // Query BigQuery for raw data
      const bigquery = new BigQuery();
      const cols = [
        "timestamp",
        "s1_pm2_5",
        "s2_pm2_5",
        "s1_pm10",
        "s2_pm10",
        "device_temperature as internal_temperature",
        "device_humidity as internal_humidity",
        "temperature as external_temperature",
        "humidity as external_humidity",
        "battery as battery_voltage",
      ];

      const dataQuery = `
        SELECT DISTINCT ${cols.join(", ")}, d.device_id AS device_name
        FROM \`${constants.BIGQUERY_RAW_DATA}\` r
        JOIN \`${constants.BIGQUERY_DEVICES}\` d ON d.device_id = r.device_id
        WHERE r.timestamp >= '${moment(batch.start_date).format()}'
        AND r.timestamp <= '${moment(batch.end_date).format()}'
        AND d.device_id IN (${batchDevices.map((d) => `'${d}'`).join(",")})
      `;

      const [rows] = await bigquery.query({ dataQuery });

      // const hourlyData = processHourlyData(rows);

      // Process data into hourly averages
      const hourlyData = new Map();
      const deviceMap = new Map();

      // Group data by timestamp (hour) and device
      rows.forEach((row) => {
        const timestamp = moment(row.timestamp)
          .startOf("hour")
          .format();
        const deviceName = row.device_name;

        if (!hourlyData.has(timestamp)) {
          hourlyData.set(timestamp, new Map());
        }

        if (!deviceMap.has(deviceName)) {
          deviceMap.set(deviceName, true);
        }

        const timestampData = hourlyData.get(timestamp);
        if (!timestampData.has(deviceName)) {
          timestampData.set(deviceName, []);
        }

        timestampData.get(deviceName).push(row);
      });

      // Calculate hourly averages and format response
      const result = [];
      const numericColumns = [
        "s1_pm2_5",
        "s2_pm2_5",
        "s1_pm10",
        "s2_pm10",
        "internal_temperature",
        "internal_humidity",
        "external_temperature",
        "external_humidity",
        "battery_voltage",
      ];

      hourlyData.forEach((devices, timestamp) => {
        const rowData = { timestamp };

        deviceMap.forEach((_, deviceName) => {
          const deviceRecords = devices.get(deviceName) || [];

          if (deviceRecords.length === 0) {
            rowData[deviceName] = numericColumns.reduce((acc, col) => {
              acc[col] = null;
              return acc;
            }, {});
          } else {
            rowData[deviceName] = numericColumns.reduce((acc, col) => {
              const values = deviceRecords
                .map((record) => record[col])
                .filter((val) => val !== null && val !== undefined);
              acc[col] =
                values.length > 0
                  ? values.reduce((sum, val) => sum + val, 0) / values.length
                  : null;
              return acc;
            }, {});
          }
        });

        result.push(rowData);
      });

      return {
        success: true,
        message: "Successfully retrieved hourly data",
        data: result, // hourlyData
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  saveCollocationBatch: async (request, next) => {
    try {
      const {
        body: jsonData,
        query: { tenant },
        userDetails,
      } = request;

      // Extract and process data with defaults
      const devices = jsonData.devices || [];
      const baseDevice = jsonData.baseDevice || null;
      const startDate = moment(jsonData.startDate).toDate();
      const endDate = moment(jsonData.endDate).toDate();

      const expectedRecordsPerHour =
        jsonData.expectedRecordsPerHour ||
        constants.DEFAULTS_EXPECTED_RECORDS_PER_HOUR;

      const batchName =
        jsonData.batchName ||
        uuidv4()
          .replace(/-/g, "")
          .substr(0, 8)
          .toUpperCase();

      const dataCompletenessThreshold =
        jsonData.dataCompletenessThreshold ||
        constants.DEFAULTS_DATA_COMPLETENESS_THRESHOLD;

      const intraCorrelationThreshold =
        jsonData.intraCorrelationThreshold ||
        constants.DEFAULTS_INTRA_CORRELATION_THRESHOLD;

      const intraCorrelationR2Threshold =
        jsonData.intraCorrelationR2Threshold ||
        constants.DEFAULTS_INTRA_CORRELATION_R2_THRESHOLD;

      const interCorrelationThreshold =
        jsonData.interCorrelationThreshold ||
        constants.DEFAULTS_INTER_CORRELATION_THRESHOLD;

      const interCorrelationR2Threshold =
        jsonData.interCorrelationR2Threshold ||
        constants.DEFAULTS_INTER_CORRELATION_R2_THRESHOLD;

      const differencesThreshold =
        jsonData.differencesThreshold ||
        constants.DEFAULTS_DIFFERENCES_THRESHOLD;

      const interCorrelationParameter =
        jsonData.interCorrelationParameter ||
        constants.DEFAULTS_INTER_CORRELATION_PARAMETER;

      const intraCorrelationParameter =
        jsonData.intraCorrelationParameter ||
        constants.DEFAULTS_INTRA_CORRELATION_PARAMETER;

      const dataCompletenessParameter =
        jsonData.dataCompletenessParameter ||
        constants.DEFAULTS_DATA_COMPLETENESS_PARAMETER;

      const differencesParameter =
        jsonData.differencesParameter ||
        constants.DEFAULTS_DIFFERENCES_PARAMETER;

      const interCorrelationAdditionalParameters =
        jsonData.interCorrelationAdditionalParameters ||
        constants.DEFAULTS_INTER_CORRELATION_ADDITIONAL_PARAMETERS;

      // Create batch object
      const batch = {
        batch_id: "",
        batch_name: batchName,
        devices: Array.from(new Set(devices)),
        base_device: baseDevice,
        start_date: startDate,
        end_date: endDate,
        date_created: new Date(),
        expected_hourly_records: expectedRecordsPerHour,
        inter_correlation_threshold: interCorrelationThreshold,
        intra_correlation_threshold: intraCorrelationThreshold,
        inter_correlation_r2_threshold: interCorrelationR2Threshold,
        intra_correlation_r2_threshold: intraCorrelationR2Threshold,
        data_completeness_threshold: dataCompletenessThreshold,
        differences_threshold: differencesThreshold,
        data_completeness_parameter: dataCompletenessParameter,
        inter_correlation_parameter: interCorrelationParameter,
        intra_correlation_parameter: intraCorrelationParameter,
        differences_parameter: differencesParameter,
        inter_correlation_additional_parameters: interCorrelationAdditionalParameters,
        created_by: userDetails,
        status: COLLOCATION_BATCH_STATUS.SCHEDULED,
        results: null,
        errors: [],
      };

      // Check if batch already exists
      const existingBatch = await CollocationBatchModel(tenant).findOne({
        devices: { $all: devices },
        start_date: startDate,
        end_date: endDate,
      });

      if (!existingBatch) {
        await CollocationBatchModel(tenant).create(batch);
      }

      // Fetch and return the batch
      const savedBatch = await CollocationBatchModel(tenant).findOne({
        devices: { $all: devices },
        start_date: startDate,
        end_date: endDate,
      });

      return {
        success: true,
        message: "Successfully created collocation batch",
        data: savedBatch.toJSON(),
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  deleteBatch: async (request, devices, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // If no devices specified, delete entire batch
      if (isEmpty(devices)) {
        await CollocationBatchModel(tenant).findOneAndDelete({
          batch_id: batchId,
        });
        return {
          deleted: true,
          success: true,
          status: httpStatus.NO_CONTENT,
        };
      }

      // Find the batch
      const batch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!batch) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "Collocation batch not found",
          errors: { message: `No batch found with id ${batchId}` },
        };
      }

      // Calculate remaining devices
      const remainingDevices = batch.devices.filter(
        (device) => !devices.includes(device)
      );

      // If no devices remain, delete the entire batch
      if (isEmpty(remainingDevices)) {
        await CollocationBatchModel(tenant).findOneAndDelete({
          batch_id: batchId,
        });
        return {
          deleted: true,
          success: true,
          status: httpStatus.NO_CONTENT,
        };
      }

      // Update batch with remaining devices and reset results
      const updatedBatch = await CollocationBatchModel(tenant).findOneAndUpdate(
        { batch_id: batchId },
        {
          $set: {
            devices: remainingDevices,
            status: "SCHEDULED", // Reset status
            results: null, // Reset results
          },
        },
        { new: true }
      );

      // Transform the data to match the Python API response format
      const transformedData = {
        batch_id: updatedBatch.batch_id,
        batch_name: updatedBatch.batch_name,
        devices: updatedBatch.devices,
        base_device: updatedBatch.base_device,
        start_date: updatedBatch.start_date,
        end_date: updatedBatch.end_date,
        status: updatedBatch.status,
        results: updatedBatch.results || {},
        created_by: updatedBatch.created_by,
        date_created: updatedBatch.date_created,
      };

      return {
        success: true,
        status: httpStatus.OK,
        message: "Successfully updated collocation batch",
        data: transformedData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getBatchData: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // Find the collocation batch
      const batch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!batch) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "Collocation batch not found",
          errors: { message: `No batch found with id ${batchId}` },
        };
      }

      // Transform the data to match the Python API response format
      const transformedData = {
        batch_id: batch.batch_id,
        batch_name: batch.batch_name,
        devices: batch.devices,
        base_device: batch.base_device,
        start_date: batch.start_date,
        end_date: batch.end_date,
        status: batch.status,
        results: batch.results || {},
        created_by: batch.created_by,
        date_created: batch.date_created,
      };

      return {
        success: true,
        status: httpStatus.OK,
        message: "Successfully retrieved collocation batch data",
        data: transformedData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  resetBatch: async (batchId, updateData, tenant, next) => {
    try {
      // Get the existing batch
      const existingBatch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!existingBatch) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "Collocation batch not found",
          errors: { message: `No batch found with id ${batchId}` },
        };
      }

      // Update batch with new values, maintaining existing ones if not provided
      const updatedBatch = {
        ...existingBatch.toObject(),
        expected_hourly_records:
          updateData.expectedRecordsPerHour ||
          existingBatch.expected_hourly_records,
        data_completeness_threshold:
          updateData.dataCompletenessThreshold ||
          existingBatch.data_completeness_threshold,
        intra_correlation_threshold:
          updateData.intraCorrelationThreshold ||
          existingBatch.intra_correlation_threshold,
        intra_correlation_r2_threshold:
          updateData.intraCorrelationR2Threshold ||
          existingBatch.intra_correlation_r2_threshold,
        inter_correlation_threshold:
          updateData.interCorrelationThreshold ||
          existingBatch.inter_correlation_threshold,
        inter_correlation_r2_threshold:
          updateData.interCorrelationR2Threshold ||
          existingBatch.inter_correlation_r2_threshold,
        differences_threshold:
          updateData.differencesThreshold ||
          existingBatch.differences_threshold,
        inter_correlation_parameter:
          updateData.interCorrelationParameter ||
          existingBatch.inter_correlation_parameter,
        intra_correlation_parameter:
          updateData.intraCorrelationParameter ||
          existingBatch.intra_correlation_parameter,
        data_completeness_parameter:
          updateData.dataCompletenessParameter ||
          existingBatch.data_completeness_parameter,
        differences_parameter:
          updateData.differencesParameter ||
          existingBatch.differences_parameter,
        inter_correlation_additional_parameters: Array.isArray(
          updateData.interCorrelationAdditionalParameters
        )
          ? updateData.interCorrelationAdditionalParameters
          : existingBatch.inter_correlation_additional_parameters,
        // Reset results and status
        results: null,
        status: "SCHEDULED", // Reset to initial status
      };

      // Validate the updated batch
      const validationError = validateBatchData(updatedBatch);
      if (validationError) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "Validation failed",
          errors: validationError,
        };
      }

      // Update the batch in database
      const filter = { _id: ObjectId(existingBatch._id) };
      const update = { $set: updatedBatch };

      const result = await CollocationBatchModel(tenant).findOneAndUpdate(
        filter,
        update,
        { new: true } // Return the updated document
      );

      if (!result) {
        return {
          success: false,
          status: httpStatus.INTERNAL_SERVER_ERROR,
          message: "Failed to update batch",
          errors: { message: "Database update failed" },
        };
      }

      // Transform the result to API format
      const apiOutput = transformBatchToApiOutput(result);

      return {
        success: true,
        status: httpStatus.OK,
        message: "Successfully reset collocation batch",
        data: apiOutput,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getSummary: async (tenant, next) => {
    try {
      // Get all batches sorted by date_created in descending order
      const batches = await CollocationBatchModel(tenant)
        .find()
        .sort({ date_created: -1 });

      if (isEmpty(batches)) {
        return {
          success: true,
          status: httpStatus.OK,
          message: "No collocation batches found",
          data: [],
        };
      }

      const summaryData = [];

      for (const batch of batches) {
        // Format created_by name
        const createdBy = `${batch.created_by?.first_name || ""} ${batch
          .created_by?.last_name || ""}`.trim();

        // Get device status summary for the batch
        const deviceStatusSummary = {};

        // Process each device's status summary from batch results
        if (batch.results) {
          for (const device of batch.devices) {
            const deviceSummary = [];

            // Check data completeness
            if (batch.results.data_completeness?.results) {
              const completeness = batch.results.data_completeness.results.find(
                (r) => r.device_name === device
              );
              if (completeness) {
                deviceSummary.push({
                  type: "DATA_COMPLETENESS",
                  status:
                    completeness.completeness >=
                    batch.data_completeness_threshold
                      ? "PASSED"
                      : "FAILED",
                  value: completeness.completeness,
                  threshold: batch.data_completeness_threshold,
                });
              }
            }

            // Check intra-sensor correlation
            if (batch.results.intra_sensor_correlation?.results) {
              const correlation = batch.results.intra_sensor_correlation.results.find(
                (r) => r.device_name === device
              );
              if (correlation) {
                deviceSummary.push({
                  type: "INTRA_SENSOR_CORRELATION",
                  status:
                    correlation.pm2_5_pearson >=
                    batch.intra_correlation_threshold
                      ? "PASSED"
                      : "FAILED",
                  value: correlation.pm2_5_pearson,
                  threshold: batch.intra_correlation_threshold,
                });
              }
            }

            deviceStatusSummary[device] = deviceSummary;
          }
        }

        // Get batch summary and create summary objects for each device
        const batchStatus = batch.status;
        for (const device of batch.devices) {
          summaryData.push({
            batch_id: batch.batch_id,
            device_name: device,
            added_by: createdBy,
            start_date: batch.start_date,
            end_date: batch.end_date,
            status: batchStatus,
            date_added: batch.date_created,
            batch_name: batch.batch_name,
            status_summary: deviceStatusSummary[device] || [],
          });
        }
      }

      return {
        success: true,
        status: httpStatus.OK,
        message: "Successfully retrieved collocation summary",
        data: summaryData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getIntraSensorCorrelation: async (batchId, devices, tenant, next) => {
    try {
      // Get the collocation batch
      const collocationBatch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!collocationBatch) {
        return {
          success: false,
          status: httpStatus.NOT_FOUND,
          message: "Collocation batch not found",
          errors: { message: `No batch found with id ${batchId}` },
        };
      }

      // Filter devices if provided
      const batchDevices = isEmpty(devices)
        ? collocationBatch.devices
        : collocationBatch.devices.filter((device) => devices.includes(device));

      if (isEmpty(batchDevices)) {
        return {
          success: false,
          status: httpStatus.BAD_REQUEST,
          message: "No valid devices found",
          errors: { message: "No matching devices found in the batch" },
        };
      }

      // Get hourly intra-sensor correlation from results
      let correlationData = [];
      if (
        collocationBatch.results &&
        collocationBatch.results.intra_sensor_correlation
      ) {
        correlationData = collocationBatch.results.intra_sensor_correlation.results
          .filter((result) => batchDevices.includes(result.device_name))
          .map((result) => ({
            device_name: result.device_name,
            pm2_5: {
              pearson_correlation: result.pm2_5_pearson,
              r2: result.pm2_5_r2,
            },
            pm10: {
              pearson_correlation: result.pm10_pearson,
              r2: result.pm10_r2,
            },
            timestamp: collocationBatch.date_created,
          }));
      }

      return {
        success: true,
        status: httpStatus.OK,
        message: "Successfully retrieved intra-sensor correlation data",
        data: correlationData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getStatistics: async (request, devices, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // Get batch details from MongoDB
      const batch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!batch) {
        return {
          success: false,
          message: "Collocation batch not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Batch with ID ${batchId} not found` },
        };
      }

      if (!batch.results || !batch.results.statistics) {
        return {
          success: false,
          message: "No statistics found for this batch",
          status: httpStatus.NOT_FOUND,
          errors: { message: `No statistics found for batch ${batchId}` },
        };
      }

      // Filter devices if provided
      const batchDevices =
        devices.length > 0
          ? batch.devices.filter((device) => devices.includes(device))
          : batch.devices;

      // Filter statistics for requested devices
      const statistics = batch.results.statistics.filter((stat) =>
        batchDevices.includes(stat.device_name)
      );

      // Transform data to API format using the same helper function used for data completeness
      const formattedData = collocationUtil.mapDataToApiFormat(statistics);

      return {
        success: true,
        message: "Successfully retrieved statistics",
        data: formattedData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  mapDataToApiFormat: (data) => {
    // Helper function to transform array of results into object keyed by device_name
    return data.reduce((acc, item) => {
      acc[item.device_name] = {
        expected_number_of_records: item.expected_number_of_records,
        start_date: item.start_date,
        end_date: item.end_date,
        actual_number_of_records: item.actual_number_of_records,
        completeness: item.completeness,
        missing: item.missing,
        errors: item.errors,
      };
      return acc;
    }, {});
  },
  getDataCompleteness: async (request, devices, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // Get batch details from MongoDB
      const batch = await CollocationBatchModel(tenant).findOne({
        batch_id: batchId,
      });

      if (!batch) {
        return {
          success: false,
          message: "Collocation batch not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Batch with ID ${batchId} not found` },
        };
      }

      if (
        !batch.results ||
        !batch.results.data_completeness ||
        !batch.results.data_completeness.results
      ) {
        return {
          success: false,
          message: "No data completeness results found for this batch",
          status: httpStatus.NOT_FOUND,
          errors: {
            message: `No data completeness results found for batch ${batchId}`,
          },
        };
      }

      // Filter devices if provided
      const batchDevices =
        devices.length > 0
          ? batch.devices.filter((device) => devices.includes(device))
          : batch.devices;

      // Filter data completeness results for requested devices
      const dataCompleteness = batch.results.data_completeness.results
        .filter((result) => batchDevices.includes(result.device_name))
        .map((result) => ({
          expected_number_of_records: result.expected,
          start_date: batch.start_date,
          end_date: batch.end_date,
          actual_number_of_records: result.actual,
          device_name: result.device_name,
          completeness: result.completeness,
          missing: result.missing,
          errors: batch.errors || [],
        }));

      // Transform data to API format
      const formattedData = collocationUtil.mapDataToApiFormat(
        dataCompleteness
      );

      return {
        success: true,
        message: "Successfully retrieved data completeness",
        data: formattedData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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
  getBatchResults: async (request, next) => {
    try {
      const { query } = request;
      const { tenant, batchId } = query;

      // Get batch details from MongoDB including results
      const batch = await CollocationBatchModel(tenant).findOne(
        { batch_id: batchId },
        { results: 1 } // Projection to only get results field
      );

      if (!batch) {
        return {
          success: false,
          message: "Collocation batch not found",
          status: httpStatus.NOT_FOUND,
          errors: { message: `Batch with ID ${batchId} not found` },
        };
      }

      if (!batch.results) {
        return {
          success: false,
          message: "No results found for this batch",
          status: httpStatus.NOT_FOUND,
          errors: { message: `No results found for batch ${batchId}` },
        };
      }

      return {
        success: true,
        message: "Successfully retrieved batch results",
        data: batch.results,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
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

module.exports = CollocationUtil;
