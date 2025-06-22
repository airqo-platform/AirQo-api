const redis = require("redis");
const constants = require("./constants");
const { logObject, logText, logElement } = require("@utils/shared");
const { promisify } = require("util");

const REDIS_SERVER = constants.REDIS_SERVER;
const REDIS_PORT = constants.REDIS_PORT;
const logger = require("log4js").getLogger(
  `${constants.ENVIRONMENT} -- redis-config`
);

logElement("redis URL", REDIS_SERVER && REDIS_SERVER.concat(":", REDIS_PORT));

// Connection state tracking
let isConnected = false;
let isReady = false;
let connectionAttempts = 0;
let lastError = null;

// Enhanced Redis configuration for v3.x
const redisConfig = {
  host: REDIS_SERVER,
  port: REDIS_PORT,

  // Connection timeout settings
  connect_timeout: 10000, // 10 seconds
  command_timeout: 5000, // 5 seconds

  // Retry strategy with exponential backoff
  retry_strategy: (options) => {
    connectionAttempts++;

    if (options.error && options.error.code === "ECONNREFUSED") {
      logger.error("Redis server refused the connection");
    }

    if (options.total_retry_time > 1000 * 60 * 60) {
      logger.error("Redis retry time exhausted");
      return new Error("Retry time exhausted");
    }

    if (options.attempt > 10) {
      logger.error("Redis maximum retry attempts reached");
      return undefined; // Stop retrying
    }

    // Exponential backoff: min 1s, max 30s
    const delay = Math.min(options.attempt * 1000, 30000);
    logger.warn(`Redis retry attempt ${options.attempt} in ${delay}ms`);
    return delay;
  },

  // Disable offline queue to prevent memory issues
  enable_offline_queue: false,

  // Database selection
  db: constants.REDIS_DB || 0,

  // Password if configured
  ...(constants.REDIS_PASSWORD && { password: constants.REDIS_PASSWORD }),

  // Additional reliability options
  detect_dead_servers: true,
  socket_keepalive: true,
  socket_initialdelay: 0,
};

// Create Redis client
const client = redis.createClient(redisConfig);

// Enhanced event handlers
client.on("connect", () => {
  isConnected = true;
  logger.info(`Redis connected successfully (attempt ${connectionAttempts})`);
});

client.on("ready", () => {
  isReady = true;
  lastError = null;
  logger.info("Redis connection ready for commands");
});

client.on("error", (error) => {
  lastError = error;
  isConnected = false;
  isReady = false;

  // Log different types of errors appropriately
  if (error.code === "ECONNREFUSED") {
    logger.warn(`Redis connection refused: ${error.message}`);
  } else if (error.code === "ETIMEDOUT") {
    logger.warn(`Redis connection timeout: ${error.message}`);
  } else if (error.code === "ENOTFOUND") {
    logger.error(`Redis host not found: ${error.message}`);
  } else {
    logger.error(`Redis error: ${error.message}`);
  }

  // Don't crash the application on Redis errors
  console.error(`Redis Error: ${error.message}`);
});

client.on("end", () => {
  isConnected = false;
  isReady = false;
  logger.warn("Redis connection ended");
});

client.on("reconnecting", (delay, attempt) => {
  isConnected = false;
  isReady = false;
  logger.info(`Redis reconnecting... Attempt ${attempt}, delay: ${delay}ms`);
});

client.on("warning", (warning) => {
  logger.warn(`Redis warning: ${warning}`);
});

// Create safe promisified versions of Redis commands
const createSafeAsyncCommand = (command) => {
  const asyncCommand = promisify(client[command]).bind(client);

  return async (...args) => {
    try {
      if (!isReady) {
        throw new Error("Redis not ready");
      }
      return await asyncCommand(...args);
    } catch (error) {
      logger.warn(`Redis ${command} command failed: ${error.message}`);
      throw error;
    }
  };
};

// Safe async commands
const redisGetAsync = createSafeAsyncCommand("get");
const redisSetAsync = createSafeAsyncCommand("set");
const redisExpireAsync = createSafeAsyncCommand("expire");
const redisDelAsync = createSafeAsyncCommand("del");

// Special handling for ping command
const redisPingAsync = async (timeout = 3000) => {
  if (!isReady) {
    throw new Error("Redis not ready");
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error("Ping timeout"));
    }, timeout);

    client.ping((err, result) => {
      clearTimeout(timeoutId);
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
};

// Utility functions
const redisUtils = {
  // Check if Redis is available and ready
  isAvailable: () => isConnected && isReady,

  // Get connection status
  getStatus: () => ({
    connected: isConnected,
    ready: isReady,
    attempts: connectionAttempts,
    lastError: lastError?.message || null,
    serverInfo: client.server_info || null,
  }),

  // Safe ping with timeout
  ping: async (timeout = 3000) => {
    if (!isReady) {
      return false;
    }

    try {
      const result = await Promise.race([
        redisPingAsync(timeout),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Ping timeout")), timeout)
        ),
      ]);
      return result === "PONG";
    } catch (error) {
      logger.warn(`Redis ping failed: ${error.message}`);
      return false;
    }
  },

  // Get connection info
  getInfo: () => ({
    connected: client.connected,
    ready: client.ready,
    commandQueueLength: client.command_queue ? client.command_queue.length : 0,
    offlineQueueLength: client.offline_queue ? client.offline_queue.length : 0,
  }),

  // Force disconnect and reconnect
  reconnect: () => {
    return new Promise((resolve, reject) => {
      client.quit((err) => {
        if (err) {
          logger.warn(`Error during quit: ${err.message}`);
        }

        // Create a new client with the same config
        const newClient = redis.createClient(redisConfig);

        newClient.on("ready", () => {
          resolve(true);
        });

        newClient.on("error", (error) => {
          reject(error);
        });
      });
    });
  },
};

// Safe cache operations
const safeCacheOperations = {
  async safeGet(key, timeout = 3000) {
    if (!redisUtils.isAvailable()) {
      return null;
    }

    try {
      return await Promise.race([
        redisGetAsync(key),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Get timeout")), timeout)
        ),
      ]);
    } catch (error) {
      logger.warn(`Safe cache get failed for key ${key}: ${error.message}`);
      return null;
    }
  },

  async safeSet(key, value, expiration = 300, timeout = 3000) {
    if (!redisUtils.isAvailable()) {
      return false;
    }

    try {
      await Promise.race([
        redisSetAsync(key, value),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Set timeout")), timeout)
        ),
      ]);

      if (expiration > 0) {
        await Promise.race([
          redisExpireAsync(key, expiration),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Expire timeout")), timeout)
          ),
        ]);
      }

      return true;
    } catch (error) {
      logger.warn(`Safe cache set failed for key ${key}: ${error.message}`);
      return false;
    }
  },

  async safeDel(key, timeout = 3000) {
    if (!redisUtils.isAvailable()) {
      return false;
    }

    try {
      await Promise.race([
        redisDelAsync(key),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Delete timeout")), timeout)
        ),
      ]);
      return true;
    } catch (error) {
      logger.warn(`Safe cache delete failed for key ${key}: ${error.message}`);
      return false;
    }
  },
};

// Graceful shutdown
const gracefulShutdown = () => {
  if (client && client.connected) {
    logger.info("Shutting down Redis connection...");
    client.quit((err) => {
      if (err) {
        logger.error(`Error during Redis shutdown: ${err.message}`);
      } else {
        logger.info("Redis connection closed gracefully");
      }
    });
  }
};

// Handle process termination
process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("beforeExit", gracefulShutdown);

// Periodic health check (optional)
const startHealthCheck = (intervalMs = 60000) => {
  setInterval(async () => {
    try {
      const isHealthy = await redisUtils.ping();
      if (!isHealthy && isConnected) {
        logger.warn(
          "Redis health check failed despite connection being active"
        );
      }
    } catch (error) {
      logger.warn(`Redis health check error: ${error.message}`);
    }
  }, intervalMs);
};

// Start health monitoring
if (process.env.NODE_ENV === "production") {
  startHealthCheck();
}

// Export everything
module.exports = client;
module.exports.redisGetAsync = redisGetAsync;
module.exports.redisSetAsync = redisSetAsync;
module.exports.redisExpireAsync = redisExpireAsync;
module.exports.redisDelAsync = redisDelAsync;
module.exports.redisPingAsync = redisPingAsync;
module.exports.redisUtils = redisUtils;
module.exports.safeCacheOperations = safeCacheOperations;
module.exports.gracefulShutdown = gracefulShutdown;
module.exports.connected = () => client.connected;
module.exports.ready = () => client.ready;
