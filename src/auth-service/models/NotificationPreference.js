const mongoose = require("mongoose");
const ObjectId = mongoose.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const isEmpty = require("is-empty");
const { getModelByTenant } = require("@config/database");
const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- notification preferences-model`
);

const NotificationPreferencesSchema = new mongoose.Schema(
  {
    user_id: {
      type: ObjectId,
      ref: "user",
      required: true,
      unique: true,
    },
    air_quality_alerts: {
      enabled: { type: Boolean, default: true },
      email_enabled: { type: Boolean, default: true },
      push_enabled: { type: Boolean, default: false },
      sms_enabled: { type: Boolean, default: false },
      thresholds: [
        {
          site_id: {
            type: ObjectId,
            ref: "site",
            required: true,
          },
          pm25_threshold: {
            type: Number,
            default: 55.49, // Default "Unhealthy" threshold
            min: 0,
          },
          aqi_category_threshold: {
            type: String,
            enum: [
              "Good",
              "Moderate",
              "Unhealthy for Sensitive Groups",
              "Unhealthy",
              "Very Unhealthy",
              "Hazardous",
            ],
            default: "Unhealthy",
          },
        },
      ],
      frequency: {
        type: String,
        enum: ["immediate", "hourly", "daily", "weekly"],
        default: "immediate",
      },
      quiet_hours: {
        enabled: { type: Boolean, default: false },
        start: { type: String, default: "22:00" }, // 24-hour format
        end: { type: String, default: "06:00" },
      },
    },
    system_notifications: {
      enabled: { type: Boolean, default: true },
      categories: {
        maintenance: { type: Boolean, default: true },
        system_updates: { type: Boolean, default: true },
        sensor_status: { type: Boolean, default: true },
      },
    },
  },
  { timestamps: true }
);

const NotificationPreferenceModel = (tenant) => {
  const defaultTenant = constants.DEFAULT_TENANT || "airqo";
  const dbTenant = isEmpty(tenant) ? defaultTenant : tenant;
  try {
    let preferences = mongoose.model("notification_preferences");
    return preferences;
  } catch (error) {
    let preferences = getModelByTenant(
      dbTenant,
      "notification_preference",
      NotificationPreferencesSchema
    );
    return preferences;
  }
};

module.exports = NotificationPreferenceModel;
