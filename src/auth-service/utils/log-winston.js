const winston = require("winston");
const { combine, timestamp, printf } = winston.format;
const MongoDB = require("winston-mongodb").MongoDB;
const { LogModel, LogDB, logSchema } = require("@models/log");

const winstonLogger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.MongoDB({
      db: LogDB("airqo"),
      options: { useNewUrlParser: true, useUnifiedTopology: true },
      collection: "logs",
      options: { useUnifiedTopology: true },
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format.metadata()
      ),
      metaKey: "metadata",
      level: "info",
      schema: logSchema,
      model: LogModel("airqo"),
    }),
  ],
});

module.exports = winstonLogger;
