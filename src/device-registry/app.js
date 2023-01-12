const log4js = require("log4js");
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
dotenv.config();
require("app-module-path").addPath(__dirname);
const cookieParser = require("cookie-parser");
const apiV1 = require("./routes/api-v1");
const apiV2 = require("./routes/api-v2");
const constants = require("./config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- app entry`);
const { mongodb } = require("./config/database");
const createEvent = require("./utils/create-event");
const isEmpty = require("is-empty");

mongodb;

const { Kafka } = require("kafkajs");
const kafka = new Kafka({
  clientId: constants.KAFKA_CLIENT_ID,
  brokers: constants.KAFKA_BOOTSTRAP_SERVERS,
});

const runKafkaConsumer = async () => {
  try {
    const kafkaConsumer = kafka.consumer({
      groupId: constants.UNIQUE_CONSUMER_GROUP,
    });
    await kafkaConsumer.connect();
    await kafkaConsumer.subscribe({
      topic: constants.HOURLY_MEASUREMENTS_TOPIC,
      fromBeginning: true,
    });
    await kafkaConsumer.run({
      eachMessage: async ({ message }) => {
        const measurements = JSON.parse(message.value).data;
        if (!Array.isArray(measurements) || isEmpty(measurements)) {
          logger.error(
            `KAFKA: the sent measurements are not an array or they are just empty (undefined) --- ${JSON.stringify(
              measurements
            )}`
          );
        }
        const responseFromInsertMeasurements = await createEvent.insert(
          "airqo",
          measurements
        );
        if (responseFromInsertMeasurements.success === false) {
          logger.error(
            `responseFromInsertMeasurements --- ${JSON.stringify(
              responseFromInsertMeasurements
            )}`
          );
        }
      },
    });
  } catch (error) {
    logger.error("KAFKA: internal server error", error.message);
  }
};

if (constants.ENVIRONMENT === "STAGING ENVIRONMENT") {
  runKafkaConsumer();
}

const moesif = require("moesif-nodejs");
const compression = require("compression");

const app = express();
app.use(compression());

const moesifMiddleware = moesif({
  applicationId: constants.MOESIF_APPLICATION_ID,
  identifyUser: function(req, res) {
    return req.user ? req.user.id : undefined;
  },
});

app.use(moesifMiddleware);

app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
app.use(bodyParser.json({ limit: "50mb" }));
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50000,
  })
);
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/devices/", apiV1);
app.use("/api/v2/devices/", apiV2);

app.use(function(req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  if (err.status === 404) {
    logger.error(`this endpoint does not exist--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "this endpoint does not exist",
      errors: { message: err.message },
    });
  } else if (err.status === 400) {
    logger.error(`bad request error--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "bad request error",
      errors: { message: err.message },
    });
  } else if (err.status === 401) {
    logger.error(`unauthorized--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Unauthorized",
      errors: { message: err.message },
    });
  } else if (err.status === 403) {
    logger.error(`forbidden --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Forbidden",
      errors: { message: err.message },
    });
  } else if (err.status === 500) {
    logger.error(`Internal Server Error--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
    });
  } else if (err.status === 502) {
    logger.error(`Bad Gateway--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Bad Gateway",
      errors: { message: err.message },
    });
  } else if (err.status === 503) {
    logger.error(`Service Unavailable--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Service Unavailable",
      errors: { message: err.message },
    });
  } else if (err.status === 504) {
    logger.error(`Gateway Timeout--- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: " Gateway Timeout.",
      errors: { message: err.message },
    });
  } else {
    logger.error(`server side error--- ${err.message}`);
    res.status(err.status || 500).json({
      success: false,
      message: "server side error",
      errors: { message: err.message },
    });
  }
});

module.exports = app;
