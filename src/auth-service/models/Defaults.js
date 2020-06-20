const mongoose = require("mongoose").set("debug", true);
const ObjectId = mongoose.Schema.Types.ObjectId;
var uniqueValidator = require("mongoose-unique-validator");
const { tenantModel } = require("../config/multiTenant");

const DefaultsSchema = new mongoose.Schema({
    pollutant: { type: String, trim: true, required: true },
    frequency: { type: String, default: "none", required: true },
    start_date: { type: String, default: "none", required: true },
    end_date: { type: String, default: "none", required: true },
    user: { type: ObjectId, ref: "user", required: true },
});

DefaultsSchema.plugin(uniqueValidator);

DefaultsSchema.index({
    pollutant: 1,
    frequency: 1,
    user: 1,
}, {
    unique: true,
});

DefaultsSchema.methods = {
    toJSON() {
        return {
            _id: this._id,
            pollutant: this.pollutant,
            frequency: this.frequency,
            start_date: this.start_date,
            end_date: this.end_date,
            user: this.user,
        };
    },
};

const defaults = mongoose.model("defaults", DefaultsSchema);

module.exports = defaults;

// module.exports = tenantModel("defaults", DefaultsSchema);