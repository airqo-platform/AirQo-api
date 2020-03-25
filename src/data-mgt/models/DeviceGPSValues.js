const { Schema, model } = require("mongoose");
const ObjectId = Schema.Types.ObjectId;

const gpsSchema = new Schema({
  channel_id: { type: Number },
  latitude: { type: Number },
  longitude: { type: Number }
});

gpsSchema.methods = {
  toJSON() {
    return {
      _id: this._id,
      latitude: this.latitude,
      longitude: this.longitude
    };
  }
};

const gps = model("gps", gpsSchema);

module.exports = gps;
