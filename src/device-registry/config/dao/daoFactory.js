// daoFactory.js

const mongoose = require("mongoose");
const { Pool } = require("pg");
const { InfluxDB } = require("@influxdata/influxdb-client");

const MongoDAO = require("./mongoDAO");
const PostgresDAO = require("./postgresDAO");
const InfluxDAO = require("./influxDAO");

class DAOFactory {
  static createDAO(database, config) {
    switch (database) {
      case "mongo":
        mongoose.connect(config.mongoUri, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
          useCreateIndex: true,
          useFindAndModify: false,
        });
        return new MongoDAO();
      case "postgres":
        const pgPool = new Pool(config.postgresConfig);
        return new PostgresDAO(pgPool);
      case "influx":
        const influxClient = new InfluxDB({
          url: config.influxUrl,
          token: config.influxToken,
        });
        return new InfluxDAO(influxClient);
      default:
        throw new Error(`Invalid database type: ${database}`);
    }
  }
}

module.exports = DAOFactory;
