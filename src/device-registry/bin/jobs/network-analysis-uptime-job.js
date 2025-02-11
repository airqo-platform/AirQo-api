const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/network-uptime-analysis-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const { BigQuery } = require("@google-cloud/bigquery");
const DeviceModel = require("@models/Device");
const DeviceUptimeModel = require("@models/DeviceUptime");
const NetworkUptimeModel = require("@models/NetworkUptime");
const { logObject, logText } = require("@utils/shared");

const TIMEZONE = moment.tz.guess();

class NetworkUptimeAnalysis {
  constructor() {
    this.bigquery = new BigQuery();
  }

  async getAllActiveDevices() {
    return DeviceModel("airqo").find({
      locationID: { $ne: "" },
      isActive: true,
    });
  }

  async getRawChannelData(channelId, hours = 24) {
    const query = `
      SELECT 
        SAFE_CAST(TIMESTAMP(created_at) as DATETIME) as time, 
        channel_id,
        field1 as s1_pm2_5,
        field2 as s1_pm10, 
        field3 as s2_pm2_5, 
        field4 as s2_pm10, 
        field7 as battery_voltage
      FROM \`airqo-250220.thingspeak.raw_feeds_pms\` 
      WHERE channel_id = @channelId 
        AND CAST(created_at as TIMESTAMP) >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @hours HOUR) 
      ORDER BY time DESC
    `;

    const options = {
      query: query,
      params: {
        channelId: channelId.toString(),
        hours: hours,
      },
    };

    const [rows] = await this.bigquery.query(options);
    return rows;
  }

  calculateDeviceUptime(expectedTotalRecords, actualValidRecords) {
    const deviceUptimePercentage = Math.min(
      Math.round((actualValidRecords / expectedTotalRecords) * 100 * 100) / 100,
      100
    );
    const deviceDowntimePercentage = Math.max(
      Math.round(
        ((expectedTotalRecords - actualValidRecords) / expectedTotalRecords) *
          100 *
          100
      ) / 100,
      0
    );

    return [deviceUptimePercentage, deviceDowntimePercentage];
  }

  async processDeviceData(device, specifiedHours) {
    const adjustedHours =
      device.mobility === "Mobile"
        ? Math.floor(specifiedHours / 2)
        : specifiedHours;

    try {
      const rawData = await this.getRawChannelData(
        device.channelID,
        adjustedHours
      );
      const validRecords = rawData.filter(
        (row) => row.s1_pm2_5 > 0 && row.s1_pm2_5 <= 500.4
      );
      const validRecordsCount = validRecords.length;

      const [uptimePercentage, downtimePercentage] = this.calculateDeviceUptime(
        adjustedHours,
        validRecordsCount
      );

      // Calculate average PM2.5 readings
      const avgSensorOnePM25 =
        validRecords.reduce((sum, row) => sum + row.s1_pm2_5, 0) /
          validRecordsCount || 0;
      const avgSensorTwoPM25 =
        validRecords.reduce((sum, row) => sum + row.s2_pm2_5, 0) /
          validRecordsCount || 0;
      const avgBatteryVoltage =
        validRecords.reduce((sum, row) => sum + row.battery_voltage, 0) /
          validRecordsCount || 0;

      // Create device uptime record
      const deviceUptimeData = {
        created_at: new Date(),
        device_name: device.name,
        uptime: uptimePercentage,
        downtime: downtimePercentage,
        battery_voltage: avgBatteryVoltage,
        channel_id: device.channelID,
        sensor_one_pm2_5: avgSensorOnePM25,
        sensor_two_pm2_5: avgSensorTwoPM25,
      };

      await DeviceUptimeModel("airqo").create(deviceUptimeData);
      return uptimePercentage;
    } catch (error) {
      logger.error(`Error processing device ${device.name}: ${error.message}`);
      return null;
    }
  }

  async computeNetworkUptime(timePeriod) {
    const devices = await this.getAllActiveDevices();
    const uptimeResults = await Promise.all(
      devices.map((device) =>
        this.processDeviceData(device, timePeriod.specifiedHours)
      )
    );

    // Filter out null results and calculate average
    const validUptimes = uptimeResults.filter((result) => result !== null);
    const averageUptime =
      validUptimes.length > 0
        ? Math.round(
            (validUptimes.reduce((a, b) => a + b, 0) / validUptimes.length) *
              100
          ) / 100
        : 0;

    // Save network uptime record
    await NetworkUptimeModel("airqo").create({
      created_at: new Date(),
      network_name: "airqo",
      uptime: averageUptime,
    });

    return averageUptime;
  }

  async runJob() {
    try {
      logger.info("Starting network uptime analysis job...");
      logText("Starting network uptime analysis...");

      const timePeriods = [
        { label: "24_hours", specifiedHours: 24 },
        { label: "7_days", specifiedHours: 168 },
        { label: "28_days", specifiedHours: 672 },
      ];

      for (const period of timePeriods) {
        const averageUptime = await this.computeNetworkUptime(period);
        logObject(`Network uptime for ${period.label}`, averageUptime);
        logger.info(`Average uptime for ${period.label}: ${averageUptime}%`);
      }

      logger.info("Network uptime analysis job completed successfully");
      logText("Network uptime analysis completed successfully");
    } catch (error) {
      logger.error(`Network uptime analysis job failed: ${error.message}`);
      logText(`Error in network uptime analysis: ${error.message}`);
    }
  }
}

// Create job instance
const networkUptimeJob = new NetworkUptimeAnalysis();

// Run daily at midnight
const schedule = "0 0 * * *";
cron.schedule(schedule, () => networkUptimeJob.runJob(), {
  scheduled: true,
  timezone: TIMEZONE,
});

logger.info("Network uptime analysis job is now running.....");
logText("Network uptime analysis job is now running.....");

module.exports = networkUptimeJob;
