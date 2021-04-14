const kafka = require('kafka-node');
const Consumer = kafka.Consumer;
const client = require('../config/kafka');
const KeyedMessage = kafka.KeyedMessage;
const type = require('../models/avro');

const { transformMeasurements } = require("../utils/transform-measurements");
const insertMeasurements = require("../utils/insert-measurements");
const {
    doesDeviceExist,
  } = require("../utils/does-component-exist");


let topics = [{
    topic: 'quickstart-events'
}];

let options = {
    autoCommit: true,
    // fetchMaxWaitMs: 1000,
    // fetchMaxBytes: 1024 * 1024,
    // encoding: 'buffer'
};

let consumer = new Consumer(client, topics, options);


const createEvent = {
    addValues: async (message) => {
        try {
            console.log("got values...");
            console.log(message);

            const device = message.device;
            const tenant = message.tenant;
            const measurements = [message.measurements];

            if (tenant && device && measurements) {

            const isDevicePresent = await doesDeviceExist(
                device,
                tenant.toLowerCase()
            );

            if (isDevicePresent) {
                const transformedMeasurements = await transformMeasurements(
                device,
                measurements
                );

                const ignored = await insertMeasurements(tenant, transformedMeasurements);
                console.log(ignored);

            } 
            
            else {
                console.log(`the device (${device}) does not exist on the network`);
            }
            } else {
                console.log("missing values...")
            }
        } 
        catch (e) {
            console.log(`Error occured (${e})`);
        }
    },
};

consumer.on('message', function (message) {

    const topic_data = message.value.replace(/\'/g, '"');

    var json_data = JSON.parse(topic_data);

    for (entry in json_data) {
        createEvent.addValues(json_data[entry]);
      }

    // let buf = new Buffer(message.value, 'binary');
    // let decodedMessage = type.fromBuffer(buf.slice(0));
    // console.log(decodedMessage);

    

});



consumer.on('error', function (err) {
    console.log('error', err);
});

// consumer.addTopics(['t1', 't2'], function (err, added) {
//     if (err) {
//         console.error(err);
//     }
//     else {
//         console.log(added)
//     }
// });

// consumer.removeTopics(['t1', 't2'], function (err, removed) {
//     if (err) {
//         console.error(err);
//     }
//     else {
//         console.log(removed)
//     }
// })

process.on('SIGINT', function () {
    consumer.close(true, function () {
        process.exit();
    })
})

module.exports = consumer;
