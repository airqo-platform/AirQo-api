const express = require("express");
const router = express.Router();
const extractController = require("../controllers/extract");
const kafkaConsumerController = require("../controllers/kafka-consumer");
const kafkaProducerController = require("../controllers/kafka-producer");
const kafkaTopicsController = require("../controllers/kafka-topics");
const middlewareConfig = require("../config/router.middleware");
const loadController = require("../controllers/load");
const transformController = require("../controllers/transform");
const createComponentController = require("../controllers/create-component");
const utilsPushMeasurements = require("../utils/airqo-insert-one");

middlewareConfig(router);

router.post("/components", createComponentController.createComponents);
router.post("/types", createComponentController.createComponentTypes);
router.post("/push", utilsPushMeasurements);
// router.get("/load", loadController);
// router.get("/extract", extractController);
// router.get("/transform", transformController);

module.exports = router;
