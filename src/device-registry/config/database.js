const mongoose = require('mongoose');
const constants = require('./constants');

mongoose.Promise = global.Promise;

try {
    console.log("the value for MONGO URL is: " + constants.MONGO_URL);
    mongoose.connect(constants.MONGO_URL, { useNewUrlParser: true });
}
catch (e) {
    mongoose.createConnection(constants.MONGO_URL);
}

mongoose.connection.once('open', () => console.log('MongoDB Running')).on('error', e => {
    throw e
})