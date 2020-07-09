const { Schema, model } = require("mongoose");

function threeMonthsFromNow() {
  var d = new Date();
  var targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const maintenanceSchema = new Schema({
  device: { type: String },
  activity: { type: String },
  date: { String: Date },
  nextMaintenance: { type: Date, default: threeMonthsFromNow },
});

maintenanceSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      activity: this.activity,
      date: this.date,
      nextMaintenance: this.nextMaintenance,
    };
  },
};

const maintenance = model("maintenance", maintenanceSchema);

module.exports = maintenance;
