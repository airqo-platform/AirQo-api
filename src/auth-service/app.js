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
console.log = function () {};

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

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};

  res.status(err.status || 500).json({
    success: false,
    message:
      "this endpoint does not exist OR some request items are missing OR something went wrong during authentication",
    error: err.message,
    statusCode: err.statusCode,
  });
});

module.exports = app;
