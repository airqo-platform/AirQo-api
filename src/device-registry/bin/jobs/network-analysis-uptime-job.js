const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- /bin/jobs/network-uptime-analysis-job`
);
const cron = require("node-cron");
const moment = require("moment-timezone");
const { BigQuery } = require("@google-cloud/bigquery");
const { MongoClient } = require("mongodb");

const TIMEZONE = moment.tz.guess();
const MONGO_URI = process.env.MONGO_URI;
const DATABASE_NAME = "airqo_netmanager_airqo";

class NetworkUptimeAnalysis {
  constructor() {
    this.bigquery = new BigQuery();
    this.mongoClient = new MongoClient(MONGO_URI);
  }

  async connectToMongoDB() {
    await this.mongoClient.connect();
    return this.mongoClient.db(DATABASE_NAME);
  }

  async getAllDevices() {
    const db = await this.connectToMongoDB();
    const devices = await db
      .collection("devices")
      .find({
        locationID: { $ne: "" },
        isActive: true,
      })
      .toArray();
    return devices;
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
    let deviceUptimePercentage =
      Math.round((actualValidRecords / expectedTotalRecords) * 100 * 100) / 100;
    let deviceDowntimePercentage =
      Math.round(
        ((expectedTotalRecords - actualValidRecords) / expectedTotalRecords) *
          100 *
          100
      ) / 100;

    // Ensure percentages are within 0-100 range
    deviceUptimePercentage = Math.min(deviceUptimePercentage, 100);
    deviceDowntimePercentage = Math.max(deviceDowntimePercentage, 0);

    return [deviceUptimePercentage, deviceDowntimePercentage];
  }

  async computeUptimeForAllDevices() {
    const timePeriods = [
      { label: "twenty_four_hours", specifiedHours: 24 },
      { label: "seven_days", specifiedHours: 168 },
      { label: "twenty_eight_days", specifiedHours: 672 },
      { label: "twelve_months", specifiedHours: 0 },
      { label: "all_time", specifiedHours: 0 },
    ];

    const networkUptimeRecords = {};

    for (const timePeriod of timePeriods) {
      let specifiedHours = timePeriod.specifiedHours;

      // Adjust hours for specific time periods
      if (timePeriod.label === "twelve_months") {
        const today = new Date();
        const twelveMonthsAgo = new Date(
          today.getFullYear() - 1,
          today.getMonth(),
          today.getDate()
        );
        specifiedHours = Math.ceil(
          (today - twelveMonthsAgo) / (1000 * 60 * 60)
        );
      }

      if (timePeriod.label === "all_time") {
        specifiedHours = 365 * 24; // Approximate one year
      }

      const devices = await this.getAllDevices();
      const deviceUptimeRecords = [];
      const allDevicesUptimeSeries = [];

      for (const device of devices) {
        const channelId = device.channelID;
        const mobility = device.mobility;
        const deviceId = device._id;
        const deviceName = device.name;

        // Adjust hours for mobile devices
        let adjustedHours =
          mobility === "Mobile"
            ? Math.floor(specifiedHours / 2)
            : specifiedHours;

        try {
          const rawData = await this.getRawChannelData(
            channelId,
            adjustedHours
          );
          const validRecordsCount = rawData.filter(
            (row) => row.s1_pm2_5 > 0 && row.s1_pm2_5 <= 500.4
          ).length;

          const [
            deviceUptimePercentage,
            deviceDowntimePercentage,
          ] = this.calculateDeviceUptime(adjustedHours, validRecordsCount);

          allDevicesUptimeSeries.push(deviceUptimePercentage);

          const deviceUptimeRecord = {
            device_uptime_in_percentage: deviceUptimePercentage,
            device_downtime_in_percentage: deviceDowntimePercentage,
            created_at: new Date(),
            device_channel_id: channelId,
            specified_time_in_hours: adjustedHours,
            device_name: deviceName,
            device_id: deviceId,
          };

          deviceUptimeRecords.push(deviceUptimeRecord);
        } catch (error) {
          logger.error(
            `Error processing device ${deviceName}: ${error.message}`
          );
        }
      }

      const averageUptimePercentage =
        Math.round(
          (allDevicesUptimeSeries.reduce((a, b) => a + b, 0) /
            allDevicesUptimeSeries.length) *
            100
        ) / 100;

      const entireNetworkUptimeRecord = {
        average_uptime_for_entire_network_in_percentage: averageUptimePercentage,
        device_uptime_records: deviceUptimeRecords,
        created_at: new Date(),
        specified_time_in_hours: specifiedHours,
      };

      networkUptimeRecords[timePeriod.label] = entireNetworkUptimeRecord;

      logger.info(
        `Average uptime for ${timePeriod.label}: ${averageUptimePercentage}%`
      );
    }

    await this.saveNetworkUptimeAnalysisResults(networkUptimeRecords);
  }

  async saveNetworkUptimeAnalysisResults(data) {
    const db = await this.connectToMongoDB();
    try {
      await db.collection("network_uptime_analysis_results").insertOne(data);
      logger.info("Network uptime analysis results saved successfully");
    } catch (error) {
      logger.error(`Error saving network uptime results: ${error.message}`);
    } finally {
      await this.mongoClient.close();
    }
  }

  async runJob() {
    try {
      logger.info("Starting network uptime analysis job...");
      await this.computeUptimeForAllDevices();
      logger.info("Network uptime analysis job completed successfully");
    } catch (error) {
      logger.error(`Network uptime analysis job failed: ${error.message}`);
    }
  }
}

// Job setup
const networkUptimeJob = new NetworkUptimeAnalysis();

// Run every 24 hours
const schedule = "0 0 * * *"; // At midnight every day
cron.schedule(schedule, () => networkUptimeJob.runJob(), {
  scheduled: true,
  timezone: TIMEZONE,
});

logger.info("Network uptime analysis job is now running.....");

module.exports = networkUptimeJob;
