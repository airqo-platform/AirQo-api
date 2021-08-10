require("app-module-path").addPath(__dirname);
var express = require("express");
var path = require("path");
var logger = require("morgan");
const dotenv = require("dotenv");
dotenv.config();
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var api = require("./routes/api");
const { mongodb } = require("./config/dbConnection");
mongodb;

var app = express();

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// app.use(bindCurrentNamespace);

app.use("/api/v1/users", api);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (err.status === 404) {
    res.status(err.status).json({
      success: false,
      message: "this endpoint does not exist",
      error: err.message,
    });
  }

  if (err.status === 400) {
    res.status(err.status).json({
      success: false,
      message: "bad request error",
      error: err.message,
    });
  }

  if (err.status === 401) {
    res.status(err.status).json({
      success: false,
      message: "Unauthorized",
      error: err.message,
    });
  }

  if (err.status === 403) {
    res.status(err.status).json({
      success: false,
      message: "Forbidden",
      error: err.message,
    });
  }

  if (err.status === 500) {
    res.status(err.status).json({
      success: false,
      message: "Internal Server Error",
      error: err.message,
    });
  }

  if (err.status === 502) {
    res.status(err.status).json({
      success: false,
      message: "Bad Gateway",
      error: err.message,
    });
  }

  if (err.status === 503) {
    res.status(err.status).json({
      success: false,
      message: "Service Unavailable",
      error: err.message,
    });
  }

  if (err.status === 504) {
    res.status(err.status).json({
      success: false,
      message: " Gateway Timeout.",
      error: err.message,
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: "server side error",
    error: err.message,
  });
});

module.exports = app;
