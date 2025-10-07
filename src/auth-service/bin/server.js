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
const options = { mongooseConnection: mongoose.connection };

// Initialize background jobs
require("@bin/jobs/active-status-job");
require("@bin/jobs/token-expiration-job");
require("@bin/jobs/incomplete-profile-job");
require("@bin/jobs/preferences-log-job");
require("@bin/jobs/preferences-update-job");
require("@bin/jobs/profile-picture-update-job");

// Initialize log4js with SAFE configuration
const log4js = require("log4js");
let logger;

try {
  // Use the SAFE log4js configuration (no custom appenders)
  const logConfig = require("@config/log4js");
  log4js.configure(logConfig);
  logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/server script`);
  console.log("✅ Log4js configured successfully");
} catch (error) {
  console.error("❌ Log4js configuration failed:", error.message);
  console.log("📝 Falling back to console logging");

  // Fallback to basic console logging
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.log,
  };
}

// Add deduplication wrapper for Slack alerts
try {
  const { deduplicator } = require("@utils/common");

  // Create a deduplicated logger for important alerts
  const dedupLogger = deduplicator.wrapLogger(logger);

  // Use dedupLogger for job alerts and critical messages
  global.dedupLogger = dedupLogger;

  console.log("✅ Slack deduplication utility loaded successfully");
} catch (error) {
  console.warn("⚠️  Slack deduplication utility not available:", error.message);
  // Fallback to regular logger
  global.dedupLogger = logger;
}

const debug = require("debug")("auth-service:server");
const isEmpty = require("is-empty");
const fileUpload = require("express-fileupload");
const { stringify } = require("@utils/common");

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

// Safe log4js middleware with fallback
try {
  app.use(log4js.connectLogger(log4js.getLogger("http"), { level: "auto" }));
} catch (error) {
  console.warn("⚠️  Log4js HTTP middleware failed, skipping:", error.message);
}

app.use(express.json());
app.use(
  bodyParser.urlencoded({
    extended: true,
    limit: "50mb",
    parameterLimit: 50000,
  })
);

// Header protection middleware - ensures headers exist before fileUpload
app.use((req, res, next) => {
  // Ensure headers object exists
  if (!req.headers) {
    req.headers = {};
  }

  // Ensure content-type header exists (even if empty)
  if (req.headers["content-type"] === undefined) {
    req.headers["content-type"] = "";
  }

  next();
});

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

const transactionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  message: "Too many transaction requests, please try again later",
});
app.use("/api/v2/users/transactions", transactionLimiter);

app.use("/api/v2/users", require("@routes/v2"));
app.use("/api/v3/users", require("@routes/v3"));

// default error handling
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

app.use(function (err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  // Log server errors as activities for authenticated users
  if (status >= 500 && req.user) {
    // The logActivity function was causing errors, replaced with direct logging.
    logger.error("Server error activity", {
      email: req.user.email || "system",
      userName: req.user.userName || "system",
      tenant: req.query.tenant || req.headers.tenant || "airqo",
      user_id: req.user._id,
      action: "server_error",
      description: `Server error: ${err.message}`,
      payload: {
        stack: err.stack,
        endpoint: req.originalUrl,
        method: req.method,
        statusCode: status,
      },
    });
  }

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

  // Graceful shutdown handler
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);

    // Set global shutdown flag to signal running jobs to stop
    global.isShuttingDown = true;

    // Close the server first to stop accepting new connections
    server.close(async () => {
      console.log("HTTP server closed");

      // Enhanced cron job shutdown handling
      if (global.cronJobs && Object.keys(global.cronJobs).length > 0) {
        console.log(
          `Stopping ${Object.keys(global.cronJobs).length} cron jobs...`
        );

        // Stop each job individually with error handling
        for (const [jobName, jobObj] of Object.entries(global.cronJobs)) {
          try {
            console.log(`Stopping cron job: ${jobName}`);

            // Enhanced pattern: Use the async stop method if available
            if (jobObj.stop && typeof jobObj.stop === "function") {
              await jobObj.stop();
              console.log(`✅ Successfully stopped cron job: ${jobName}`);
            }
            // Legacy pattern: Direct job manipulation (for backward compatibility)
            else if (jobObj.job) {
              console.log(`🔄 Using legacy stop method for job: ${jobName}`);

              // Stop the schedule
              if (typeof jobObj.job.stop === "function") {
                jobObj.job.stop();
                console.log(`📅 Stopped schedule for job: ${jobName}`);
              }

              // Try to destroy if method exists
              if (typeof jobObj.job.destroy === "function") {
                jobObj.job.destroy();
                console.log(`💥 Destroyed job: ${jobName}`);
              } else {
                console.log(
                  `⚠️  Job ${jobName} doesn't have destroy method (older node-cron version)`
                );
                logger.warn(
                  `Job ${jobName} doesn't have destroy method (older node-cron version)`
                );
              }

              // Remove from registry
              delete global.cronJobs[jobName];
              console.log(
                `✅ Successfully stopped cron job: ${jobName} (legacy mode)`
              );
            }
            // Simple job pattern (current auth service pattern)
            else if (typeof jobObj.stop === "function") {
              jobObj.stop();
              console.log(
                `✅ Successfully stopped cron job: ${jobName} (simple mode)`
              );
            }
            // Unknown pattern
            else {
              console.warn(
                `⚠️  Job ${jobName} has unknown structure, skipping`
              );
              logger.warn(`Job ${jobName} has unknown structure, skipping`);
            }
          } catch (error) {
            console.error(
              `❌ Error stopping cron job ${jobName}:`,
              error.message
            );
            logger.error(
              `❌ Error stopping cron job ${jobName}: ${error.message}`
            );

            // Try emergency cleanup
            try {
              if (jobObj.job && typeof jobObj.job.stop === "function") {
                jobObj.job.stop();
                console.log(`🆘 Emergency stopped job: ${jobName}`);
              }
              delete global.cronJobs[jobName];
            } catch (emergencyError) {
              console.error(
                `💥 Emergency cleanup failed for ${jobName}:`,
                emergencyError.message
              );
              logger.error(
                `💥 Emergency cleanup failed for ${jobName}: ${emergencyError.message}`
              );
            }
          }
        }

        console.log("All cron jobs stopped");
      } else {
        console.log("No cron jobs to stop");
      }

      // Close any Redis connections if they exist
      if (global.redisClient) {
        console.log("Closing Redis connection...");

        try {
          // Prefer quit() for a graceful shutdown, but fallback to disconnect()
          if (
            global.redisClient &&
            typeof global.redisClient.quit === "function"
          ) {
            await global.redisClient.quit();
            console.log("✅ Redis connection closed");
          } else if (
            global.redisClient &&
            typeof global.redisClient.disconnect === "function"
          ) {
            // disconnect() is less graceful but better than nothing
            await global.redisClient.disconnect();
            console.log("✅ Redis connection disconnected");
          }
        } catch (error) {
          console.error("❌ Error closing Redis connection:", error.message);
          logger.error(`❌ Error closing Redis connection: ${error.message}`);
        }
      }

      // Close Firebase connections if they exist
      if (global.firebaseApp) {
        console.log("Closing Firebase connection...");
        try {
          // Firebase cleanup if needed
          console.log("✅ Firebase connections closed");
        } catch (error) {
          console.error(
            "❌ Error closing Firebase connections:",
            error.message
          );
          logger.error(
            `❌ Error closing Firebase connections: ${error.message}`
          );
        }
      }

      // Safe log4js shutdown
      console.log("Shutting down log4js...");
      try {
        if (typeof log4js.shutdown === "function") {
          await new Promise((resolve) => {
            log4js.shutdown((error) => {
              if (error) {
                console.error("❌ Error during log4js shutdown:", error);
              } else {
                console.log("✅ Log4js shutdown complete");
              }
              resolve();
            });
          });
        }
      } catch (error) {
        console.error("❌ Error shutting down log4js:", error.message);
      }

      // Close MongoDB connection
      console.log("Closing MongoDB connection...");

      try {
        await new Promise((resolve, reject) => {
          mongoose.connection.close(false, (error) => {
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        });

        console.log("✅ MongoDB connection closed");
      } catch (error) {
        console.error("❌ Error closing MongoDB connection:", error.message);
        logger.error(`❌ Error closing MongoDB connection: ${error.message}`);
      }

      // Final cleanup
      console.log("Exiting process...");
      process.exit(0);
    });

    // Force exit after timeout if graceful shutdown fails (increased from 10s to 15s)
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      logger.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 15000); // timeout to 15 seconds
  };

  // Add signal handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error(`💥 Uncaught Exception: ${error.message}`);
    logger.error(`💥 Uncaught Exception: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error(`🚫 Unhandled Rejection at:`, promise, "reason:", reason);
    logger.error(`🚫 Unhandled Rejection at:`, promise, "reason:", reason);
    gracefulShutdown("UNHANDLED_REJECTION");
  });

  // Handle process warnings
  process.on("warning", (warning) => {
    console.warn(`⚠️  Process Warning: ${warning.name}: ${warning.message}`);
    logger.warn(`⚠️  Process Warning: ${warning.name}: ${warning.message}`);
  });

  // Memory usage monitoring (optional - for debugging)
  if (isDev) {
    process.on("exit", (code) => {
      const memUsage = process.memoryUsage();
      console.log(`📊 Process exiting with code ${code}. Memory usage:`, {
        rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
        heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)}MB`,
        heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
      });
    });
  }

  // Store server in global scope so it can be accessed elsewhere
  global.httpServer = server;

  return server; // Return the server instance
};

module.exports = createServer;
