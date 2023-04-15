const Influx = require("influx");
const { influxConfig } = require("../config");

class InfluxDAO {
  constructor() {
    this.influx = new Influx.InfluxDB(influxConfig);
  }

  async saveMeasurement(measurement) {
    try {
      await this.influx.writePoints([measurement]);
      console.log("Measurement saved successfully");
    } catch (error) {
      console.error(`Error saving measurement: ${error}`);
    }
  }

  async deleteMeasurement(measurementName, whereClause) {
    try {
      const query = `DELETE FROM ${measurementName} WHERE ${whereClause}`;
      await this.influx.query(query);
      console.log("Measurement deleted successfully");
    } catch (error) {
      console.error(`Error deleting measurement: ${error}`);
    }
  }

  async getMeasurement(measurementName, fields, whereClause, groupBy) {
    try {
      const query = `SELECT ${fields} FROM ${measurementName} WHERE ${whereClause} GROUP BY ${groupBy}`;
      const result = await this.influx.query(query);
      console.log("Measurement retrieved successfully");
      return result;
    } catch (error) {
      console.error(`Error retrieving measurement: ${error}`);
    }
  }
}

module.exports = InfluxDAO;
