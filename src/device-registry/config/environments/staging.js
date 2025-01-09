const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const stageConfig = {
  DEFAULT_COHORT: process.env.STAGE_DEFAULT_COHORT,
  MONGO_URI: process.env.MONGO_URI_STAGE,
  DB_NAME: process.env.MONGO_STAGE,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_STAGE.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_STAGE,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_STAGE,
  KAFKA_RAW_MEASUREMENTS_TOPICS:
    process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_STAGE,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_STAGE,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_STAGE,
  ENVIRONMENT: "STAGING ENVIRONMENT",
  DATAWAREHOUSE_METADATA: process.env.DATAWAREHOUSE_METADATA_STAGE,
  DATAWAREHOUSE_AVERAGED_DATA: process.env.DATAWAREHOUSE_AVERAGED_DATA_STAGE,

  BIGQUERY_DEVICE_UPTIME_TABLE: process.env.STAGE_BIGQUERY_DEVICE_UPTIME_TABLE,
  BIGQUERY_SITES: process.env.STAGE_BIGQUERY_SITES,
  BIGQUERY_AIRQLOUDS_SITES: process.env.STAGE_BIGQUERY_AIRQLOUDS_SITES,
  BIGQUERY_AIRQLOUDS: process.env.STAGE_BIGQUERY_AIRQLOUDS,
  BIGQUERY_GRIDS_SITES: process.envSTAGE_BIGQUERY_GRIDS_SITES,
  BIGQUERY_GRIDS: process.env.STAGE_BIGQUERY_GRIDS,
  BIGQUERY_COHORTS_DEVICES: process.env.STAGE_BIGQUERY_COHORTS_DEVICES,
  BIGQUERY_COHORTS: process.env.STAGE_BIGQUERY_COHORTS,
  BIGQUERY_RAW_DATA: process.env.STAGE_BIGQUERY_RAW_DATA,
  BIGQUERY_HOURLY_DATA: process.env.STAGE_BIGQUERY_HOURLY_DATA,
  BIGQUERY_DEVICES: process.env.STAGE_BIGQUERY_DEVICES,
  BIGQUERY_DEVICE_UPTIME_TABLE: process.env.STAGE_BIGQUERY_DEVICE_UPTIME_TABLE,
};

module.exports = stageConfig;
