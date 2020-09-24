require("@google-cloud/debug-agent").start();
var express = require("express");
var path = require("path");
var logger = require("morgan");
const dotenv = require("dotenv");
dotenv.config();
var cookieParser = require("cookie-parser");
var bodyParser = require("body-parser");
var mongoose = require("mongoose");
const config = require("./config/constants");

var api = require("./routes/api");

// DB connection
require("./config/dbConnection");

const {
  bindCurrentNamespace,
  setCurrentTenantId,
} = require("./config/storage");

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger("dev"));
app.use(bodyParser.json());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));
app.use(bindCurrentNamespace);

app.use("/api/v1/users", api);

// app.use((req, res, next) => {
//     //get current user from session or token
//     const user = req.user;
//     // Get current tenant from user here
//     // Make sure its a string
//     const tenantId = user.organization._id.toString();

//     setCurrentTenantId("tenantId", tenantId);
//     next();
// });

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

  // render the error page
  res.status(err.status || 500);
  res.json({ error: err });
});

module.exports = app;
