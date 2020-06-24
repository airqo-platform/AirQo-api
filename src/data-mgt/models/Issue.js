const { Schema, model } = require("mongoose");

const issueSchema = new Schema({
  unit: { type: String },
  issue: { type: String },
});

issueSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      unit: this.unit,
      issue: this.activity,
    };
  },
};

const issue = model("issue", issueSchema);

module.exports = issue;
