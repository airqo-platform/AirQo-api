const { Kafka } = require("kafkajs");
const log4js = require("log4js");
const logger = log4js.getLogger("Kafka Consumer");

const kafkaConsumer = async () => {
  const kafka = new Kafka({
    // Kafka configuration
  });

  const consumer = kafka.consumer({ groupId: "your-consumer-group" });

  try {
    await consumer.connect();
    await consumer.subscribe({ topic: "your-topic", fromBeginning: true });

    await consumer.run({
      eachMessage: async ({ topic, partition, message }) => {
        try {
          const messageData = JSON.parse(message.value.toString());
          // Process the message data, send emails, etc.
          // You can call the email sending function from here.
        } catch (error) {
          logger.error(`Error processing Kafka message: ${error}`);
        }
      },
    });
  } catch (error) {
    logger.error(`Error connecting to Kafka: ${error}`);
  }
};

module.exports = kafkaConsumer;
