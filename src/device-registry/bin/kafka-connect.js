const dotenv = require("dotenv");
dotenv.config();

const { rawEventsConsumer, kafkaNodeConsumer } = require("../controllers/events-consumer");
const { mongodb } = require("../config/database");

mongodb;
kafkaNodeConsumer();
// rawEventsConsumer().catch(console.error)