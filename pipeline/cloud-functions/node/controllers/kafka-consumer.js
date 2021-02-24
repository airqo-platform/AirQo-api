const kafka = require('kafka-node');
const Consumer = kafka.Consumer;
const client = require('../config/kafka');
const KeyedMessage = kafka.KeyedMessage;
const type = require('../models/avro');

let topics = [{
    topic: 'node-test'
}];

let options = {
    autoCommit: true,
    fetchMaxWaitMs: 1000,
    fetchMaxBytes: 1024 * 1024,
    encoding: 'buffer'
};

let consumer = new Consumer(client, topics, options);

consumer.on('message', function (message) {
    let buf = new Buffer(message.value, 'binary');
    let decodedMessage = type.fromBuffer(buf.slice(0));
    console.log(decodedMessage);
});

consumer.on('error', function (err) {
    console.log('error', err);
});

consumer.addTopics(['t1', 't2'], function (err, added) {
    if (err) {
        console.error(err);
    }
    else {
        console.log(added)
    }
});

consumer.removeTopics(['t1', 't2'], function (err, removed) {
    if (err) {
        console.error(err);
    }
    else {
        console.log(removed)
    }
})

process.on('SIGINT', function () {
    consumer.close(true, function () {
        process.exit();
    })
})
