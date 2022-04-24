var express = require("express");
var path = require("path");
var logger = require("morgan");
const dotenv = require("dotenv");
var bodyParser = require("body-parser");
dotenv.config();
require("./config/database");
var cookieParser = require("cookie-parser");

const responseTime = require("response-time");

var api = require("./routes/api");
dotenv.config();
const { mongodb } = require("./config/database");
mongodb;
var app = express();

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/data", api);

app.use(responseTime);

app.use(function (req, res, next) {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
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
