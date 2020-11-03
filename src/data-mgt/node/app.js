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

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500).json({
    success: false,
    message: "Server Error",
    error: err.message,
  });
});

module.exports = app;
