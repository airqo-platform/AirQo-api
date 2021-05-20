const client = require('../config/kafka');
const kafka = require('kafka-node');

let topicsToCreate = [{

    topic: 'bbaale',
    partitions: 1,
    replicationFactor: 1
},
{

    topic: 'martin',
    partitions: 1,
    replicationFactor: 1
}
];

client.createTopics(topicsToCreate, (error, result) => {
    if (error) {
        console.log("we erroring");
        console.error(error);
    }
    else {
        console.log("we good");
        console.log(result);
    }
})