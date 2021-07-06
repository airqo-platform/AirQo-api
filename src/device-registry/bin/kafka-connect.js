const dotenv = require("dotenv");
dotenv.config();

const { kafkaMeasurementsConsumer } = require("../controllers/raw-device-measurements-consumer");
const { mongodb } = require("../config/database");

mongodb;
kafkaMeasurementsConsumer;