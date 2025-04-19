// src/utils/messaging/broker-factory.js
const KafkaBroker = require("./brokers/kafka-broker");
const RedisBroker = require("./brokers/redis-broker");
const RabbitMQBroker = require("./brokers/rabbitmq-broker");
const NatsBroker = require("./brokers/nats-broker");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- broker-factory`);

class MessageBrokerFactory {
  static getBroker(type, config) {
    switch (type) {
      case "kafka":
        return new KafkaBroker(config);
      case "redis":
        return new RedisBroker(config);
      case "rabbitmq":
        return new RabbitMQBroker(config);
      case "nats":
        return new NatsBroker(config);
      default:
        throw new Error(`Unsupported broker type: ${type}`);
    }
  }
}

// Create a prioritized list of brokers to try
// This will be used by the redundancy manager
const getBrokerPriorities = () => {
  // This could be configured in your environment or constants
  const brokerPriorities =
    constants.MESSAGE_BROKER_PRIORITIES || "kafka,redis,rabbitmq,nats";
  return brokerPriorities.split(",");
};

module.exports = {
  MessageBrokerFactory,
  getBrokerPriorities,
};
