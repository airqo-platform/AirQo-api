const kafka = require('kafka-node');
//more: https://www.npmjs.com/package/kafka-node#consumer
//more: https://medium.com/@theotow/event-sourcing-with-kafka-and-nodejs-9787a8e47716

const client = new kafka.KafkaClient('localhost:2181', 'my-client-id', {
    sessionTimeout: 300,
    spinDelay: 100,
    retries: 2
});

client.on('error', function (error) {
    console.error(error);
});

module.exports = client;



