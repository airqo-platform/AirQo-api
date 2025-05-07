// src/utils/messaging/brokers/base-broker.js
class BaseBroker {
  constructor(config) {
    this.config = config;
    this.isConnected = false;
    this.client = null;
  }

  async connect() {
    throw new Error("Method not implemented");
  }

  async disconnect() {
    throw new Error("Method not implemented");
  }

  async publishMessage(topic, message, key = null) {
    throw new Error("Method not implemented");
  }

  async subscribe(topics, groupId, messageHandler) {
    throw new Error("Method not implemented");
  }

  isHealthy() {
    return this.isConnected;
  }

  getName() {
    throw new Error("Method not implemented");
  }
}

module.exports = BaseBroker;
