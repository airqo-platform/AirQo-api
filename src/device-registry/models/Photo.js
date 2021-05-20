const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const photoSchema = new Schema(
  {
    deviceID: { type: String },
    img: {
      data: Buffer,
      contentType: String,
    },
    tags: {
      type: Array,
    },
  },
  {
    timestamps: true,
  }
);

photoSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

photoSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

photoSchema.methods = {
  toJSON() {
    return {
      img: this.img,
    };
  },
};

photoSchema.statics = {
  createEvent(args) {
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

module.exports = photoSchema;
