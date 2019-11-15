const mongoose = require('mongoose');
const ObjectId = mongoose.Schema.Types.ObjectId;

const momoSchema = {
    amount: { type: Number, default: 0 },
    recepient: { type: ObjectId },
    description: { type: String },
    referece_id: { type: Number },
    status: { type: String }
}

const momo = mongoose.model('momo', momoSchema);

module.exports = momo;