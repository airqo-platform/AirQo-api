const mongoose = require("mongoose");
const ObjectId = mongoose.Types.ObjectId;
const log4js = require("log4js");
const isEmpty = require("is-empty");
const { logText } = require("@utils/log");
const logger = log4js.getLogger(`${this.ENVIRONMENT} -- constants-config`);

const prodConfig = {
  DEFAULT_COHORT: process.env.PROD_DEFAULT_COHORT,
  MONGO_URI: process.env.MONGO_URI_PROD,
  DB_NAME: process.env.MONGO_PROD,
  REDIS_SERVER: process.env.REDIS_SERVER,
  REDIS_PORT: process.env.REDIS_PORT,
  KAFKA_BOOTSTRAP_SERVERS: process.env.KAFKA_BOOTSTRAP_SERVERS_PROD
    ? process.env.KAFKA_BOOTSTRAP_SERVERS_PROD.split(",").filter(
        (value) => value.trim() !== ""
      )
    : [],
  KAFKA_TOPICS: process.env.KAFKA_TOPICS_PROD,
  SCHEMA_REGISTRY: process.env.SCHEMA_REGISTRY_PROD,
  KAFKA_RAW_MEASUREMENTS_TOPICS: process.env.KAFKA_RAW_MEASUREMENTS_TOPICS_PROD,
  KAFKA_CLIENT_ID: process.env.KAFKA_CLIENT_ID_PROD,
  KAFKA_CLIENT_GROUP: process.env.KAFKA_CLIENT_GROUP_PROD,
  ENVIRONMENT: "PRODUCTION ENVIRONMENT",
  DATAWAREHOUSE_METADATA: process.env.DATAWAREHOUSE_METADATA_PROD,
  DATAWAREHOUSE_AVERAGED_DATA: process.env.DATAWAREHOUSE_AVERAGED_DATA_PROD,

  BIGQUERY_DEVICE_UPTIME_TABLE: process.env.PROD_BIGQUERY_DEVICE_UPTIME_TABLE,
  BIGQUERY_SITES: process.env.PROD_BIGQUERY_SITES,
  BIGQUERY_AIRQLOUDS_SITES: process.env.PROD_BIGQUERY_AIRQLOUDS_SITES,
  BIGQUERY_AIRQLOUDS: process.env.PROD_BIGQUERY_AIRQLOUDS,
  BIGQUERY_GRIDS_SITES: process.env.PROD_BIGQUERY_GRIDS_SITES,
  BIGQUERY_GRIDS: process.env.PROD_BIGQUERY_GRIDS,
  BIGQUERY_COHORTS_DEVICES: process.env.PROD_BIGQUERY_COHORTS_DEVICES,
  BIGQUERY_COHORTS: process.env.PROD_BIGQUERY_COHORTS,
  BIGQUERY_RAW_DATA: process.env.PROD_BIGQUERY_RAW_DATA,
  BIGQUERY_HOURLY_DATA: process.env.PROD_BIGQUERY_HOURLY_DATA,
  BIGQUERY_DEVICES: process.env.PROD_BIGQUERY_DEVICES,
};
module.exports = prodConfig;
