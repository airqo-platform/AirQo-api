const dotenv = require("dotenv");
dotenv.config();

const { rawEventsConsumer } = require("../controllers/events-consumer");
const { mongodb } = require("../config/database");

mongodb;
rawEventsConsumer;