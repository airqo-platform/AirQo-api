const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { tenantModel } = require("../config/multiTenant");

const DefaultsSchema = new mongoose.Schema({
    pollutant: { type: String, trim: true, unique: true },
    endDate: { type: Date, default: Date.now },
    startDate: { type: Date, default: Date.now },
    startTime: { type: Number, default: 0 },
    endTime: { type: Number, default: 0 },
    user: { type: ObjectId, ref: "user" },
});

DefaultsSchema.plugin(uniqueValidator);

DefaultsSchema.methods = {
    toJSON() {
        return {
            _id: this._id,
            pollutant: this.pollutant,
            startDate: this.startDate,
            endDate: this.endDate,
            startTime: this.startTime,
            endTime: this.endTime,
            location: this.location,
        };
    },
};

const defaults = mongoose.model("defaults", DefaultsSchema);

module.exports = defaults;

// module.exports = tenantModel("defaults", DefaultsSchema);