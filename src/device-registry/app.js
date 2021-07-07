var log4js = require("log4js");
var express = require("express");
var path = require("path");
var log = log4js.getLogger("app");

const dotenv = require("dotenv");
var bodyParser = require("body-parser");
dotenv.config();
require("app-module-path").addPath(__dirname);
var cookieParser = require("cookie-parser");
var api = require("./routes/api");
const { mongodb } = require("./config/database");

mongodb;

var app = express();

app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/devices/", api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// development error handler
// will print stacktrace
if (app.get("env") === "development") {
  app.use(function(err, req, res, next) {
    log.error("Something went wrong:", err);
    res.status(err.status || 500).json({
      success: false,
      message: `does this endpoint exist? -- ${err.message}`,
      error: err,
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  log.error("Something went wrong:", err);
  res.status(err.status || 500).json({
    success: false,
    message: `does this endpoint exist? -- ${err.message}`,
    error: {},
  });
});

module.exports = app;
