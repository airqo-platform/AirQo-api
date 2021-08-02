const { kafkaClient } = require('../config/kafka');
const { logObject } = require("../utils/log");
const { getTopic } = require("../utils/kafka-topics");

const kafkaProducer = async (topic, messages) => {

  outputTopic = getTopic(topic);

  if (!Array.isArray(messages)){
    throw new Error(messages + ' should be an array.');
  }

  const producer = kafkaClient.producer()
  await producer.connect();

  try {
    const responses = await producer.send({
      topic: outputTopic,
      messages: messages
    })

    logObject('Published message', { responses })
  } catch (error) {
    logObject('Error publishing message', error)
  }
}

module.exports = { kafkaProducer };
