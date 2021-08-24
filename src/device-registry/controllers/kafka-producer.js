const kafka = require('kafka-node');
const HighLevelProducer = kafka.HighLevelProducer;
const client = require('../config/kafka');
const type = require('../models/avro');


const producer = new HighLevelProducer(client);
producer.on('ready', function () {
    //create message and encode to the avro buffer.
    let messageBuffer = type.toBuffer({
        enumField: 'sym1',
        id: '3e0c63c4-ooooa-48-8a6d-okkiscvmv',
        timestamp: Date.now()
    });

    let payload = [
        {
            topic: 'node-test',
            messages: messageBuffer,
            attributes: 1 //compress using GZip
        }
    ]
    //send payload to kafka and log result/error
    producer.send(payload, function (error, result) {
        console.info('Sent payload to Kafka: ', payload);
        if (error) {
            console.error(error);
        }
        else {
            let formattedResult = result[0];
            console.log('result: ', result);
        }
    });
});

producer.on('error', function (error) {
    console.error(error);
});

//do we create the topics when producing messages or do we just send to
//already created topics?