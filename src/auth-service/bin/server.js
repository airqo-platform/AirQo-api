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
const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const passport = require("passport");
const {
  logObject,
  logText,
  logElement,
  HttpError,
  extractErrorsFromRequest,
} = require("@utils/shared");
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";
const rateLimit = require("express-rate-limit");
const log4js = require("log4js");
const debug = require("debug")("auth-service:server");
const isEmpty = require("is-empty");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- bin/server script`
);
const fileUpload = require("express-fileupload");
const { stringify } = require("@utils/common");
const messagingService =
  require("@utils/messaging/messaging-service").getInstance();

// Connect to MongoDB - wrap in try/catch to prevent startup failure
try {
  connectToMongoDB();
  logger.info("MongoDB connection initialized");
} catch (error) {
  logger.error(`Failed to initialize MongoDB connection: ${error.message}`);
  // Continue execution - the connection might recover
}

// Load additional configurations with error handling
try {
  require("@config/firebase-admin");
} catch (error) {
  logger.error(`Failed to initialize Firebase admin: ${error.message}`);
  // Continue execution
}

// Load background jobs with error handling
const loadBackgroundJobs = () => {
  try {
    require("@bin/jobs/active-status-job");
    require("@bin/jobs/token-expiration-job");
    require("@bin/jobs/incomplete-profile-job");
    require("@bin/jobs/preferences-log-job");
    require("@bin/jobs/preferences-update-job");
    // require("@bin/jobs/update-user-activities-job");
    require("@bin/jobs/profile-picture-update-job");
    logger.info("Background jobs loaded");
  } catch (error) {
    logger.error(`Failed to load background jobs: ${error.message}`);
    // Continue execution
  }
};

// Load background jobs but don't block server startup
setTimeout(loadBackgroundJobs, 100);

if (isEmpty(constants.SESSION_SECRET)) {
  logger.error("SESSION_SECRET environment variable not set");
  // Use a default in development to avoid crash
  if (isDev) {
    process.env.SESSION_SECRET = "dev-secret-do-not-use-in-production";
  } else {
    throw new Error("SESSION_SECRET environment variable not set");
  }
}

// MongoDB store options with error handling
let options;
try {
  options = { mongooseConnection: mongoose.connection };
} catch (error) {
  logger.error(`Failed to create MongoDB store options: ${error.message}`);
  options = {}; // Use empty options as fallback
}

// Express Middlewares
// Wrap middleware setup in try/catch blocks to prevent startup failures
try {
  app.use(
    session({
      secret: constants.SESSION_SECRET || process.env.SESSION_SECRET,
      store: new MongoStore(options),
      resave: false,
      saveUninitialized: false,
    })
  ); // session setup
} catch (error) {
  logger.error(`Failed to initialize session middleware: ${error.message}`);
  // Use a memory store as fallback
  app.use(
    session({
      secret:
        constants.SESSION_SECRET ||
        process.env.SESSION_SECRET ||
        "fallback-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
}

// Add basic middlewares with error handling
try {
  app.use(bodyParser.json({ limit: "50mb" })); // JSON body parser

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

  // Static file serving
  app.use(express.static(path.join(__dirname, "public")));
} catch (error) {
  logger.error(`Failed to initialize core middlewares: ${error.message}`);
  // Continue with reduced functionality
}

// Rate limiting
try {
  const transactionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: "Too many transaction requests, please try again later",
  });
  app.use("/api/v2/users/transactions", transactionLimiter);
} catch (error) {
  logger.error(`Failed to initialize rate limiter: ${error.message}`);
  // Continue without rate limiting
}

// Routes
try {
  app.use("/api/v2/users", require("@routes/v2"));
} catch (error) {
  logger.error(`Failed to load routes: ${error.message}`);
  // Add a fallback route handler
  app.use("/api/v2/users", (req, res) => {
    res.status(503).json({
      success: false,
      message: "Service temporarily unavailable",
      errors: { message: "Routes failed to load" },
    });
  });
}

// Basic health check endpoint that's always accessible
app.get("/api/health", (req, res) => {
  try {
    res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (error) {
    console.error("Error in health endpoint:", error);
    res.status(500).json({ status: "error", message: "Internal server error" });
  }
});

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
  console.log("Creating HTTP server...");

  // Try to use the configured port, with fallback options if unavailable
  const primaryPort = normalizePort(
    process.env.PORT || constants.PORT || "3000"
  );
  const fallbackPort = primaryPort + 1;

  let port = primaryPort;
  app.set("port", port);

  const server = http.createServer(app);

  // Add explicit error handler for server creation
  try {
    // Log immediately when attempting to listen
    console.log(`Attempting to listen on port ${port}...`);

    server.on("error", (error) => {
      console.error(`Server error on port ${port}: ${error.message}`);

      if (error.syscall !== "listen") {
        throw error;
      }

      var bind = typeof port === "string" ? "Pipe " + port : "Port " + port;

      // Handle specific listen errors
      switch (error.code) {
        case "EACCES":
          console.error(bind + " requires elevated privileges");
          logger.error(bind + " requires elevated privileges");

          // Try alternate port
          if (port === primaryPort) {
            console.log(`Trying alternate port ${fallbackPort}...`);
            port = fallbackPort;
            app.set("port", port);
            setTimeout(() => {
              server.listen(port);
            }, 1000);
          }
          break;

        case "EADDRINUSE":
          console.error(bind + " is already in use");
          logger.error(bind + " is already in use");

          // Try alternate port
          if (port === primaryPort) {
            console.log(`Trying alternate port ${fallbackPort}...`);
            port = fallbackPort;
            app.set("port", port);
            setTimeout(() => {
              server.listen(port);
            }, 1000);
          }
          break;

        default:
          logger.error(`Unknown server error: ${error.message}`);
      }
    });

    server.on("listening", () => {
      const actualPort = server.address().port;
      logText(`Server is running on port: ${actualPort}`);
      console.log(
        `The server is running on port ${actualPort} in the ${
          process.env.NODE_ENV || "production"
        } environment`
      );
      var addr = server.address();
      var bind =
        typeof addr === "string" ? "pipe " + addr : "port " + addr.port;
      debug("Listening on " + bind);

      // Log broker status if available
      try {
        if (messagingService && messagingService.initialized) {
          const activeBroker = messagingService.getActiveBrokerType();
          logger.info(`🌟 Active message broker: ${activeBroker || "none"}`);
        }
      } catch (error) {
        logger.error(`Error getting message broker status: ${error.message}`);
      }
    });

    // Start listening
    server.listen(port);
  } catch (error) {
    console.error(`Failed to initialize server: ${error.message}`);
    logger.error(`Failed to initialize server: ${error.message}`);

    // Try to recover by using a different port
    try {
      console.log(`Attempting recovery on port ${fallbackPort}...`);
      port = fallbackPort;
      app.set("port", port);
      server.listen(port);
    } catch (recoveryError) {
      logger.error(`Failed to recover server: ${recoveryError.message}`);
      // Return a non-operational server, but don't crash
    }
  }

  // Graceful shutdown handling
  const gracefulShutdown = async () => {
    logger.info("Received kill signal, shutting down gracefully");

    // First attempt to close the message service
    if (messagingService && messagingService.initialized) {
      try {
        logger.info("Shutting down message consumer...");
        await messagingService.shutdown();
        logger.info("Message consumer shut down successfully");
      } catch (error) {
        logger.error(`Error shutting down message consumer: ${error.message}`);
      }
    }

    // Now close the HTTP server
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });

    // Force close if graceful shutdown fails
    setTimeout(() => {
      logger.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 10000);
  };

  // Listen for termination signals
  process.on("SIGTERM", gracefulShutdown);
  process.on("SIGINT", gracefulShutdown);

  return server;
};

module.exports = createServer;
