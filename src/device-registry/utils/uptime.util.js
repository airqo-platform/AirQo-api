const DeviceStatusModel = require("@models/DeviceStatus");
const NetworkUptimeModel = require("@models/NetworkUptime");
const DeviceUptimeModel = require("@models/DeviceUptime");
const DeviceBatteryModel = require("@models/DeviceBattery");
const { generateFilter } = require("@utils/common");
const constants = require("@config/constants");
const { BigQuery } = require("@google-cloud/bigquery");
const log4js = require("log4js");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- uptime-util`);
const { logObject, HttpError } = require("@utils/shared");
const httpStatus = require("http-status");

const createUptime = {
  bigQueryClient: new BigQuery(),

  computeUptime(row, threshold = 30) {
    const hourlyThreshold = threshold || row.hourly_threshold;
    const uptime = (row.data_points / hourlyThreshold) * 100;
    return Math.min(uptime, 100);
  },

  getUptime: async (params) => {
    const {
      devices = [],
      startDateTime,
      endDateTime,
      site = "",
      airqloud = "",
      grid = "",
      cohort = "",
      threshold,
    } = params;

    try {
      const dataTable = constants.BIGQUERY_DEVICE_UPTIME_TABLE;
      const sitesTable = constants.BIGQUERY_SITES;
      const airqloudsSitesTable = constants.BIGQUERY_AIRQLOUDS_SITES;
      const airqloudsTable = constants.BIGQUERY_AIRQLOUDS;
      const gridsSitesTable = constants.BIGQUERY_GRIDS_SITES;
      const gridsTable = constants.BIGQUERY_GRIDS;
      const cohortsDevicesTable = constants.BIGQUERY_COHORTS_DEVICES;
      const cohortsTable = constants.BIGQUERY_COHORTS;

      let query = `
        SELECT 
          timestamp,
          hourly_threshold,
          data_points,
          uptime,
          downtime,
          average_battery,
          device
      `;

      let metaDataQuery = "";

      // Dynamically construct query based on input parameters
      if (devices.length > 0) {
        query += `
          FROM \`${dataTable}\`
          WHERE device IN UNNEST(@devices)
        `;
      } else if (site) {
        query += `
          , ${sitesTable}.name as site_name, 
          ${dataTable}.site_id
          FROM \`${dataTable}\`
          RIGHT JOIN \`${sitesTable}\` ON \`${sitesTable}\`.id = \`${dataTable}\`.site_id
          WHERE \`${dataTable}\`.site_id = @site
        `;
      } else if (airqloud) {
        // Nested subqueries for airqloud
        metaDataQuery = `
          SELECT 
            ${airqloudsSitesTable}.airqloud_id, 
            ${airqloudsSitesTable}.site_id
          FROM \`${airqloudsSitesTable}\`
          WHERE ${airqloudsSitesTable}.airqloud_id = @airqloud
        `;

        metaDataQuery = `
          SELECT 
            ${airqloudsTable}.name AS airqloud_name,
            meta_data.*
          FROM \`${airqloudsTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.airqloud_id = \`${airqloudsTable}\`.id
        `;

        metaDataQuery = `
          SELECT 
            ${sitesTable}.name AS site_name,
            meta_data.*
          FROM \`${sitesTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${sitesTable}\`.id
        `;

        query += `
          , meta_data.*
          FROM \`${dataTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${dataTable}\`.site_id
          WHERE meta_data.airqloud_id = @airqloud
        `;
      } else if (grid) {
        // Similar nested subqueries for grid
        metaDataQuery = `
          SELECT 
            ${gridsSitesTable}.grid_id, 
            ${gridsSitesTable}.site_id
          FROM \`${gridsSitesTable}\`
          WHERE ${gridsSitesTable}.grid_id = @grid
        `;

        metaDataQuery = `
          SELECT 
            ${gridsTable}.name AS grid_name,
            meta_data.*
          FROM \`${gridsTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.grid_id = \`${gridsTable}\`.id
        `;

        metaDataQuery = `
          SELECT 
            ${sitesTable}.name AS site_name,
            meta_data.*
          FROM \`${sitesTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${sitesTable}\`.id
        `;

        query += `
          , meta_data.*
          FROM \`${dataTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${dataTable}\`.site_id
          WHERE meta_data.grid_id = @grid
        `;
      } else if (cohort) {
        // Similar nested subqueries for cohort
        metaDataQuery = `
          SELECT 
            ${cohortsDevicesTable}.cohort_id, 
            ${cohortsDevicesTable}.site_id
          FROM \`${cohortsDevicesTable}\`
          WHERE ${cohortsDevicesTable}.cohort_id = @cohort
        `;

        metaDataQuery = `
          SELECT 
            ${cohortsTable}.name AS cohort_name,
            meta_data.*
          FROM \`${cohortsTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.cohort_id = \`${cohortsTable}\`.id
        `;

        metaDataQuery = `
          SELECT 
            ${sitesTable}.name AS site_name,
            meta_data.*
          FROM \`${sitesTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${sitesTable}\`.id
        `;

        query += `
          , meta_data.*
          FROM \`${dataTable}\`
          RIGHT JOIN (${metaDataQuery}) meta_data 
          ON meta_data.site_id = \`${dataTable}\`.site_id
          WHERE meta_data.cohort_id = @cohort
        `;
      }

      query += `
        AND timestamp BETWEEN @startDateTime AND @endDateTime
      `;

      const options = {
        query,
        params: {
          devices,
          site,
          airqloud,
          grid,
          cohort,
          startDateTime: new Date(startDateTime).toISOString(),
          endDateTime: new Date(endDateTime).toISOString(),
        },
        useLegacySql: false,
      };

      const [rows] = await createUptime.bigQueryClient.query(options);

      // Compute uptime and summary based on input parameters
      const processedData = rows.map((row) => ({
        ...row,
        uptime: createUptime.computeUptime(row, threshold),
        downtime: 100 - createUptime.computeUptime(row, threshold),
      }));

      return createUptime.computeUptimeSummary(params, processedData);
    } catch (error) {
      logger.error(`BigQuery Uptime Error: ${error.message}`);
      throw new HttpError(
        "Uptime Query Failed",
        httpStatus.INTERNAL_SERVER_ERROR,
        { message: error.message }
      );
    }
  },

  v1_computeUptimeSummary(params) {
    const {
      devices = [],
      startDateTime,
      endDateTime,
      site = "",
      airqloud = "",
      grid = "",
      cohort = "",
      data,
      threshold,
    } = params;

    if (isEmpty(data)) return [];

    // Convert data to a DataFrame-like structure
    const processedData = data.map((item) => ({
      ...item,
      uptime: createUptime.computeUptime(item, threshold),
      downtime: 100 - createUptime.computeUptime(item, threshold),
    }));

    // If specific devices are requested, return device-level data
    if (devices.length > 0) {
      return processedData;
    }

    // Site-level aggregation
    if (site) {
      const siteUptime =
        processedData.reduce((acc, item) => acc + item.uptime, 0) /
        processedData.length;
      const siteDowntime =
        processedData.reduce((acc, item) => acc + item.downtime, 0) /
        processedData.length;
      const totalDataPoints = processedData.reduce(
        (acc, item) => acc + item.data_points,
        0
      );

      return {
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        site_id: processedData[0]?.site_id,
        site_name: processedData[0]?.site_name,
        uptime: siteUptime,
        downtime: siteDowntime,
        data_points: totalDataPoints,
        hourly_threshold: processedData[0]?.hourly_threshold,
        devices: processedData,
      };
    }

    // Airqloud-level aggregation
    if (airqloud) {
      // Group by site
      const siteGrouped = processedData.reduce((acc, item) => {
        const key = `${item.site_id}-${item.site_name}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {});

      // Compute site-level statistics
      const sites = Object.entries(siteGrouped).map(([key, siteData]) => {
        const siteUptime =
          siteData.reduce((acc, item) => acc + item.uptime, 0) /
          siteData.length;
        const siteDowntime =
          siteData.reduce((acc, item) => acc + item.downtime, 0) /
          siteData.length;
        const totalDataPoints = siteData.reduce(
          (acc, item) => acc + item.data_points,
          0
        );

        return {
          site_id: siteData[0].site_id,
          site_name: siteData[0].site_name,
          uptime: siteUptime,
          downtime: siteDowntime,
          data_points: totalDataPoints,
          hourly_threshold: siteData[0].hourly_threshold,
          start_date_time: startDateTime,
          end_date_time: endDateTime,
        };
      });

      // Overall airqloud statistics
      const overallUptime =
        processedData.reduce((acc, item) => acc + item.uptime, 0) /
        processedData.length;
      const overallDowntime =
        processedData.reduce((acc, item) => acc + item.downtime, 0) /
        processedData.length;
      const totalDataPoints = processedData.reduce(
        (acc, item) => acc + item.data_points,
        0
      );

      return {
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        airqloud_id: processedData[0]?.airqloud_id,
        airqloud_name: processedData[0]?.airqloud_name,
        uptime: overallUptime,
        downtime: overallDowntime,
        data_points: totalDataPoints,
        hourly_threshold: processedData[0]?.hourly_threshold,
        sites,
        devices: processedData,
      };
    }

    // Grid-level aggregation (similar to airqloud)
    if (grid) {
      const siteGrouped = processedData.reduce((acc, item) => {
        const key = `${item.site_id}-${item.site_name}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {});

      const sites = Object.entries(siteGrouped).map(([key, siteData]) => {
        const siteUptime =
          siteData.reduce((acc, item) => acc + item.uptime, 0) /
          siteData.length;
        const siteDowntime =
          siteData.reduce((acc, item) => acc + item.downtime, 0) /
          siteData.length;
        const totalDataPoints = siteData.reduce(
          (acc, item) => acc + item.data_points,
          0
        );

        return {
          site_id: siteData[0].site_id,
          site_name: siteData[0].site_name,
          uptime: siteUptime,
          downtime: siteDowntime,
          data_points: totalDataPoints,
          hourly_threshold: siteData[0].hourly_threshold,
          start_date_time: startDateTime,
          end_date_time: endDateTime,
        };
      });

      const overallUptime =
        processedData.reduce((acc, item) => acc + item.uptime, 0) /
        processedData.length;
      const overallDowntime =
        processedData.reduce((acc, item) => acc + item.downtime, 0) /
        processedData.length;
      const totalDataPoints = processedData.reduce(
        (acc, item) => acc + item.data_points,
        0
      );

      return {
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        grid_id: processedData[0]?.grid_id,
        grid_name: processedData[0]?.grid_name,
        uptime: overallUptime,
        downtime: overallDowntime,
        data_points: totalDataPoints,
        hourly_threshold: processedData[0]?.hourly_threshold,
        sites,
        devices: processedData,
      };
    }

    // Cohort-level aggregation (identical to grid and airqloud)
    if (cohort) {
      const siteGrouped = processedData.reduce((acc, item) => {
        const key = `${item.site_id}-${item.site_name}`;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push(item);
        return acc;
      }, {});

      const sites = Object.entries(siteGrouped).map(([key, siteData]) => {
        const siteUptime =
          siteData.reduce((acc, item) => acc + item.uptime, 0) /
          siteData.length;
        const siteDowntime =
          siteData.reduce((acc, item) => acc + item.downtime, 0) /
          siteData.length;
        const totalDataPoints = siteData.reduce(
          (acc, item) => acc + item.data_points,
          0
        );

        return {
          site_id: siteData[0].site_id,
          site_name: siteData[0].site_name,
          uptime: siteUptime,
          downtime: siteDowntime,
          data_points: totalDataPoints,
          hourly_threshold: siteData[0].hourly_threshold,
          start_date_time: startDateTime,
          end_date_time: endDateTime,
        };
      });

      const overallUptime =
        processedData.reduce((acc, item) => acc + item.uptime, 0) /
        processedData.length;
      const overallDowntime =
        processedData.reduce((acc, item) => acc + item.downtime, 0) /
        processedData.length;
      const totalDataPoints = processedData.reduce(
        (acc, item) => acc + item.data_points,
        0
      );

      return {
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        cohort_id: processedData[0]?.cohort_id,
        cohort_name: processedData[0]?.cohort_name,
        uptime: overallUptime,
        downtime: overallDowntime,
        data_points: totalDataPoints,
        hourly_threshold: processedData[0]?.hourly_threshold,
        sites,
        devices: processedData,
      };
    }

    // If no specific aggregation is requested, return an empty object
    return {};
  },
  computeUptimeSummary(params, data) {
    const {
      devices = [],
      startDateTime,
      endDateTime,
      site = "",
      airqloud = "",
      grid = "",
      cohort = "",
      threshold,
    } = params;

    if (data.length === 0) return data;

    // Adjust threshold if provided
    const adjustedData = data.map((row) => ({
      ...row,
      hourly_threshold: threshold || row.hourly_threshold,
    }));

    if (devices.length > 0) {
      return adjustedData;
    }

    if (site) {
      const siteUptime = {
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        site_id: adjustedData[0].site_id,
        site_name: adjustedData[0].site_name,
        uptime: createUptime.calculateMean(adjustedData, "uptime"),
        downtime: createUptime.calculateMean(adjustedData, "downtime"),
        data_points: createUptime.calculateSum(adjustedData, "data_points"),
        hourly_threshold: adjustedData[0].hourly_threshold,
        devices: adjustedData,
      };
      return siteUptime;
    }

    if (airqloud || grid || cohort) {
      const sitesUptime = createUptime.groupBySites(adjustedData);
      const summaryKey = airqloud ? "airqloud" : grid ? "grid" : "cohort";
      const summary = {
        [`${summaryKey}_id`]: adjustedData[0][`${summaryKey}_id`],
        [`${summaryKey}_name`]: adjustedData[0][`${summaryKey}_name`],
        start_date_time: startDateTime,
        end_date_time: endDateTime,
        uptime: createUptime.calculateMean(adjustedData, "uptime"),
        downtime: createUptime.calculateMean(adjustedData, "downtime"),
        data_points: createUptime.calculateSum(adjustedData, "data_points"),
        hourly_threshold: adjustedData[0].hourly_threshold,
        sites: sitesUptime,
        devices: adjustedData,
      };
      return summary;
    }

    return adjustedData;
  },
  groupBySites: (data) => {
    const siteGroups = data.reduce((acc, row) => {
      const key = `${row.site_id}-${row.site_name}`;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(row);
      return acc;
    }, {});

    return Object.entries(siteGroups).map(([key, rows]) => {
      const [site_id, site_name] = key.split("-");
      return {
        site_id,
        site_name,
        uptime: createUptime.calculateMean(rows, "uptime"),
        downtime: createUptime.calculateMean(rows, "downtime"),
        data_points: createUptime.calculateSum(rows, "data_points"),
        hourly_threshold: rows[0].hourly_threshold,
        start_date_time: rows[0].start_date_time,
        end_date_time: rows[0].end_date_time,
      };
    });
  },
  calculateMean: (data, field) => {
    return data.reduce((sum, item) => sum + item[field], 0) / data.length;
  },
  calculateSum: (data, field) => {
    return data.reduce((sum, item) => sum + item[field], 0);
  },
  getDeviceStatus: async (params, next) => {
    try {
      const { tenant, startDate, endDate, limit } = params;

      const result = await DeviceStatusModel(tenant).getDeviceStatus(
        {
          startDate,
          endDate,
          limit,
        },
        next
      );

      return {
        success: true,
        message: "Device status query successful",
        data: result,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getNetworkUptime: async (params, next) => {
    try {
      const { tenant, startDate, endDate } = params;

      const result = await NetworkUptimeModel(tenant).getNetworkUptime(
        {
          startDate,
          endDate,
        },
        next
      );

      return {
        success: true,
        message: "Network uptime query successful",
        data: result,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDeviceUptime: async (params, next) => {
    try {
      const { tenant, startDate, endDate, devices, deviceName } = params;

      const result = await DeviceUptimeModel(tenant).getDeviceUptime(
        {
          startDate,
          endDate,
          devices,
          deviceName,
        },
        next
      );

      return {
        success: true,
        message: "Device uptime query successful",
        data: result,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDeviceBattery: async (params, next) => {
    try {
      const {
        deviceName,
        startDate,
        endDate,
        minutesAverage,
        rounding,
      } = params;

      const rawData = await DeviceBatteryModel.getDeviceBattery(
        {
          device: deviceName,
          startDatetime: startDate,
          endDatetime: endDate,
        },
        next
      );

      const formattedData = DeviceBatteryModel.formatDeviceBattery(rawData, {
        rounding,
        minutesAverage,
      });

      return {
        success: true,
        message: "Device battery query successful",
        data: formattedData,
      };
    } catch (error) {
      logger.error(`🐛🐛 Internal Server Error ${error.message}`);
      next(
        new HttpError(
          "Internal Server Error",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },

  getDatawarehouseUptime: async (params, next) => {
    try {
      const {
        devices,
        startDate,
        endDate,
        site,
        airqloud,
        grid,
        cohort,
        threshold,
      } = params;

      const result = await createUptime.getUptime({
        devices,
        startDateTime: startDate,
        endDateTime: endDate,
        site,
        airqloud,
        grid,
        cohort,
        threshold,
      });

      return {
        success: true,
        message: "Datawarehouse uptime query successful",
        data: result,
      };
    } catch (error) {
      logger.error(`🐛🐛 Datawarehouse Uptime Error ${error.message}`);
      next(
        new HttpError(
          "Datawarehouse Uptime Query Failed",
          httpStatus.INTERNAL_SERVER_ERROR,
          { message: error.message }
        )
      );
    }
  },
};

module.exports = createUptime;
