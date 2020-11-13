const { Schema, model } = require("mongoose");

function threeMonthsFromNow() {
  var d = this.date;
  var targetMonth = d.getMonth() + 2;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const maintenanceSchema = new Schema({
  unit: { type: String },
  activity: { type: String },
  period: { String: String },
  nextMaintenance: { type: Date, default: threeMonthsFromNow },
  date: { type: Date, required: true },
});

maintenanceSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      unit: this.unit,
      activity: this.activity,
      nextMaintenance: this.nextMaintenance,
      date: this.date,
    };
  },
};

const maintenance = model("maintenance", maintenanceSchema);

module.exports = maintenance;
