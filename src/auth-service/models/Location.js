const mongoose = require("mongoose");
const ObjectId = mongoose.Schema.Types.ObjectId;
const { tenantModel } = require("../config/multiTenant");

const LocSchema = new mongoose.Schema({
    county: { type: String, default: "none" },
    country: { type: String, default: "none" },
    subcounty: { type: String, default: "none" },
    parish: { type: String, default: "none" },
    longitude: { type: Number, default: 0 },
    latitude: { type: Number, default: 0 },
    user: { type: ObjectId, ref: "user" },
});

LocSchema.methods = {
    toJSON() {
        return {
            _id: this._id,
            county: this.county,
            country: this.country,
            parish: this.parish,
            longitude: this.longitude,
            latitude: this.latitude,
        };
    },
};

const loc = mongoose.model("loc", LocSchema);

module.exports = loc;
// module.exports = tenantModel("loc", LocSchema);