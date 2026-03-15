const winston = require("winston");
const mongoose = require("mongoose");

// Console transport is live from the start so startup and outage logs are never
// silently dropped. The MongoDB transport is added lazily once the driver
// connection is open (readyState === 1), because winston-mongodb reads the db
// reference in its constructor — instantiating it earlier throws.
const winstonLogger = winston.createLogger({
  level: "info",
  transports: [new winston.transports.Console()],
});

let mongoTransportAdded = false;

const addMongoTransport = () => {
  if (mongoTransportAdded) return;

  try {
    const { LogModel, LogDB, logSchema } = require("@models/log");
    const MongoDB = require("winston-mongodb").MongoDB;

    winstonLogger.add(
      new MongoDB({
        db: LogDB("airqo"),
        options: { useUnifiedTopology: true },
        collection: "logs",
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json(),
          winston.format.metadata(),
        ),
        metaKey: "metadata",
        level: "info",
        schema: logSchema,
        model: LogModel("airqo"),
      }),
    );

    mongoTransportAdded = true;
  } catch (err) {
    // Non-fatal — logger continues using the console transport
    console.warn("⚠️  Could not add MongoDB winston transport:", err.message);
  }
};

// Poll on the driver's actual readyState rather than the app-level isConnected
// flag, so the transport attaches as soon as the driver is open regardless of
// whether RBAC init has completed.
const pollInterval = setInterval(() => {
  if (mongoose.connection.readyState === 1) {
    clearInterval(pollInterval);
    addMongoTransport();
  }
}, 2000);

// Cap polling so it doesn't run forever if the DB never comes up.
setTimeout(() => {
  clearInterval(pollInterval);
  if (!mongoTransportAdded) {
    console.warn(
      "⚠️  MongoDB winston transport was never added (DB did not become ready in time).",
    );
  }
}, 60000);

module.exports = winstonLogger;
