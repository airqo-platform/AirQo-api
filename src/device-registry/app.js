require("module-alias/register");
const log4js = require("log4js");
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
dotenv.config();
require("app-module-path").addPath(__dirname);
const cookieParser = require("cookie-parser");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- app entry`);
const { mongodb } = require("@config/database");
mongodb;
const routes = require("@routes");
// const moesif = require("moesif-nodejs");
const compression = require("compression");
const { logObject } = require("./utils/log");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const mongoose = require("mongoose");
const morgan = require("morgan");
const helmet = require("helmet");
const passport = require("passport");
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";
const options = { mongooseConnection: mongoose.connection };
const app = express();

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    store: new MongoStore(options),
    resave: false,
    saveUninitialized: false,
  })
);

if (isProd) {
  app.use(compression());
  app.use(helmet());
} else if (isDev) {
  app.use(morgan("dev"));
} else {
  app.use(compression());
}

app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);

// const moesifMiddleware = moesif({
//   applicationId: constants.MOESIF_APPLICATION_ID,
//   identifyUser: function(req, res) {
//     return req.user ? req.user.id : undefined;
//   },
// });

// app.use(moesifMiddleware);

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

/****** the V1 endpoints ****************/
app.use("/api/v1/devices/cohorts", routes.v1.cohorts);
app.use("/api/v1/devices/grids", routes.v1.grids);
app.use("/api/v1/devices/activities", routes.v1.activities);
app.use("/api/v1/devices/airqlouds", routes.v1.airqlouds);
app.use("/api/v1/devices/sites", routes.v1.sites);
app.use("/api/v1/devices/events", routes.v1.events);
app.use("/api/v1/devices/locations", routes.v1.locations);
app.use("/api/v1/devices/photos", routes.v1.photos);
app.use("/api/v1/devices/tips", routes.v1.tips);
app.use("/api/v1/devices/kya", routes.v1.kya);
app.use("/api/v1/devices/sensors", routes.v1.sensors);
app.use("/api/v1/devices", routes.v1.devices);

/****** the V2 endpoints ****************/
app.use("/api/v2/devices/cohorts", routes.v2.cohorts);
app.use("/api/v2/devices/grids", routes.v2.grids);
app.use("/api/v2/devices/activities", routes.v2.activities);
app.use("/api/v2/devices/airqlouds", routes.v2.airqlouds);
app.use("/api/v2/devices/sites", routes.v2.sites);
app.use("/api/v2/devices/events", routes.v2.events);
app.use("/api/v2/devices/measurements", routes.v2.measurements);
app.use("/api/v2/devices/locations", routes.v2.locations);
app.use("/api/v2/devices/photos", routes.v2.photos);
app.use("/api/v2/devices/tips", routes.v2.tips);
app.use("/api/v2/devices/kya", routes.v2.kya);
app.use("/api/v2/devices/sensors", routes.v2.sensors);
app.use("/api/v2/devices", routes.v2.devices);

app.use(function(req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function(err, req, res, next) {
  if (err.status === 404) {
    logger.error(
      `this endpoint does not exist --- ${err.message} --- path: ${
        req.originalUrl ? req.originalUrl : ""
      }`
    );
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
    logObject("err", err);
    logger.error(`server side error--- ${err.message}`);
    res.status(err.status || 500).json({
      success: false,
      message: "server side error",
      errors: { message: err.message },
    });
  }
});

module.exports = app;
