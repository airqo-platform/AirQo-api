const constants = require("@config/constants");
const log4js = require("log4js");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- sync-networks-job`,
);
const NetworkModel = require("@models/Network");
const cron = require("node-cron");
const axios = require("axios");
const { Types } = require("mongoose");
const { logObject, logText } = require("@utils/shared");
const { getSchedule } = require("@utils/common");

// Job configuration
const JOB_NAME = "sync-networks-job";
const JOB_SCHEDULE = getSchedule("0 */1 * * *", constants.ENVIRONMENT); // Every hour

// Global state management
let isJobRunning = false;
let currentJobPromise = null;

/**
 * Validates that the required configuration constants are present.
 * @returns {{isValid: boolean, missingConfigs: Array<string>}}
 */
const validateConfiguration = () => {
  const missingConfigs = [];
  if (!constants.API_BASE_URL) {
    missingConfigs.push("API_BASE_URL");
  }
  return {
    isValid: missingConfigs.length === 0,
    missingConfigs,
  };
};

/**
 * Initializes and configures the axios client for the auth-service API.
 * @returns {axios.AxiosInstance | null}
 */
const initializeApiClient = () => {
  const { isValid, missingConfigs } = validateConfiguration();
  if (!isValid) {
    logger.warn(
      `⚠️ API client not initialized. Missing configuration: ${missingConfigs.join(
        ", ",
      )}`,
    );
    return null;
  }

  const apiClient = axios.create({
    baseURL: constants.API_BASE_URL,
  });

  // Add response interceptor for better error handling
  apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error.code === "ENOTFOUND" || error.code === "EAI_AGAIN") {
        logger.error(
          `API DNS resolution error for ${error.config?.baseURL}. Check API_BASE_URL and network connectivity.`,
        );
      } else if (error.code === "ECONNABORTED") {
        logger.error(
          `API request timeout: ${error.config?.url}`,
          error.message,
        );
      } else if (error.response?.status >= 500) {
        logger.error(
          `API server error: ${error.response?.status} ${error.response?.statusText}`,
        );
      }
      return Promise.reject(error);
    },
  );

  return apiClient;
};

const apiClient = initializeApiClient();

/**
 * Fetches all networks from the auth-service.
 * Handles pagination to retrieve all records.
 * @returns {Promise<Array>} A list of networks from the auth-service.
 */
const fetchAuthServiceNetworks = async () => {
  const MAX_RETRIES = 3;
  const RETRY_DELAY_MS = 5000; // 5 seconds
  if (!apiClient) {
    logger.error("API client is not initialized; cannot fetch networks.");
    return [];
  }

  let allNetworks = [];
  let page = 1;
  const limit = 100; // Fetch 100 networks per page
  let hasMore = true;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    allNetworks = [];
    page = 1;
    hasMore = true;
    let success = true;

    while (hasMore) {
      try {
        const response = await apiClient.get("/api/v2/users/networks", {
          params: { tenant: "airqo", page, limit },
        });

        if (response.data && response.data.success) {
          const networks = response.data.networks || [];
          if (networks.length > 0) {
            allNetworks = allNetworks.concat(networks);
          }

          if (networks.length < limit) {
            hasMore = false;
          } else {
            page++;
          }
        } else {
          logger.error(
            `Failed to fetch page ${page} of networks: ${response.data
              .message || "Unknown error"}`,
          );
          hasMore = false;
          success = false;
        }
      } catch (error) {
        logger.error(
          `Error on page ${page} calling auth-service. Message: ${
            error.message
          }. Code: ${error.code || "N/A"}`,
        );
        hasMore = false;
        success = false;
      }
    }

    if (success) {
      return allNetworks; // Successfully fetched all networks
    }

    if (attempt < MAX_RETRIES) {
      logger.warn(
        `Attempt ${attempt} failed. Retrying in ${RETRY_DELAY_MS /
          1000} seconds...`,
      );
      await new Promise((res) => setTimeout(res, RETRY_DELAY_MS));
    }
  }

  logger.error(`All ${MAX_RETRIES} attempts to fetch networks failed.`);
  return [];
};

/**
 * Fetches all networks from the local device-registry database.
 * @returns {Promise<Array>} A list of networks from the local database.
 */
const fetchDeviceRegistryNetworks = async () => {
  try {
    return await NetworkModel("airqo")
      .find({})
      .lean();
  } catch (error) {
    logger.error(
      `Error fetching networks from device-registry DB: ${error.message}`,
    );
    return [];
  }
};

/**
 * Compares and reconciles network lists from both services.
 * @param {Array} authNetworks - Networks from the source of truth (auth-service).
 * @param {Array} registryNetworks - Networks from the local DB (device-registry).
 */
const reconcileNetworks = async (authNetworks, registryNetworks) => {
  // Use 'name' as the unique key for synchronization, not '_id'
  const authNetworkMap = new Map(
    authNetworks.map((net) => [net.net_name, net]),
  );
  const registryNetworkMap = new Map(
    // Ensure we use 'name' which is guaranteed to be consistent
    registryNetworks.map((net) => [net.name, net]),
  );

  const bulkOps = [];

  // Identify networks to create or update
  for (const [authNetName, authNet] of authNetworkMap.entries()) {
    // Explicitly pick fields to prevent unexpected data from auth-service
    const updateData = {
      net_name: authNet.net_name,
      net_acronym: authNet.net_acronym,
      net_status: authNet.net_status,
      net_manager: authNet.net_manager,
      net_manager_username: authNet.net_manager_username,
      net_manager_firstname: authNet.net_manager_firstname,
      net_manager_lastname: authNet.net_manager_lastname,
      net_email: authNet.net_email,
      net_website: authNet.net_website,
      net_category: authNet.net_category,
      net_data_source: authNet.net_data_source,
      net_description: authNet.net_description,
      net_profile_picture: authNet.net_profile_picture,
    };

    bulkOps.push({
      updateOne: {
        // Use the unique 'name' for filtering
        filter: { name: authNetName },
        update: {
          $set: {
            ...updateData,
            name: authNet.net_name, // keep legacy name in sync
          },
          $setOnInsert: {
            // Preserve the original _id from auth-service on first insert
            _id: Types.ObjectId(authNet._id),
          },
        },
        upsert: true,
      },
    });
  }

  // Identify networks to delete
  for (const registryNetName of registryNetworkMap.keys()) {
    if (!authNetworkMap.has(registryNetName)) {
      // Network exists here but not in auth-service, so delete it.
      bulkOps.push({
        deleteOne: {
          filter: { name: registryNetName },
        },
      });
    }
  }

  if (bulkOps.length === 0) {
    logText("✅ No network changes detected. Databases are in sync.");
    return;
  }

  logObject("Number of bulk operations to perform:", bulkOps.length);

  try {
    const result = await NetworkModel("airqo").bulkWrite(bulkOps);
    logText("🚀 Bulk write operation completed successfully.");
    logObject("Bulk write result:", {
      inserted: result.insertedCount,
      updated: result.modifiedCount,
      deleted: result.deletedCount,
    });
  } catch (error) {
    logger.error(`🐛🐛 Bulk write operation failed: ${error.message}`);
  }
};

/**
 * Main function to perform the network synchronization.
 */
const performNetworkSync = async () => {
  if (isJobRunning) {
    logger.warn(`${JOB_NAME} is already running, skipping this execution.`);
    return;
  }

  isJobRunning = true;
  currentJobPromise = (async () => {
    try {
      const { isValid, missingConfigs } = validateConfiguration();
      if (!isValid) {
        global.dedupLogger.error(
          `🚫 ${JOB_NAME} skipped: Missing required configuration - ${missingConfigs.join(
            ", ",
          )}`,
        );
        global.dedupLogger.error(
          `🔧 Please set the following environment variables: ${missingConfigs.join(
            ", ",
          )}`,
        );
        return;
      }

      logText(`🚀 Starting ${JOB_NAME}...`);

      // Phase 1: Fetch data from both sources
      const [authNetworks, registryNetworks] = await Promise.all([
        fetchAuthServiceNetworks(),
        fetchDeviceRegistryNetworks(),
      ]);

      if (!authNetworks || authNetworks.length === 0) {
        logger.warn(
          "Could not fetch networks from auth-service, or no networks found. Skipping sync.",
        );
        return;
      }

      logObject("Networks from auth-service:", authNetworks.length);
      logObject("Networks from device-registry:", registryNetworks.length);

      // Phase 2 & 3: Reconcile and execute changes
      await reconcileNetworks(authNetworks, registryNetworks);

      logText(`✅ ${JOB_NAME} finished successfully.`);
    } catch (error) {
      logger.error(`🐛🐛 Error during ${JOB_NAME} execution: ${error.message}`);
    }
  })();

  try {
    await currentJobPromise;
  } finally {
    isJobRunning = false;
    currentJobPromise = null;
  }
};

/**
 * Creates and registers the cron job.
 */
const start = () => {
  const cronJob = cron.schedule(
    JOB_SCHEDULE,
    async () => {
      await performNetworkSync();
    },
    {
      scheduled: true,
      timezone: constants.TIMEZONE,
    },
  );

  if (!global.cronJobs) {
    global.cronJobs = {};
  }

  global.cronJobs[JOB_NAME] = {
    job: cronJob,
    stop: async () => {
      logText(`🛑 Stopping ${JOB_NAME}...`);
      cronJob.stop();
      logText(`📅 ${JOB_NAME} schedule stopped.`);
      if (currentJobPromise) {
        await currentJobPromise;
      }
      delete global.cronJobs[JOB_NAME];
    },
  };

  // Initial run on startup
  setTimeout(async () => {
    logText(`🚀 Initial run of ${JOB_NAME} on startup...`);
    await performNetworkSync();
  }, 30000); // Delay initial run to allow services to start

  console.log(`✅ ${JOB_NAME} registered and started.`);
};

// Graceful shutdown handler
const handleShutdown = async (signal) => {
  logText(`📨 ${JOB_NAME} received ${signal} signal.`);
  if (global.cronJobs && global.cronJobs[JOB_NAME]) {
    await global.cronJobs[JOB_NAME].stop();
  }
  logText(`👋 ${JOB_NAME} shutdown complete.`);
};

// Register shutdown handlers
process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

module.exports = {
  start,
  performNetworkSync,
};

// To run the job, you would typically call start() from your main application entry point.
// For example, in your `index.js` or a dedicated jobs loader:
// const syncNetworksJob = require('./bin/jobs/sync-networks-job');
// syncNetworksJob.start();
