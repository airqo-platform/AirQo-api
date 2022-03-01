require("app-module-path").addPath(__dirname);
const express = require("express");
const path = require("path");
const logger = require("morgan");
const dotenv = require("dotenv");
dotenv.config();
const cookieParser = require("cookie-parser");
const bodyParser = require("body-parser");
const apiV1 = require("./routes/api-v1");
const apiV2 = require("./routes/api-v2");
const { mongodb } = require("./config/dbConnection");
mongodb;

const app = express();

app.use(logger("dev"));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// app.use(bindCurrentNamespace);

app.use("/api/v1/users", apiV1);
app.use("/api/v2/users", apiV2);

require("./config/firebase-admin");

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
