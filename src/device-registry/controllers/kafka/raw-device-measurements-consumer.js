const kafka = require('kafka-node');
const Consumer = kafka.Consumer;
const { logObject, logElement } = require("../../utils/log");
const client = require('../../config/kafka');
const constants = require("../../config/constants");
var avro = require('avsc');

const insertMeasurtements = require("../../utils/insert-device-measurements");

const KAFKA_TOPICS = constants.KAFKA_TOPICS;


let topics = [{
    topic: KAFKA_TOPICS
}];

let options = {
    autoCommit: true,
};

let consumer = new Consumer(client, topics, options);


consumer.on('message', function (message) {

    try {

        logObject("Kafka Message Received", message);

    
        const messageValue = message.value.replace(/\'/g, '"');
    
        const json_data = JSON.parse(messageValue);
    
        insertMeasurtements.addValuesArray(json_data);

    } catch (error) {
        logElement("Error Occurred in kafka kcca consumer", error);
    }

});


consumer.on('error', function (err) {
    console.log('error', err);
});

process.on('SIGINT', function () {
    consumer.close(true, function () {
        process.exit();
    })
})

module.exports = consumer;
