const cron = require("node-cron");
const mongoose = require("mongoose");
const axios = require("axios");
const UserModel = require("@models/User");
const PreferenceModel = require("@models/Preference");
const NotificationPreferencesModel = require("@models/NotificationPreference");
const constants = require("@config/constants");
const mailer = require("@utils/mailer");
const stringify = require("@utils/stringify");
const isEmpty = require("is-empty");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/jobs/air-quality-alerts-job`
);

// Configuration
const PM25_THRESHOLD = 55.49; // Threshold for "Unhealthy" air quality
const BATCH_SIZE = 100;
const API_TOKEN = process.env.API_TOKEN;
const BASE_URL = process.env.BASE_URL;

// Utility function to chunk site IDs for API calls
const chunkArray = (array, size) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
};

// Fetch recent air quality readings for sites
async function fetchAirQualityReadings(siteIds) {
  try {
    if (!API_TOKEN || !BASE_URL) {
      return [];
    }
    const response = await axios.get(
      `${BASE_URL}/api/v2/devices/readings/recent`,
      {
        params: {
          site_id: siteIds.join(","),
          token: API_TOKEN,
        },
      }
    );

    if (response.data && response.data.success) {
      return response.data.measurements;
    }
    return [];
  } catch (error) {
    logger.error(
      `🐛🐛 Error fetching air quality readings: ${stringify(error)}`
    );
    return [];
  }
}

// Process measurements and identify spikes
function processMeasurements(measurements) {
  return measurements.filter((measurement) => {
    return (
      measurement &&
      measurement.pm2_5 &&
      measurement.pm2_5.value &&
      measurement.pm2_5.value > PM25_THRESHOLD
    );
  });
}

// Generate email content for alerts
function generateAlertEmailContent(spikes, userName, preferences) {
  let spikesList = spikes
    .map(
      (spike) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd;">
          <strong>Location:</strong> ${
            spike.siteDetails && spike.siteDetails.name
              ? spike.siteDetails.name
              : "Unknown Location"
          }<br>
          <strong>PM2.5 Level:</strong> ${
            spike.pm2_5 && spike.pm2_5.value
              ? spike.pm2_5.value.toFixed(2)
              : "N/A"
          } µg/m³<br>
          <strong>Your Alert Threshold:</strong> ${
            preferences &&
            preferences.thresholds &&
            preferences.thresholds.find(
              (t) =>
                t &&
                t.site_id &&
                spike.site_id &&
                t.site_id.toString() === spike.site_id.toString()
            )
              ? preferences.thresholds.find(
                  (t) => t.site_id.toString() === spike.site_id.toString()
                ).pm25_threshold
              : PM25_THRESHOLD
          } µg/m³<br>
          <strong>Category:</strong> ${spike.aqi_category || "Unknown"}<br>
          <strong>Time:</strong> ${new Date(spike.time).toLocaleString()}<br>
          ${
            spike.health_tips && spike.health_tips[0]
              ? `<strong>Health Tip:</strong> ${spike.health_tips[0].description}`
              : ""
          }
        </td>
      </tr>`
    )
    .join("");

  return `
    <tr>
      <td style="color: #344054; font-size: 16px; font-family: Inter; font-weight: 400; line-height: 24px; word-wrap: break-word;">
        <p>High air pollution levels have been detected at your monitored locations.</p>
        <table style="width: 100%; border-collapse: collapse;">
          ${spikesList}
        </table>
        <p>Please take necessary precautions and consider reducing outdoor activities in these areas.</p>
      </td>
    </tr>
  `;
}

// Send email alerts in batches
async function sendEmailAlertsInBatches(alertsData, batchSize = 50) {
  for (let i = 0; i < alertsData.length; i += batchSize) {
    const batch = alertsData.slice(i, i + batchSize);
    const emailPromises = batch.map(async ({ user, spikes }) => {
      const content = generateAlertEmailContent(spikes, user.firstName);
      return await mailer.sendPollutionAlert({
        email: user.email,
        subject: "⚠️ Air Quality Alert: High Pollution Levels Detected",
        content: content,
        firstName: user.firstName,
        lastName: user.lastName,
      });
    });

    try {
      await Promise.all(emailPromises);
      logger.info(`Successfully sent ${batch.length} air quality alert emails`);
    } catch (error) {
      logger.error(
        `🐛🐛 Error sending batch of alert emails: ${stringify(error)}`
      );
    }
  }
}

// Utility function to check if current time is within quiet hours
const isTimeInRange = (current, start, end) => {
  const curr = new Date("1970-01-01T" + current);
  const strt = new Date("1970-01-01T" + start);
  const nd = new Date("1970-01-01T" + end);

  if (strt <= nd) {
    return curr >= strt && curr <= nd;
  } else {
    return curr >= strt || curr <= nd;
  }
};

const checkAirQualityAndAlert = async () => {
  try {
    let skip = 0;
    let alertsToSend = [];

    while (true) {
      // Fetch users with notification preferences
      const users = await UserModel("airqo")
        .find()
        .select("_id email firstName lastName")
        .limit(BATCH_SIZE)
        .skip(skip)
        .lean();

      if (users.length === 0) break;

      for (const user of users) {
        // Get user's notification preferences
        const notificationPrefs = await NotificationPreferencesModel("airqo")
          .findOne({ user_id: user._id })
          .lean();

        // Skip if user has disabled air quality alerts or email notifications
        if (
          !notificationPrefs ||
          !notificationPrefs.air_quality_alerts ||
          !notificationPrefs.air_quality_alerts.enabled ||
          !notificationPrefs.air_quality_alerts.email_enabled
        ) {
          continue;
        }

        // Check quiet hours
        if (
          notificationPrefs.air_quality_alerts.quiet_hours &&
          notificationPrefs.air_quality_alerts.quiet_hours.enabled
        ) {
          const now = new Date();
          const currentTime = now.getHours() + ":" + now.getMinutes();
          const isQuietHours = isTimeInRange(
            currentTime,
            notificationPrefs.air_quality_alerts.quiet_hours.start,
            notificationPrefs.air_quality_alerts.quiet_hours.end
          );
          if (isQuietHours) continue;
        }

        // Get user preferences with selected sites
        const preference = await PreferenceModel("airqo")
          .findOne({ user_id: user._id })
          .select("selected_sites")
          .lean();

        if (
          !preference ||
          !preference.selected_sites ||
          !preference.selected_sites.length
        ) {
          continue;
        }

        // Get site IDs and their corresponding thresholds
        const siteThresholds = new Map();
        if (
          notificationPrefs.air_quality_alerts &&
          notificationPrefs.air_quality_alerts.thresholds
        ) {
          notificationPrefs.air_quality_alerts.thresholds.forEach((t) => {
            if (t && t.site_id) {
              siteThresholds.set(t.site_id.toString(), t.pm25_threshold);
            }
          });
        }

        const siteIds = preference.selected_sites.map((site) => site._id);
        const siteIdChunks = chunkArray(siteIds, 10);

        let allSpikes = [];
        for (const chunk of siteIdChunks) {
          const measurements = await fetchAirQualityReadings(chunk);
          const spikes = measurements.filter((measurement) => {
            if (
              !measurement ||
              !measurement.site_id ||
              !measurement.pm2_5 ||
              !measurement.pm2_5.value
            ) {
              return false;
            }

            const siteThreshold =
              siteThresholds.get(measurement.site_id.toString()) ||
              (notificationPrefs.air_quality_alerts &&
                notificationPrefs.air_quality_alerts.thresholds &&
                notificationPrefs.air_quality_alerts.thresholds[0] &&
                notificationPrefs.air_quality_alerts.thresholds[0]
                  .pm25_threshold) ||
              PM25_THRESHOLD;

            return measurement.pm2_5.value > siteThreshold;
          });
          allSpikes = allSpikes.concat(spikes);
        }

        if (allSpikes.length > 0) {
          alertsToSend.push({
            user,
            spikes: allSpikes,
            preferences: notificationPrefs.air_quality_alerts,
          });
        }
      }

      skip += BATCH_SIZE;
    }

    // Group alerts by frequency preference
    const groupedAlerts = groupAlertsByFrequency(alertsToSend);

    // Send immediate alerts
    if (groupedAlerts.immediate && groupedAlerts.immediate.length > 0) {
      await sendEmailAlertsInBatches(groupedAlerts.immediate);
    }

    // Store other frequency alerts for later processing
    if (Object.keys(groupedAlerts).length > 1) {
      await storeScheduledAlerts(groupedAlerts);
    }
  } catch (error) {
    logger.error(`🐛🐛 Error in checkAirQualityAndAlert: ${stringify(error)}`);
  }
};

// Schedule the job to run every hour
const schedule = "0 * * * *"; // At minute 0 of every hour
cron.schedule(schedule, checkAirQualityAndAlert, {
  scheduled: true,
  timezone: "Africa/Nairobi",
});

module.exports = { checkAirQualityAndAlert };
