const { Schema, model } = require("mongoose");

const activitySchema = new Schema({
  device: { type: String },
  location: { type: String },
  dateDeployed: { String: Date },
  timeDeployed: { type: String },
  dateRemoved: { type: Date },
  timeRemoved: { type: String },
  collocation: { type: String },
});

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      location: this.activity,
      dateDeployed: this.date,
      timeDeployed: this.nextMaintenance,
      dateRemoved: this.dateRemoved,
      timeRemoved: this.timeRemoved,
      collocation: this.collocation,
    };
  },
};

const activity = model("activity", activitySchema);

module.exports = activity;
