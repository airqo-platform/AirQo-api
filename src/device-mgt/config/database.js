const mongoose = require('mongoose');
const constants = require('./constants');

mongoose.Promise = global.Promise;

try {
    mongoose.connect(constants.MONGO_URL)
}
catch (e) {
    mongoose.createConnection(constants.MONGO_URL);
}

mongoose.connection.once('open', () => console.log('MongoDB Running')).on('error', e => {
    throw e
})