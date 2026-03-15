const winston = require("winston");
const { getIsConnected } = require("@config/database");

// Start with a console-only transport so the logger is immediately usable.
// The MongoDB transport is added lazily once the connection is ready, because
// winston-mongodb reads the db reference in its constructor — instantiating it
// at module load time throws before the async connection has opened.
const winstonLogger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.Console({
      silent: true, // suppress console noise; MongoDB transport takes over once ready
    }),
  ],
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

// Poll until the connection is ready, then add the transport.
// Interval cancels itself after success.
const pollInterval = setInterval(() => {
  if (getIsConnected()) {
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
