const { Schema } = require('mongoose');

const feedSchema = new Schema({
    channel_id: { type: Number },
    created_at: { type: Date },
    entry_id: { type: Number },
    field1: { type: Number },
    field2: { type: Number },
    field3: { type: Number },
    field4: { type: Number },
    field5: { type: Number },
    field6: { type: Number },
    field7: { type: Number },
    field8: { type: String }
});

const feed = mongoose.model("feed", feedSchema);

module.exports = feed;