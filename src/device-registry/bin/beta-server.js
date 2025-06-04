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

// ========================================
// ENHANCED LOGGING SETUP WITH DEDUPLICATION
// ========================================
const log4js = require("log4js");
let logger, alertLoggers;

try {
  // Apply the enhanced log4js configuration
  const logConfig = require("@config/beta-log4js");
  log4js.configure(logConfig);

  // Create base logger for server operations
  logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/server`);

  console.log("✅ Enhanced log4js configured successfully");
} catch (error) {
  console.error("❌ Log4js configuration failed:", error.message);
  console.log("📝 Falling back to console logging");

  // Fallback logger
  logger = {
    info: console.log,
    error: console.error,
    warn: console.warn,
    debug: console.log,
  };
}

// Setup enhanced deduplication with specialized alert loggers
try {
  const { deduplicator } = require("@utils/common");

  // Create specialized alert loggers using the new categories
  alertLoggers = deduplicator.createAlertLoggers(log4js);

  // Setup global loggers for different use cases
  global.logger = logger; // Regular server logging
  global.alertLogger = alertLoggers.alerts; // Job alerts & monitoring (Slack)
  global.criticalLogger = alertLoggers.critical; // Critical errors (Slack)
  global.appLogger = alertLoggers.app; // Application logs (no Slack)

  // Legacy compatibility
  global.dedupLogger = alertLoggers.alerts;

  console.log(
    "✅ Enhanced Slack deduplication and alert loggers configured successfully"
  );

  // Log initial statistics
  setTimeout(() => {
    const stats = deduplicator.getStats();
    console.log("📊 [DEDUP] Initial deduplicator status:", stats);
  }, 5000);
} catch (error) {
  console.warn(
    "⚠️  Enhanced deduplication utility not available:",
    error.message
  );

  // Fallback to regular loggers
  global.logger = logger;
  global.alertLogger = logger;
  global.criticalLogger = logger;
  global.appLogger = logger;
  global.dedupLogger = logger;
}

// Run startup migrations
const runStartupMigrations = require("@bin/jobs/run-migrations");
runStartupMigrations().catch((error) => {
  // Use critical logger for startup failures
  global.criticalLogger.error(
    `💥 Failed to run startup migrations: ${error.message}`
  );
});

const morgan = require("morgan");
const compression = require("compression");
const helmet = require("helmet");
const isDev = process.env.NODE_ENV === "development";
const isProd = process.env.NODE_ENV === "production";
const options = { mongooseConnection: mongoose.connection };

const debug = require("debug")("device-service:server");
const isEmpty = require("is-empty");

const {
  logObject,
  logText,
  BadRequestError,
  HttpError,
} = require("@utils/shared");
const { stringify } = require("@utils/common");

// Initialize all background jobs
require("@bin/jobs/store-signals-job");
require("@bin/jobs/store-readings-job");
require("@bin/jobs/beta-check-network-status-job");
require("@bin/jobs/check-unassigned-devices-job");
require("@bin/jobs/check-active-statuses");
require("@bin/jobs/check-unassigned-sites-job");
require("@bin/jobs/check-duplicate-site-fields-job");
require("@bin/jobs/update-duplicate-site-fields-job");
require("@bin/jobs/health-tip-checker-job");

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

// Static file serving
app.use(express.static(path.join(__dirname, "public")));

// app.use("/api/v1/devices", require("@routes/v1"));
app.use("/api/v2/devices", require("@routes/v2"));

// default error handling
app.use((req, res, next) => {
  const err = new Error("Not Found");
  err.status = 404;
  next(err);
});

// ========================================
// ENHANCED ERROR HANDLING WITH PROPER CATEGORIZATION
// ========================================
app.use(function(err, req, res, next) {
  if (!res.headersSent) {
    if (err instanceof HttpError) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message,
        errors: err.errors,
      });
    } else if (err instanceof BadRequestError) {
      return res.status(err.statusCode).json({
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
      global.appLogger.error(`Bad request error --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Bad request error",
        errors: { message: err.message },
      });
    } else if (err.status === 401) {
      global.appLogger.error(`Unauthorized --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Unauthorized",
        errors: { message: err.message },
      });
    } else if (err.status === 403) {
      global.appLogger.error(`Forbidden --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: "Forbidden",
        errors: { message: err.message },
      });
    } else if (err.status === 500) {
      // Use critical logger for internal server errors (will alert in Slack)
      global.criticalLogger.error(
        `💥 Internal Server Error --- ${stringify(err)}`
      );
      logObject("the error", err);
      res.status(err.status).json({
        success: false,
        message: "Internal Server Error",
        errors: { message: err.message },
      });
    } else if (err.status === 502 || err.status === 503 || err.status === 504) {
      // Use critical logger for gateway/service errors
      global.criticalLogger.error(`🔴 ${err.message} --- ${stringify(err)}`);
      res.status(err.status).json({
        success: false,
        message: err.message,
        errors: { message: err.message },
      });
    } else {
      // Use critical logger for unexpected errors
      global.criticalLogger.error(`💥 Unexpected Error --- ${stringify(err)}`);
      logObject("Unexpected Error", err);
      global.criticalLogger.error(`Stack Trace: ${err.stack}`);
      res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: { message: err.message },
      });
    }
  } else {
    global.appLogger.info(
      `🍻 HTTP response already sent to the client -- ${stringify(err)}`
    );
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

  // ========================================
  // ENHANCED GRACEFUL SHUTDOWN WITH PROPER LOGGING
  // ========================================
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    global.appLogger.info(`${signal} received. Shutting down gracefully...`);

    // Set global shutdown flag
    global.isShuttingDown = true;

    // Close the server first
    server.close(async () => {
      console.log("HTTP server closed");
      global.appLogger.info("HTTP server closed");

      // Enhanced cron job shutdown handling
      if (global.cronJobs && Object.keys(global.cronJobs).length > 0) {
        console.log(
          `Stopping ${Object.keys(global.cronJobs).length} cron jobs...`
        );
        global.appLogger.info(
          `Stopping ${Object.keys(global.cronJobs).length} cron jobs...`
        );

        for (const [jobName, jobObj] of Object.entries(global.cronJobs)) {
          try {
            console.log(`Stopping cron job: ${jobName}`);
            global.appLogger.info(`Stopping cron job: ${jobName}`);

            if (jobObj.stop && typeof jobObj.stop === "function") {
              await jobObj.stop();
              console.log(`✅ Successfully stopped cron job: ${jobName}`);
              global.appLogger.info(
                `✅ Successfully stopped cron job: ${jobName}`
              );
            }
            // Legacy pattern: Direct job manipulation
            else if (jobObj.job) {
              console.log(`🔄 Using legacy stop method for job: ${jobName}`);
              global.appLogger.info(
                `🔄 Using legacy stop method for job: ${jobName}`
              );

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
                global.appLogger.warn(
                  `Job ${jobName} doesn't have destroy method (older node-cron version)`
                );
              }

              // Remove from registry
              delete global.cronJobs[jobName];
              console.log(
                `✅ Successfully stopped cron job: ${jobName} (legacy mode)`
              );
              global.appLogger.info(
                `✅ Successfully stopped cron job: ${jobName} (legacy mode)`
              );
            }
            // Simple job pattern (current pattern)
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
              global.appLogger.warn(
                `Job ${jobName} has unknown structure, skipping`
              );
            }
          } catch (error) {
            console.error(
              `❌ Error stopping cron job ${jobName}:`,
              error.message
            );
            global.criticalLogger.error(
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
              global.criticalLogger.error(
                `💥 Emergency cleanup failed for ${jobName}: ${emergencyError.message}`
              );
            }
          }
        }

        console.log("All cron jobs stopped");
        global.appLogger.info("All cron jobs stopped");
      } else {
        console.log("No cron jobs to stop");
        global.appLogger.info("No cron jobs to stop");
      }

      // Close any Redis connections if they exist
      if (global.redisClient) {
        console.log("Closing Redis connection...");
        global.appLogger.info("Closing Redis connection...");
        try {
          if (typeof global.redisClient.quit === "function") {
            await global.redisClient.quit();
            console.log("✅ Redis connection closed");
            global.appLogger.info("✅ Redis connection closed");
          } else if (typeof global.redisClient.disconnect === "function") {
            await global.redisClient.disconnect();
            console.log("✅ Redis connection disconnected");
            global.appLogger.info("✅ Redis connection disconnected");
          }
        } catch (error) {
          console.error("❌ Error closing Redis connection:", error.message);
          global.appLogger.error(
            `❌ Error closing Redis connection: ${error.message}`
          );
        }
      }

      // Close any additional cleanup (Firebase, etc.)
      if (global.firebaseApp) {
        console.log("Closing Firebase connections...");
        global.appLogger.info("Closing Firebase connections...");
        try {
          // Add Firebase cleanup if needed
          console.log("✅ Firebase connections closed");
          global.appLogger.info("✅ Firebase connections closed");
        } catch (error) {
          console.error(
            "❌ Error closing Firebase connections:",
            error.message
          );
          global.appLogger.error(
            `❌ Error closing Firebase connections: ${error.message}`
          );
        }
      }

      // Final deduplication statistics
      try {
        const { deduplicator } = require("@utils/common");
        const finalStats = deduplicator.getStats();
        console.log("📊 [DEDUP] Final statistics:", finalStats);
        global.appLogger.info(
          `📊 [DEDUP] Final statistics: ${JSON.stringify(finalStats)}`
        );
      } catch (error) {
        console.warn(
          "Could not get final deduplication statistics:",
          error.message
        );
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
      global.appLogger.info("Closing MongoDB connection...");

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
        global.appLogger.info("✅ MongoDB connection closed");
      } catch (error) {
        console.error("❌ Error closing MongoDB connection:", error.message);
        global.appLogger.error(
          `❌ Error closing MongoDB connection: ${error.message}`
        );
      }

      // Final cleanup
      console.log("Exiting process...");
      global.appLogger.info("Exiting process...");
      process.exit(0);
    });

    // Force exit timeout
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      global.criticalLogger.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 15000);
  };

  // Enhanced signal handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle uncaught exceptions with critical logging
  process.on("uncaughtException", (error) => {
    console.error(`💥 Uncaught Exception: ${error.message}`);
    global.criticalLogger.error(`💥 Uncaught Exception: ${error.message}`);
    global.criticalLogger.error(`Stack: ${error.stack}`);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error(`🚫 Unhandled Rejection at:`, promise, "reason:", reason);
    global.criticalLogger.error(
      `🚫 Unhandled Rejection at: ${promise}, reason: ${reason}`
    );
    gracefulShutdown("UNHANDLED_REJECTION");
  });

  // Handle process warnings
  process.on("warning", (warning) => {
    console.warn(`⚠️  Process Warning: ${warning.name}: ${warning.message}`);
    global.appLogger.warn(
      `⚠️  Process Warning: ${warning.name}: ${warning.message}`
    );
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
