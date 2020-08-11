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

const activitySchema = new Schema(
  {
    device: { type: String, trim: true },
    location: { type: String, trim: true },
    date: { type: Date },
    description: { type: String, trim: true },
    activityType: { type: String, trim: true },
    tags: [{ type: String }],
    nextMaintenance: { type: Date, default: threeMonthsFromNow },
    createdAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

activitySchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      device: this.device,
      location: this.location,
      date: this.date,
      description: this.description,
      activityType: this.activityType,
      nextMaintenance: this.nextMaintenance,
      createdAt: this.createdAt,
      tags: this.tags,
    };
  },
};

activitySchema.statics = {
  createLocationActivity(args) {
    return this.create({
      ...args,
    });
  },

  list({ skip = 0, limit = 5 } = {}) {
    return this.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
  },
};

const activity = model("activity", activitySchema);

module.exports = activity;
