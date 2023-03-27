const winston = require("winston");
const { combine, timestamp, printf } = winston.format;
const MongoDB = require("winston-mongodb").MongoDB;
const LogSchema = require("@models/Log");
const { getTenantDB } = require("@config/dbConnection");

const LogDB = (tenant) => {
  return getTenantDB(tenant, "inquiry", LogSchema);
};

const logText = (message) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message);
  }
  return "log deactivated in prod and stage";
};

const logElement = (message, body) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message + ": " + body);
  }
  return "log deactivated in prod and stage";
};

const logObject = (message, object) => {
  if (process.env.NODE_ENV === "development") {
    console.log(message + ": ");
    console.dir(object);
  }
  return "log deactivated in prod and stage";
};

const logError = (error) => {
  if (process.env.NODE_ENV === "development") {
    console.log("an unhandled promise rejection" + ": ");
    console.error(e);
  }
  return "log deactivated in prod and stage";
};

const winstonLogger = winston.createLogger({
  level: "info",
  transports: [
    new winston.transports.MongoDB({
      db: LogDB("airqo"),
      options: { useNewUrlParser: true, useUnifiedTopology: true },
      collection: "logs",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
    }),
  ],
});

module.exports = { logText, logElement, logObject, logError, winstonLogger };
