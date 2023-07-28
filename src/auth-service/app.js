require("module-alias/register");
const log4js = require("log4js");
require("app-module-path").addPath(__dirname);
const express = require("express");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const mongoose = require("mongoose");
const routes = require("@routes/index");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- app entry`);
const { mongodb } = require("@config/dbConnection");
mongodb;
const { logText, logObject } = require("@utils/log");
require("@config/firebase-admin");

const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const passport = require("passport");

const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

const app = express();

const options = { mongooseConnection: mongoose.connection };

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
}

if (isDev) {
  app.use(morgan("dev"));
}

app.use(passport.initialize());

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
// app.use(bindCurrentNamespace);

/****** the V1 endpoints ****************/
app.use("/api/v1/users/networks", routes.v1.networks);
app.use("/api/v1/users/permissions", routes.v1.permissions);
app.use("/api/v1/users/favorites", routes.v1.favorites);
app.use("/api/v1/users/roles", routes.v1.roles);
app.use("/api/v1/users/inquiries", routes.v1.inquiries);
app.use("/api/v1/users/candidates", routes.v1.requests);
app.use("/api/v1/users/defaults", routes.v1.defaults);
app.use("/api/v1/users/tokens", routes.v1.tokens);
app.use("/api/v1/users/clients", routes.v1.clients);
app.use("/api/v1/users/scopes", routes.v1.scopes);
app.use("/api/v1/users/departments", routes.v1.departments);
app.use("/api/v1/users/groups", routes.v1.groups);
app.use("/api/v1/users/locationHistory", routes.v1.locationHistory);
app.use("/api/v1/users", routes.v1.users);

/****** the V2 endpoints ****************/
app.use("/api/v2/users/networks", routes.v2.networks);
app.use("/api/v2/users/permissions", routes.v2.permissions);
app.use("/api/v2/users/favorites", routes.v2.favorites);
app.use("/api/v2/users/roles", routes.v2.roles);
app.use("/api/v2/users/inquiries", routes.v2.inquiries);
app.use("/api/v2/users/candidates", routes.v2.requests);
app.use("/api/v2/users/defaults", routes.v2.defaults);
app.use("/api/v2/users/tokens", routes.v2.tokens);
app.use("/api/v2/users/departments", routes.v2.departments);
app.use("/api/v2/users/groups", routes.v2.groups);
app.use("/api/v2/users/locationHistory", routes.v2.locationHistory);
app.use("/api/v2/users", routes.v2.users);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
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
    logger.error(`bad request error --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "bad request error",
      errors: { message: err.message },
    });
  } else if (err.status === 401) {
    logger.error(`Unauthorized --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Unauthorized",
      errors: { message: err.message },
    });
  } else if (err.status === 403) {
    logger.error(`Forbidden --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Forbidden",
      errors: { message: err.message },
    });
  } else if (err.status === 500) {
    logger.error(`Internal Server Error --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
    });
  } else if (err.status === 502) {
    logger.error(`Bad Gateway --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Bad Gateway",
      errors: { message: err.message },
    });
  } else if (err.status === 503) {
    logger.error(`Service Unavailable --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: "Service Unavailable",
      errors: { message: err.message },
    });
  } else if (err.status === 504) {
    logger.error(`Gateway Timeout. --- ${err.message}`);
    res.status(err.status).json({
      success: false,
      message: " Gateway Timeout.",
      errors: { message: err.message },
    });
  } else {
    logger.error(`Internal Server Error --- ${err.message}`);
    logObject("Internal Server Error", err);
    res.status(err.status || 500).json({
      success: false,
      message: "Internal Server Error - app entry",
      errors: { message: err.message },
    });
  }
});

module.exports = app;
