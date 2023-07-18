require("module-alias/register");
const log4js = require("log4js");
var express = require("express");
var path = require("path");
const dotenv = require("dotenv");
dotenv.config();
const constants = require("@config/constants");

var cookieParser = require("cookie-parser");
const { mongodb } = require("./config/database");
mongodb;
const { logElement, logObject, logText } = require("@utils/log");
const routes = require("@routes");
var app = express();
const morgan = require("morgan");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- app entry`);
const bodyParser = require("body-parser");
const httpStatus = require("http-status");
const compression = require("compression");
const helmet = require("helmet");
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";
const isTest = process.env.NODE_ENV === "test";
app.use(bodyParser.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
  })
);
if (isProd) {
  app.use(compression());
  app.use(helmet());
}
if (isDev) {
  app.use(morgan("dev"));
}
if (isTest) {
  app.use(morgan("dev"));
}

app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

/****** the V1 endpoints ****************/
app.use("/api/v1/incentives/hosts", routes.v1.hosts);
app.use("/api/v1/incentives/transactions", routes.v1.transactions);

/****** the V2 endpoints ****************/
app.use("/api/v2/incentives/hosts", routes.v2.hosts);
app.use("/api/v2/incentives/transactions", routes.v2.transactions);

class CustomError extends Error {
  constructor(message, status = httpStatus.INTERNAL_SERVER_ERROR) {
    super(message);
    this.name = "CustomError";
    this.status = status;
  }

  toResponseObject() {
    return {
      success: false,
      message: "Internal Server Error",
      errors: { message: this.message },
      status: this.status,
    };
  }
}

// catch 404 and forward to errors handler
app.use(function (req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (err instanceof CustomError) {
    res.status(err.status).json(err.toResponseObject());
  }

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
      message: "bad request errors",
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

  logObject("the errors", err);
  res.status(err.status || 500).json({
    success: false,
    message: "General Server Side Error, check logs",
    errors: { message: err.message },
  });
});

module.exports = app;
