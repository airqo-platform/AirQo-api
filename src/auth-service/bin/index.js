const kafkaConsumer = require("./kafka-consumer");
const sendEmail = require("@utils/mailer");
const createServer = require("./server");

const main = async () => {
  // Start Kafka Consumer
  kafkaConsumer();

  // Set up and start the HTTP server
  createServer();
};

main().catch((error) => {
  console.error("Error starting the application: ", error);
});
