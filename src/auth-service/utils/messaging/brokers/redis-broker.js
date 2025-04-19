// src/utils/messaging/brokers/redis-broker.js
const Redis = require("ioredis");
const BaseBroker = require("./base-broker");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(`${constants.ENVIRONMENT} -- redis-broker`);

class RedisBroker extends BaseBroker {
  constructor(config = {}) {
    super(config);
    this.publishClient = null;
    this.subscribeClient = null;
    this.subscribers = new Map();
    this.retryAttempts = 0;
    this.maxRetryAttempts = config.maxRetryAttempts || 5;
    this.retryDelay = config.retryDelay || 5000; // 5 seconds
    this.connectionTimeout =
      constants.MESSAGE_BROKER_CONNECTION_TIMEOUT_MS || 5000;
  }

  getName() {
    return "redis";
  }

  async connect() {
    try {
      const redisOptions = {
        host: this.config.host || constants.REDIS_HOST || "localhost",
        port: this.config.port || constants.REDIS_PORT || 6379,
        password: this.config.password || constants.REDIS_PASSWORD,
        db: this.config.db || constants.REDIS_DB || 0,
        connectTimeout: this.connectionTimeout,
        retryStrategy: (times) => {
          if (times > this.maxRetryAttempts) {
            return null; // Stop retrying
          }
          return this.retryDelay;
        },
      };

      // Create publish client
      this.publishClient = new Redis(redisOptions);

      this.publishClient.on("error", (err) => {
        logger.error(`Redis publisher error: ${err.message}`);
        this.isConnected = false;
      });

      this.publishClient.on("connect", () => {
        this.isConnected = true;
        this.retryAttempts = 0;
        logger.info("Redis publisher connected");
      });

      return new Promise((resolve, reject) => {
        // Set up a timeout for the connection attempt
        const connectionTimer = setTimeout(() => {
          if (!this.isConnected) {
            logger.error(
              `Redis connection timed out after ${this.connectionTimeout}ms`
            );
            reject(new Error("Redis connection timeout"));
          }
        }, this.connectionTimeout);

        this.publishClient.once("ready", () => {
          clearTimeout(connectionTimer);
          this.isConnected = true;
          resolve(true);
        });

        this.publishClient.once("error", (err) => {
          clearTimeout(connectionTimer);
          logger.error(`Redis connection error: ${err.message}`);
          reject(err);
        });
      });
    } catch (error) {
      logger.error(`Failed to connect to Redis: ${error.message}`);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect() {
    try {
      if (this.publishClient) {
        await this.publishClient.quit();
      }

      if (this.subscribeClient) {
        await this.subscribeClient.quit();
      }

      this.isConnected = false;
      return true;
    } catch (error) {
      logger.error(`Failed to disconnect from Redis: ${error.message}`);
      return false; // Don't throw, just return false
    }
  }

  async publishMessage(topic, message, messageId = null) {
    try {
      if (!this.isConnected) {
        const connected = await this.connect();
        if (!connected) {
          throw new Error("Failed to connect to Redis");
        }
      }

      const payload =
        typeof message === "string" ? message : JSON.stringify(message);

      // If messageId is provided, store in a Redis hash for deduplication
      if (messageId) {
        const messageKey = `message:${topic}:${messageId}`;
        await this.publishClient.hset(messageKey, {
          payload,
          timestamp: Date.now(),
        });
        // Set expiry on message (e.g., 24 hours)
        await this.publishClient.expire(messageKey, 86400);
      }

      // Publish to Redis channel with timeout
      const publishPromise = this.publishClient.publish(topic, payload);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Publish operation timeout")),
          this.connectionTimeout
        )
      );

      await Promise.race([publishPromise, timeoutPromise]);
      return true;
    } catch (error) {
      logger.error(`Failed to publish message to Redis: ${error.message}`);
      this.isConnected = false;
      throw error;
    }
  }

  async subscribe(topics, groupId, messageHandler) {
    try {
      // Create subscribe client if it doesn't exist
      if (!this.subscribeClient) {
        const redisOptions = {
          host: this.config.host || constants.REDIS_HOST || "localhost",
          port: this.config.port || constants.REDIS_PORT || 6379,
          password: this.config.password || constants.REDIS_PASSWORD,
          db: this.config.db || constants.REDIS_DB || 0,
          connectTimeout: this.connectionTimeout,
        };

        this.subscribeClient = new Redis(redisOptions);

        this.subscribeClient.on("error", (err) => {
          logger.error(`Redis subscriber error: ${err.message}`);
        });
      }

      // Subscribe to all provided topics with timeout
      const topicsList = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicsList) {
        // Save the handler to our map
        this.subscribers.set(topic, messageHandler);

        // Subscribe to the topic with timeout
        const subscribePromise = this.subscribeClient.subscribe(topic);
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error(`Subscribe to ${topic} timed out`)),
            this.connectionTimeout
          )
        );

        await Promise.race([subscribePromise, timeoutPromise]);
      }

      // Set up the message handler once
      if (!this.messageHandlerSet) {
        this.subscribeClient.on("message", async (channel, message) => {
          try {
            const handler = this.subscribers.get(channel);
            if (handler) {
              await handler(channel, message);
            }
          } catch (error) {
            logger.error(`Error processing Redis message: ${error.message}`);
          }
        });

        this.messageHandlerSet = true;
      }

      return true;
    } catch (error) {
      logger.error(`Failed to subscribe to Redis topics: ${error.message}`);
      return false; // Don't throw, just return false
    }
  }

  isHealthy() {
    return (
      this.isConnected &&
      this.publishClient &&
      this.publishClient.status === "ready"
    );
  }
}

module.exports = RedisBroker;
