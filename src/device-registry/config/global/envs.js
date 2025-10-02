const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const moment = require("moment-timezone");
const { logObject, logText } = require("@utils/shared");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const envs = {
  DEVICE_NAMES_TO_EXCLUDE_FROM_JOB: process.env.DEVICE_NAMES_TO_EXCLUDE_FROM_JOB
    ? process.env.DEVICE_NAMES_TO_EXCLUDE_FROM_JOB.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  TIMEZONE: moment.tz.guess(),
  SESSION_SECRET: process.env.SESSION_SECRET,
  NETWORKS: process.env.NETWORKS
    ? process.env.NETWORKS.split(",").filter((value) => value.trim() !== "")
    : [],
  ACTIVITY_TYPES: process.env.ACTIVITY_TYPES
    ? process.env.ACTIVITY_TYPES.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  RECALL_TYPES: process.env.RECALL_TYPES
    ? process.env.RECALL_TYPES.split(",").filter((value) => value.trim() !== "")
    : [],
  MAINTENANCE_TYPES: process.env.MAINTENANCE_TYPES
    ? process.env.MAINTENANCE_TYPES.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  DEFAULT_NETWORK: process.env.DEFAULT_NETWORK,
  DEFAULT_TENANT: process.env.DEFAULT_TENANT,
  DEFAULT_NEAREST_SITE_RADIUS: process.env.DEFAULT_NEAREST_SITE_RADIUS,
  SLACK_TOKEN: process.env.SLACK_TOKEN,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID,
  SLACK_CHANNEL: process.env.SLACK_CHANNEL,
  SLACK_USERNAME: process.env.SLACK_USERNAME,
  DATAWAREHOUSE_RAW_DATA: process.env.DATAWAREHOUSE_RAW_DATA,
  MOESIF_APPLICATION_ID: process.env.MOESIF_APPLICATION_ID,
  DOMAIN_WHITELIST: process.env.DOMAIN_WHITELIST
    ? process.env.DOMAIN_WHITELIST.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  BIG_QUERY_LOCATION: process.env.BIG_QUERY_LOCATION,
  TENANTS: process.env.TENANTS
    ? process.env.TENANTS.split(",").filter((value) => value.trim() !== "")
    : [],
  SITES_TOPIC: process.env.SITES_TOPIC,
  DEVICES_TOPIC: process.env.DEVICES_TOPIC,
  LOCATIONS_TOPIC: process.env.LOCATIONS_TOPIC,
  SENSORS_TOPIC: process.env.SENSORS_TOPIC,
  AIRQLOUDS_TOPIC: process.env.AIRQLOUDS_TOPIC,
  ACTIVITIES_TOPIC: process.env.ACTIVITIES_TOPIC,
  PHOTOS_TOPIC: process.env.PHOTOS_TOPIC,
  TIPS_TOPIC: process.env.TIPS_TOPIC,
  KYA_TOPIC: process.env.KYA_TOPIC,
  KYA_LESSON: process.env.KYA_LESSON,
  KYA_QUESTION: process.env.KYA_QUESTION,
  KYA_ANSWER: process.env.KYA_ANSWER,
  KYA_QUIZ: process.env.KYA_QUIZ,
  GRID_TOPIC: process.env.GRID_TOPIC,
  DEPLOY_TOPIC: process.env.DEPLOY_TOPIC,
  RECALL_TOPIC: process.env.RECALL_TOPIC,
  COHORT_TOPIC: process.env.COHORT_TOPIC,
  HOURLY_MEASUREMENTS_TOPIC: process.env.HOURLY_MEASUREMENTS_TOPIC,
  PORT: process.env.PORT || 3000,
  TAHMO_API_GET_STATIONS_URL: process.env.TAHMO_API_GET_STATIONS_URL,
  TAHMO_API_CREDENTIALS_USERNAME: process.env.TAHMO_API_CREDENTIALS_USERNAME,
  TAHMO_API_CREDENTIALS_PASSWORD: process.env.TAHMO_API_CREDENTIALS_PASSWORD,
  UNIQUE_CONSUMER_GROUP: process.env.UNIQUE_CONSUMER_GROUP,
  UNIQUE_PRODUCER_GROUP: process.env.UNIQUE_PRODUCER_GROUP,
  KEY_ENCRYPTION_KEY: process.env.KEY_ENCRYPTION_KEY,
  JWT_SECRET: process.env.JWT_SECRET,
  N_VALUES: process.env.N_VALUES || 500,
  DEFAULT_LIMIT_FOR_QUERYING_SITES:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_SITES,
  DEFAULT_LIMIT_FOR_QUERYING_PHOTOS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_PHOTOS,
  DEFAULT_LIMIT_FOR_QUERYING_TIPS: process.env.DEFAULT_LIMIT_FOR_QUERYING_TIPS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_TASKS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_TASKS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_LESSONS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_QUESTIONS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUESTIONS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_ANSWERS,
  DEFAULT_LIMIT_FOR_QUERYING_KYA_QUIZZES:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_KYA_QUIZZES,
  DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS:
    process.env.DEFAULT_LIMIT_FOR_QUERYING_AIRQLOUDS,
  DEFAULT_EVENTS_LIMIT: process.env.DEFAULT_EVENTS_LIMIT,
  DEFAULT_EVENTS_SKIP: process.env.DEFAULT_EVENTS_SKIP,
  EVENTS_CACHE_LIMIT: process.env.EVENTS_CACHE_LIMIT,
  DATA_COMPLETENESS_THRESHOLD: process.env.DATA_COMPLETENESS_THRESHOLD || 80,
  INTRA_CORRELATION_THRESHOLD: process.env.INTRA_CORRELATION_THRESHOLD || 0.98,
  INTER_CORRELATION_THRESHOLD: process.env.INTER_CORRELATION_THRESHOLD || 0.98,
  COLLOCATION_CELERY_MINUTES_INTERVAL:
    process.env.COLLOCATION_CELERY_MINUTES_INTERVAL || 10,
  EXPECTED_RECORDS_PER_HOUR: process.env.EXPECTED_RECORDS_PER_HOUR || 30,
  INTER_CORRELATION_PARAMETER:
    process.env.INTER_CORRELATION_PARAMETER || "pm2_5",
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
  THINGSPEAK_BASE_URL: process.env.THINGSPEAK_BASE_URL,
};
module.exports = envs;
