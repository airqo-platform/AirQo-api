var express = require("express");
var path = require("path");
const dotenv = require("dotenv");
dotenv.config();
var cookieParser = require("cookie-parser");
require("./config/database");
const middlewareConfig = require("./config/app.middleware");

var api_v1 = require("./routes/api-v1");
var api_v2 = require("./routes/api-v2");

var app = express();

middlewareConfig(app);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/incentives", api_v1);
app.use("/api/v2/incentives", api_v2);

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
