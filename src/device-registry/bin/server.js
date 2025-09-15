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

// Initialize log4js with SAFE configuration and deduplication
const log4js = require("log4js");
let logger;

try {
  // Use the SAFE log4js configuration (no custom appenders)
  const logConfig = require("@config/log4js");
  log4js.configure(logConfig);
  logger = log4js.getLogger(`${constants.ENVIRONMENT} -- bin/server`);
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

// Run startup migrations
const runStartupMigrations = require("@bin/jobs/run-migrations");
runStartupMigrations().catch((error) => {
  // Use deduplicated logger for critical startup errors
  global.dedupLogger.error(
    `🐛🐛 Failed to run startup migrations: ${error.message}`
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
require("@bin/jobs/update-online-status-job");
require("@bin/jobs/check-network-status-job");
require("@bin/jobs/check-unassigned-devices-job");
require("@bin/jobs/check-active-statuses");
require("@bin/jobs/check-unassigned-sites-job");
require("@bin/jobs/check-duplicate-site-fields-job");
require("@bin/jobs/update-duplicate-site-fields-job");
require("@bin/jobs/health-tip-checker-job");
require("@bin/jobs/daily-activity-summary-job");
require("@bin/jobs/site-categorization-job");
require("@bin/jobs/site-categorization-notification-job");
require("@bin/jobs/precompute-activities-job");

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
      // Use deduplicated logger for internal server errors to prevent Slack spam
      global.dedupLogger.error(
        `🐛🐛 Internal Server Error --- ${stringify(err)}`
      );
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
      // Use deduplicated logger for unexpected errors
      global.dedupLogger.error(
        `🐛🐛 Internal Server Error --- ${stringify(err)}`
      );
      logObject("Internal Server Error", err);
      global.dedupLogger.error(`Stack Trace: ${err.stack}`);
      res.status(err.statusCode || err.status || 500).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: { message: err.message },
      });
    }
  } else {
    logger.info(
      `🍻🍻 HTTP response already sent to the client -- ${stringify(err)}`
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

  // Enhanced graceful shutdown handler
  const gracefulShutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    logger.info(`${signal} received. Shutting down gracefully...`);

    // Set global shutdown flag to signal running jobs to stop
    global.isShuttingDown = true;

    // Close the server first to stop accepting new connections
    server.close(async () => {
      console.log("HTTP server closed");
      logger.info("HTTP server closed");

      // Enhanced cron job shutdown handling
      if (global.cronJobs && Object.keys(global.cronJobs).length > 0) {
        console.log(
          `Stopping ${Object.keys(global.cronJobs).length} cron jobs...`
        );
        logger.info(
          `Stopping ${Object.keys(global.cronJobs).length} cron jobs...`
        );

        // Stop each job individually with error handling
        for (const [jobName, jobObj] of Object.entries(global.cronJobs)) {
          try {
            console.log(`Stopping cron job: ${jobName}`);
            logger.info(`Stopping cron job: ${jobName}`);

            // Enhanced pattern: Use the async stop method if available
            if (jobObj.stop && typeof jobObj.stop === "function") {
              await jobObj.stop();
              console.log(`✅ Successfully stopped cron job: ${jobName}`);
              logger.info(`✅ Successfully stopped cron job: ${jobName}`);
            }
            // Legacy pattern: Direct job manipulation
            else if (jobObj.job) {
              console.log(`🔄 Using legacy stop method for job: ${jobName}`);
              logger.info(`🔄 Using legacy stop method for job: ${jobName}`);

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
              logger.info(
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
        logger.info("All cron jobs stopped");
      } else {
        console.log("No cron jobs to stop");
        logger.info("No cron jobs to stop");
      }

      // Close any Redis connections if they exist
      if (global.redisClient) {
        console.log("Closing Redis connection...");
        logger.info("Closing Redis connection...");
        try {
          if (typeof global.redisClient.quit === "function") {
            await global.redisClient.quit();
            console.log("✅ Redis connection closed");
            logger.info("✅ Redis connection closed");
          } else if (typeof global.redisClient.disconnect === "function") {
            await global.redisClient.disconnect();
            console.log("✅ Redis connection disconnected");
            logger.info("✅ Redis connection disconnected");
          }
        } catch (error) {
          console.error("❌ Error closing Redis connection:", error.message);
          logger.error(`❌ Error closing Redis connection: ${error.message}`);
        }
      }

      // Close any additional cleanup (Firebase, etc.)
      if (global.firebaseApp) {
        console.log("Closing Firebase connections...");
        logger.info("Closing Firebase connections...");
        try {
          // Add Firebase cleanup if needed
          console.log("✅ Firebase connections closed");
          logger.info("✅ Firebase connections closed");
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
      logger.info("Closing MongoDB connection...");

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
        logger.info("✅ MongoDB connection closed");
      } catch (error) {
        console.error("❌ Error closing MongoDB connection:", error.message);
        logger.error(`❌ Error closing MongoDB connection: ${error.message}`);
      }

      // Final cleanup
      console.log("Exiting process...");
      logger.info("Exiting process...");
      process.exit(0);
    });

    // Force exit after timeout if graceful shutdown fails
    setTimeout(() => {
      console.error(
        "Could not close connections in time, forcefully shutting down"
      );
      logger.error(
        "Could not close connections in time, forcefully shutting down"
      );
      process.exit(1);
    }, 15000); // Increased timeout to 15 seconds to allow for async job stopping
  };

  // Add signal handlers
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error(`💥 Uncaught Exception: ${error.message}`);
    global.dedupLogger.error(`💥 Uncaught Exception: ${error.message}`);
    global.dedupLogger.error(`Stack: ${error.stack}`);
    gracefulShutdown("UNCAUGHT_EXCEPTION");
  });

  // Handle unhandled promise rejections
  process.on("unhandledRejection", (reason, promise) => {
    console.error(`🚫 Unhandled Rejection at:`, promise, "reason:", reason);
    global.dedupLogger.error(
      `🚫 Unhandled Rejection at:`,
      promise,
      "reason:",
      reason
    );
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
