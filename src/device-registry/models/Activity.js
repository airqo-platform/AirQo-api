const { Schema, model } = require("mongoose");
function threeMonthsFromNow() {
  let d = new Date();
  let targetMonth = d.getMonth() + 3;
  d.setMonth(targetMonth);
  if (d.getMonth() !== targetMonth % 12) {
    d.setDate(0); // last day of previous month
  }
  return d;
}

const logsSchema = new Schema({
  device: { type: String, trim: true },
  site_id: { type: String, trim: true },
  time: { type: Date },
  description: { type: String, trim: true },
  activity_type: { type: String, trim: true },
  activity_tags: [{ type: String }],
  next_maintenance: { type: Date, default: threeMonthsFromNow },
  activity_subtype: { type: String },
  log_id: {
    type: String,
  },
});

const activitySchema = new Schema(
  {
    day: {
      type: String,
      required: [true, "the day is required"],
    },
    first: {
      type: Date,
      required: [true, "the first day's activity is required"],
    },
    last: {
      type: Date,
      required: [true, "the last day's activity is required"],
    },
    nLogs: {
      type: Number,
    },
    logs: { type: [logsSchema], default: [logsSchema] },
  },
  {
    timestamps: true,
  }
);

activitySchema.index(
  {
    "logs.time": 1,
    "logs.device": 1,
    day: 1,
    "logs.site_id": 1,
    "logs.activity_type": 1,
  },
  { unique: true }
);

activitySchema.index({ day: 1 }, { unique: true });

activitySchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

activitySchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

activitySchema.methods = {
  toJSON() {
    return {
      day: this.day,
      logs: this.logs,
    };
  },
};

activitySchema.statics = {
  register(args) {
    return this.create({
      ...args,
    });
  },

  list({ skipInt = 0, limitInt = 100, filter = {} } = {}) {
    logObject("the filter", filter);
    return this.aggregate()
      .unwind("logs")
      .match(filter)
      .replaceRoot("logs")
      .sort({ time: -1 })
      .project({
        _id: 0,
        day: 0,
        __v: 0,
        createdAt: 0,
        first: 0,
        last: 0,
        nLogs: 0,
        updatedAt: 0,
      })
      .skip(skipInt)
      .limit(limitInt)
      .allowDiskUse(true);
  },
  listRecent({ skipInt = 0, limitInt = 100, filter = {} } = {}) {
    logObject("the filter", filter);
    return this.aggregate()
      .unwind("logs")
      .match(filter)
      .replaceRoot("logs")
      .lookup({
        from: "sites",
        localField: "site_id",
        foreignField: "lat_long",
        as: "siteDetails",
      })
      .sort({ time: -1 })
      .group({
        _id: "$site_id",
        device: { $first: "$device" },
        time: { $first: "$time" },
        description: { $first: "$description" },
        activity_type: { $first: "$activity_type" },
        activity_tags: { $first: "$activity_tags" },
        next_maintenance: { $first: "$next_maintenance" },
        activity_subtype: { $first: "$activity_subtype" },
        log_id: { $first: "$log_id" },
        siteDetails: { $first: { $arrayElemAt: ["$siteDetails", 0] } },
      })
      .skip(skipInt)
      .limit(limitInt)
      .allowDiskUse(true);
  },
  modify({ filter = {}, update = {} } = {}) {},
  remove({ filter = {} }) {},
};

module.exports = activitySchema;
