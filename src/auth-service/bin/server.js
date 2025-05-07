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
const log4js = require("log4js");
const debug = require("debug")("auth-service:server");
const isEmpty = require("is-empty");
const { stringify } = require("@utils/common");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");

// Initialize logger
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/server script`
);

// Safe require function to prevent crashes from individual module failures
function safeRequire(modulePath, description) {
  try {
    return require(modulePath);
  } catch (error) {
    logger.error(
      `Failed to load ${description || modulePath}: ${error.message}`
    );
    console.error(
      `⚠️ Warning: Failed to load ${description || modulePath}: ${
        error.message
      }`
    );
    return null;
  }
}

// Connect to MongoDB
connectToMongoDB();

// Safely require modules
safeRequire("@config/firebase-admin", "Firebase Admin");

// Safely require job modules
safeRequire("@bin/jobs/initialize-scopes", "Scope initialization job");
safeRequire("@bin/jobs/active-status-job", "Active status job");
safeRequire("@bin/jobs/token-expiration-job", "Token expiration job");
safeRequire("@bin/jobs/incomplete-profile-job", "Incomplete profile job");
safeRequire("@bin/jobs/preferences-log-job", "Preferences log job");
safeRequire("@bin/jobs/preferences-update-job", "Preferences update job");
// safeRequire("@bin/jobs/update-user-activities-job", "User activities update job");
safeRequire(
  "@bin/jobs/profile-picture-update-job",
  "Profile picture update job"
);

// Other packages
const morgan = safeRequire("morgan", "Morgan logger");
const compression = safeRequire("compression", "Compression middleware");
const helmet = safeRequire("helmet", "Helmet security middleware");
const passport = safeRequire("passport", "Passport authentication");
const rateLimit = safeRequire("express-rate-limit", "Rate limiter");
const fileUpload = safeRequire("express-fileupload", "File upload middleware");

// Environment checks
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";

// Session secret check
if (isEmpty(constants.SESSION_SECRET)) {
  throw new Error("SESSION_SECRET environment variable not set");
}

// Configure sessions
const options = { mongooseConnection: mongoose.connection };
app.use(
  session({
    secret: constants.SESSION_SECRET,
    store: new MongoStore(options),
    resave: false,
    saveUninitialized: false,
  })
);

// Setup body parsers
app.use(bodyParser.json({ limit: "50mb" }));
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50000,
  })
);

// Apply environment-specific middleware
if (isProd && compression) {
  app.use(compression());
}
if (isProd && helmet) {
  app.use(helmet());
}
if (isDev && morgan) {
  app.use(morgan("dev"));
}

// Initialize passport if available
if (passport) {
  app.use(passport.initialize());
}

// Standard middlewares
app.use(cookieParser());
app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
app.use(express.json());

// File upload configuration
if (fileUpload) {
  app.use(
    fileUpload({
      createParentPath: true,
      limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
      },
      useTempFiles: true,
      tempFileDir: "/tmp/",
      debug: isDev,
      abortOnLimit: true,
    })
  );
}

// Static file serving
app.use(express.static(path.join(__dirname, "public")));

// Rate limiting
if (rateLimit) {
  const transactionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: "Too many transaction requests, please try again later",
  });
  app.use("/api/v2/users/transactions", transactionLimiter);
}

// Routes
try {
  app.use("/api/v2/users", require("@routes/v2"));
} catch (error) {
  logger.error(`Failed to load API routes: ${error.message}`);
  console.error(
    `⚠️ Critical error: Failed to load API routes: ${error.message}`
  );
  // Add a fallback route that returns a service unavailable message
  app.use("/api/v2/users", (req, res) => {
    res.status(503).json({
      success: false,
      message:
        "API service is temporarily unavailable. Please try again later.",
    });
  });
}

// 404 handler
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// Main error handler
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
    } else if (err.code && err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message: "File too large",
        errors: { message: "File size cannot be larger than 50MB" },
      });
    } else if (err.code && err.code === "ENOENT") {
      res.status(400).json({
        success: false,
        message: "File upload error",
        errors: { message: "Unable to find the uploaded file" },
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
