const dotenv = require("dotenv");
dotenv.config();

const { rawEventsConsumer, rawEventsConsumerV2 } = require("../controllers/events-consumer");
const { mongodb } = require("../config/database");

mongodb;
// rawEventsConsumerV2();
rawEventsConsumer().catch(console.error)