// postgresDAO.js

class PostgresDAO {
  constructor(pgPool) {
    this.pgPool = pgPool;
  }

  async saveMeasurement(measurement) {
    const { value, timestamp } = measurement;
    const query = {
      text: "INSERT INTO measurements(value, timestamp) VALUES($1, $2)",
      values: [value, timestamp],
    };
    return this.pgPool.query(query);
  }

  async getMeasurements(query) {
    const { startTime, endTime } = query;
    const results = await this.pgPool.query({
      text:
        "SELECT * FROM measurements WHERE timestamp >= $1 AND timestamp <= $2",
      values: [startTime, endTime],
    });
    return results.rows;
  }

  async deleteMeasurement(measurementId) {
    return this.pgPool.query({
      text: "DELETE FROM measurements WHERE id = $1",
      values: [measurementId],
    });
  }
}

module.exports = PostgresDAO;
