const http = require("http");
const express = require("express");
const constants = require("@config/constants");
const path = require("path");
const cookieParser = require("cookie-parser");
const app = express();
const bodyParser = require("body-parser");
const session = require("express-session");
const MongoStore = require("connect-mongo")(session);
const mongoose = require("mongoose");
const { connectToMongoDB } = require("@config/database");
connectToMongoDB();
require("@config/firebase-admin");
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const passport = require("passport");
const { HttpError } = require("@utils/errors");
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";
const options = { mongooseConnection: mongoose.connection };
require("@bin/jobs/active-status-job");
require("@bin/jobs/token-expiration-job");
require("@bin/jobs/incomplete-profile-job");
require("@bin/jobs/preferences-log-job");
require("@bin/jobs/preferences-update-job");
const log4js = require("log4js");
const debug = require("debug")("auth-service:server");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/server script`
);
const { logText, logObject } = require("@utils/log");
const fileUpload = require("express-fileupload");
const stringify = require("@utils/stringify");

if (isEmpty(constants.SESSION_SECRET)) {
  throw new Error("SESSION_SECRET environment variable not set");
}

// Express Middlewares
app.use(
  session({
    secret: constants.SESSION_SECRET,
    store: new MongoStore(options),
    resave: false,
    saveUninitialized: false,
  })
); // session setup

app.use(fileUpload());
app.use(bodyParser.json({ limit: "50mb" })); // JSON body parser
// Other common middlewares: morgan, cookieParser, passport, etc.
if (isProd) {
  app.use(compression());
  app.use(helmet());
}

if (isDev) {
  app.use(morgan("dev"));
}

app.use(passport.initialize());

app.use(cookieParser());
app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50000,
  })
);

// Static file serving
app.use(express.static(path.join(__dirname, "public")));

// app.use("/api/v1/users", require("@routes/v1"));
app.use("/api/v2/users", require("@routes/v2"));

// default error handling
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (!res.headersSent) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    } else if (err instanceof SyntaxError) {
      res.status(400).json({
        success: false,
        message: "Invalid JSON",
        errors: { message: "Invalid JSON" },
      });
    } else if (err.status === 404) {
      res.status(err.status).json({
        success: false,
        message: "This endpoint does not exist",
        errors: { message: err.message },
      });
    } else if (err.status === 400) {
      logger.error(`Bad request error --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Bad request error",
        errors: { message: err.message },
      });
    } else if (err.status === 401) {
      logger.error(`Unauthorized --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Unauthorized",
        errors: { message: err.message },
      });
    } else if (err.status === 403) {
      logger.error(`Forbidden --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Forbidden",
        errors: { message: err.message },
      });
    } else if (err.status === 500) {
      // logger.error(`🐛🐛 Internal Server Error --- ${stringify(err)}`);
      // logger.error(`Stack Trace: ${err.stack}`);
      logObject("the error", err);
      res.status(err.status).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    } else if (err.status === 502 || err.status === 503 || err.status === 504) {
      logger.error(`${err.message} --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: err.message,
        errors: { message: err.message },
      });
    } else {
      logger.error(`🐛🐛 Internal Server Error --- ${stringify(err)}`);
      logObject("Internal Server Error", err);
      logger.error(`Stack Trace: ${err.stack}`);
      res.status(err.status || err.statusCode || 500).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    }
  } else {
    logger.error(
      `🍻🍻 HTTP response already sent to the client -- ${stringify(err)}`
    );
  }
});

const normalizePort = (val) => {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    return val;
  }

  if (port >= 0) {
    return port;
  }

  return false;
};

const createServer = () => {
  const port = normalizePort(process.env.PORT || "3000");
  app.set("port", port);

  const server = http.createServer(app);
  server.listen(port);

  server.on("error", (error) => {
    if (error.syscall !== "listen") {
      throw error;
    }

    var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
      case "EACCES":
        console.error(bind + " requires elevated privileges");
        process.exit(1);
        break;
      case "EADDRINUSE":
        console.error(bind + " is already in use");
        process.exit(1);
        break;
      default:
        throw error;
    }
  });

  let ENV = "";
  if (isEmpty(process.env.NODE_ENV)) {
    ENV = "production";
  } else {
    ENV = process.env.NODE_ENV;
  }

  server.on("listening", () => {
    logText(`server is running on port: ${constants.PORT}`);
    console.log(`The server is running on the ${ENV} environment`);
    var addr = server.address();
    var bind = typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
    debug("Listening on " + bind);
  });
};

module.exports = createServer;
