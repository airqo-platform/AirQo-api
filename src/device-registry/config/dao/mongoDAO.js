// mongoDAO.js

const mongoose = require("mongoose");
const Measurement = require("./measurement");

class MongoDAO {
  async saveMeasurement(measurement) {
    const newMeasurement = new Measurement(measurement);
    return newMeasurement.save();
  }

  async getMeasurements(query) {
    return Measurement.find(query);
  }

  async deleteMeasurement(measurementId) {
    return Measurement.findByIdAndDelete(measurementId);
  }
}

module.exports = MongoDAO;
