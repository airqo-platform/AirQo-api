const messageBrokerConfig = {
  MESSAGE_BROKER_PRIORITIES:
    process.env.MESSAGE_BROKER_PRIORITIES || "kafka,redis,rabbitmq,nats",
  DEPLOY_TOPIC: process.env.DEPLOY_TOPIC || "deploy-topic",
  RECALL_TOPIC: process.env.RECALL_TOPIC || "recall-topic",
  SITES_TOPIC: process.env.SITES_TOPIC || "sites-topic",
  IP_ADDRESS_TOPIC: process.env.IP_ADDRESS_TOPIC || "ip-address",
  NATS_SERVERS: process.env.NATS_SERVERS
    ? process.env.NATS_SERVERS.split(",")
    : ["nats://localhost:4222"],
  MESSAGE_BROKER_HEALTH_CHECK_INTERVAL: parseInt(
    process.env.MESSAGE_BROKER_HEALTH_CHECK_INTERVAL || 30000,
    10
  ),
  MESSAGE_PROCESSING_MAX_RETRIES: parseInt(
    process.env.MESSAGE_PROCESSING_MAX_RETRIES || 3,
    10
  ),
};

module.exports = messageBrokerConfig;
