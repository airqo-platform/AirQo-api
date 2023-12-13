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
require("@bin/cronJob");
const log4js = require("log4js");
const debug = require("debug")("auth-service:server");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/server script`
);
const { logText, logObject } = require("@utils/log");
const fileUpload = require("express-fileupload");

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

app.use("/api/v1/users", require("@routes/v1"));
app.use("/api/v2/users", require("@routes/v2"));

// Error handling middleware
// catch 404 and forward to error handler
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  if (err instanceof HttpError) {
    // Handle HttpError
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  } else if (err.status === 404) {
    // Handle 404 Not Found
    res.status(err.status).json({
      success: false,
      message: "This endpoint does not exist",
      errors: { message: err.message },
    });
  } else if (err.status === 400) {
    // Handle other 400 Bad Request errors
    logger.error(`Bad request error --- ${JSON.stringify(err)}`);
    res.status(err.status).json({
      success: false,
      message: "Bad request error",
      errors: { message: err.message },
    });
  } else if (err.status === 401) {
    // Handle 401 Unauthorized
    logger.error(`Unauthorized --- ${JSON.stringify(err)}`);
    res.status(err.status).json({
      success: false,
      message: "Unauthorized",
      errors: { message: err.message },
    });
  } else if (err.status === 403) {
    // Handle 403 Forbidden
    logger.error(`Forbidden --- ${JSON.stringify(err)}`);
    res.status(err.status).json({
      success: false,
      message: "Forbidden",
      errors: { message: err.message },
    });
  } else if (err.status === 500) {
    // Handle 500 Internal Server Error
    logger.error(`Internal Server Error --- ${JSON.stringify(err)}`);
    logger.error(`Stack Trace: ${err.stack}`);
    res.status(err.status).json({
      success: false,
      message: "Internal Server Error",
      errors: { message: err.message },
    });
  } else if (err.status === 502 || err.status === 503 || err.status === 504) {
    // Handle other 5xx errors
    logger.error(`${err.message} --- ${JSON.stringify(err)}`);
    res.status(err.status).json({
      success: false,
      message: err.message,
      errors: { message: err.message },
    });
  } else {
    // Handle other uncaught errors
    logger.error(`Internal Server Error --- ${JSON.stringify(err)}`);
    logObject("Internal Server Error", err);
    logger.error(`Stack Trace: ${err.stack}`);
    res.status(err.status || 500).json({
      success: false,
      message: "Internal Server Error - app entry",
      errors: { message: err.message },
    });
  }
});

const normalizePort = (val) => {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
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
