const { Schema, model } = require('mongoose');
const ObjectId = Schema.Types.ObjectId;

const channelSchema = new Schema({
    channel: {
        id: { type: Number },
        name: { type: String },
        description: { type: String },
        latitude: { type: Number },
        longitude: { type: Number },
        longitude: { type: String },
        created_at: { type: Date },
        updated_at: { type: Date },
        elevation: { type: Number },
        last_entry_id: { type: Number },
        public_flag: { type: Boolean },
        url: { type: String },
        ranking: { type: Number },
        metadata: { type: String },
        license_id: { type: Number },
        github_url: { type: String },
        tags: [{
            id: { type: Number },
            name: { type: String }
        }],
        api_keys: [{
            api_key: { type: String },
            whiteflag: { type: Boolean }
        }],
    },
    feeds: [{ type: ObjectId, ref: 'feed' }]
});

const channel = model("channel", channelSchema);

module.exports = channel;