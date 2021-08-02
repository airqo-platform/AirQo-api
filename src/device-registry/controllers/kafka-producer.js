const { kafkaClient } = require('../config/kafka');
const { logObject } = require("../utils/log");

const kafkaProducer = async (topic, messages) => {

  const producer = kafkaClient.producer()
  await producer.connect();

  try {
    const responses = await producer.send({
      topic: topic,
      messages: messages
    })

    logObject('Published message', { responses })
  } catch (error) {
    logObject('Error publishing message', error)
  }
}

module.exports = { kafkaProducer };
