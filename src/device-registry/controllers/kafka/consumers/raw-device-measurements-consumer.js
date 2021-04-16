const kafka = require('kafka-node');
const Consumer = kafka.Consumer;
const KeyedMessage = kafka.KeyedMessage;
const type = require('../../../models/avro');
const { logObject, logElement } = require("../../../utils/log");
const client = require('../../../config/kafka');
const constants = require("../../../config/constants");

const insertMeasurtements = require("../../../services/insert-device-measurements");

const KAFKA_TOPICS = constants.KAFKA_TOPICS;


let topics = [{
    topic: KAFKA_TOPICS
}];

let options = {
    autoCommit: false,
    // fetchMaxWaitMs: 1000,
    // fetchMaxBytes: 1024 * 1024,
    // encoding: 'buffer'
};

let consumer = new Consumer(client, topics, options);


consumer.on('message', function (message) {

    try {

        logObject("Kafka Message", message);

        const messageValue = message.value.replace(/\'/g, '"');
    
        const json_data = JSON.parse(messageValue);
    
        const response = insertMeasurtements.addValuesArray(json_data);
    
        for(index in response){
            logObject(response[index].success, response[index]);
        }
        
    } catch (error) {
        logElement("Error Occurred in consumer", error);
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
