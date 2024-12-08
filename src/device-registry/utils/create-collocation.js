const moment = require("moment");
const _ = require("lodash");

const CollocationTypes = require("./collocation-types");

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
};

module.exports = CollocationUtil;
