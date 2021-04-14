var express = require("express");
var path = require("path");
var logger = require("morgan");
const dotenv = require("dotenv");
var bodyParser = require("body-parser");
dotenv.config();
require("app-module-path").addPath(__dirname);
var cookieParser = require("cookie-parser");
var api = require("./routes/api");
const { mongodb } = require("./config/database");
const { kafkaConsumer } = require("./controllers/kafka-consumer");

mongodb;
kafkaConsumer;

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
// app.use(bindCurrentNamespace);

app.use("/api/v1/devices/", api);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  // render the error page
  // res.status(err.status || 500);
  res.status(err.status || 500).json({
    success: false,
    message: "this endpoint does not exist",
    error: err.message,
  });
  // res.render("error");
});

module.exports = app;
