const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { tenantModel } = require("../config/multiTenant");

const DefaultsSchema = new mongoose.Schema({
  pollutant: {
    type: String,
    trim: true,
    required: [true, "pollutant is required!"],
  },
  frequency: {
    type: String,
    required: [true, "frequency is required!"],
  },
  startDate: {
    type: Date,
    required: [true, "startDate is required!"],
  },
  endDate: {
    type: Date,
    required: [true, "endDate is required!"],
  },
  user: {
    type: ObjectId,
    required: [true, "user is required!"],
    unique: false,
  },
  chartType: {
    type: String,
    required: [true, "chartTyoe is required!"],
  },
  chartTitle: {
    type: String,
    required: [true, "chartTitle is required!"],
    unique: false,
  },
  locations: [
    {
      type: String,
    },
  ],
  range: { type: String, required: [true, "range is required!"] },
});

DefaultsSchema.plugin(uniqueValidator);

DefaultsSchema.index(
  {
    chartTitle: 1,
    user: 1,
  },
  {
    unique: true,
  }
);

DefaultsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      pollutant: this.pollutant,
      frequency: this.frequency,
      startDate: this.startDate,
      endDate: this.endDate,
      user: this.user,
      chartType: this.chartType,
      chartTitle: this.chartTitle,
      locations: this.locations,
    };
  },
};

const defaults = mongoose.model("defaults", DefaultsSchema);

module.exports = defaults;
