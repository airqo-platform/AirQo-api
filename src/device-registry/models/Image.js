const { Schema, model } = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const imageSchema = new Schema(
  {
    deviceName: { type: String },
    img: {
      data: Buffer,
      contentType: String,
    },
  },
  {
    timestamps: true,
  }
);

imageSchema.pre("save", function() {
  const err = new Error("something went wrong");
  next(err);
});

imageSchema.plugin(uniqueValidator, {
  message: `{VALUE} already taken!`,
});

imageSchema.methods = {
  toJSON() {
    return {
      img: this.img,
    };
  },
};

imageSchema.statics = {
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

module.exports = imageSchema;
