var express = require('express');
var path = require('path');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var mongoose = require("mongoose");
const config = require('./config/constants');

var api = require("./routes/api");

const dbURI = config.MONGO_URL;
const db = mongoose.connection;

var app = express();

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/', api)

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.json({ error: err })
});

//connection to local db and other databases
mongoose.connect(process.env.MONGOLAB_URI || dbURI);

//when there is an error
db.on("error", error => {
  console.log("database connection error" + error);
});

//after a disconnection
db.on("disconnected", () => { });

// //when nodejs stops
process.on("unhandledRejection", (reason, p) => {
  console.log("Unhandled Rejection at: Promise", p, "reason:", reason);
  db.close(() => {
    console.log("mongoose is disconnected through the app");
    process.exit(0);
  });
});


module.exports = app;
