const mongoose = require("mongoose");
const { Client } = require("pg");
const { InfluxDB } = require("influx");

class DAO {
  constructor(dbType, dbUrl) {
    this.dbType = dbType;
    this.dbUrl = dbUrl;
    switch (dbType) {
      case "mongodb":
        this.db = mongoose.connect(dbUrl, {
          useNewUrlParser: true,
          useUnifiedTopology: true,
        });
        break;
      case "postgresql":
        this.db = new Client({
          connectionString: dbUrl,
        });
        this.db.connect();
        break;
      case "influxdb":
        this.db = new InfluxDB({
          host: dbUrl,
          database: "mydb",
        });
        break;
      default:
        throw new Error(`Unsupported database type: ${dbType}`);
    }
  }

  async getUsers() {
    switch (this.dbType) {
      case "mongodb":
        const User = mongoose.model("User", {
          name: String,
          email: String,
        });
        const users = await User.find();
        return users;
      case "postgresql":
        const res = await this.db.query("SELECT * FROM users");
        return res.rows;
      case "influxdb":
        const query = 'SELECT * FROM "users"';
        const result = await this.db.query(query);
        return result;
    }
  }
}

module.exports = DAO;
