var express = require("express");
var path = require("path");
const dotenv = require("dotenv");
dotenv.config();
var cookieParser = require("cookie-parser");
require("./config/database");
const middlewareConfig = require("./config/app.middleware");
const { logElement, logObject, logText } = require("./utils/log");

var api_v1 = require("./routes/api-v1");
var api_v2 = require("./routes/api-v2");

var app = express();

middlewareConfig(app);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/incentives", api_v1);
app.use("/api/v2/incentives", api_v2);

// catch 404 and forward to errors handler
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
