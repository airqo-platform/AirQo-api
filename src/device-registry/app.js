const log4js = require("log4js");
const express = require("express");
const path = require("path");
const logger = log4js.getLogger("app");

const dotenv = require("dotenv");
const bodyParser = require("body-parser");
dotenv.config();
require("app-module-path").addPath(__dirname);
const cookieParser = require("cookie-parser");
const apiV1 = require("./routes/api-v1");
const apiV2 = require("./routes/api-v2");
const constants = require("./config/constants");
const { mongodb } = require("./config/database");
const { runKafkaConsumer, runKafkaProducer } = require("./config/kafkajs");

mongodb;

// runKafkaProducer();
// runKafkaConsumer();
const cors = require("cors");
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
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
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
  logger.error(`${err.message}`);
  if (err.status === 404) {
    res.status(err.status).json({
      success: false,
      message: "this endpoint does not exist",
      errors: { message: err.message },
    });
  }

  if (err.status === 400) {
    res.status(err.status).json({
      success: false,
      message: "bad request error",
      errors: { message: err.message },
    });
  }

  if (err.status === 401) {
    res.status(err.status).json({
      success: false,
      message: "Unauthorized",
      errors: { message: err.message },
    });
  }

  if (err.status === 403) {
    res.status(err.status).json({
      success: false,
      message: "Forbidden",
      errors: { message: err.message },
    });
  }

  if (err.status === 500) {
    res.status(err.status).json({
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
    });
  }

  if (err.status === 502) {
    res.status(err.status).json({
      success: false,
      message: "Bad Gateway",
      errors: { message: err.message },
    });
  }

  if (err.status === 503) {
    res.status(err.status).json({
      success: false,
      message: "Service Unavailable",
      errors: { message: err.message },
    });
  }

  if (err.status === 504) {
    res.status(err.status).json({
      success: false,
      message: " Gateway Timeout.",
      errors: { message: err.message },
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: "server side error",
    errors: { message: err.message },
  });
});

module.exports = app;
