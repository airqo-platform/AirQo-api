var express = require("express");
var path = require("path");
const dotenv = require("dotenv");
dotenv.config();
require("./config/database");
var cookieParser = require("cookie-parser");
const middlewareConfig = require("./config/app.middleware");

const responseTime = require("response-time");

var api = require("./routes/api");
dotenv.config();
var app = express();

middlewareConfig(app);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use("/api/v1/data", api);

app.use(responseTime);

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
    res.status(err.status || 500);
    res.render("error");
});

module.exports = { app: app };