// controllers/health.controller.js
const httpStatus = require("http-status");
const log4js = require("log4js");
const constants = require("@config/constants");
const logger = log4js.getLogger(
  `${constants.ENVIRONMENT} -- health.controller`
);
const messagingService =
  require("@utils/messaging/messaging-service").getInstance();

/**
 * Basic health check controller
 * Provides a simple OK response to verify the API is up
 */
const basic = async (req, res) => {
  try {
    res.status(httpStatus.OK).json({
      success: true,
      message: "API is up and running",
      data: {
        status: "ok",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error in basic health check: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error checking API health",
      errors: { message: "Internal server error" },
    });
  }
};

/**
 * Message broker health check controller
 * Provides minimal information about broker status for authorized users
 * Hides specific broker details for security
 */
const messageBroker = async (req, res) => {
  try {
    // Get minimal broker status without details
    let isHealthy = false;

    try {
      const activeBroker = messagingService.getActiveBrokerType();
      isHealthy = !!activeBroker && messagingService.initialized;
    } catch (error) {
      logger.error(`Error getting message broker status: ${error.message}`);
      isHealthy = false;
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: "Message broker health check",
      data: {
        status: isHealthy ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(`Error checking message broker health: ${error.message}`);
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error checking message broker health",
      errors: { message: "Internal server error" },
    });
  }
};

/**
 * Detailed message broker health check controller for internal use
 * Provides comprehensive information about the broker status
 * Only accessible with valid API key
 */
const messageBrokerDetailed = async (req, res) => {
  try {
    // Get detailed broker status
    let activeBroker = null;
    let isInitialized = false;

    try {
      activeBroker = messagingService.getActiveBrokerType();
      isInitialized = messagingService.initialized;
    } catch (error) {
      logger.error(
        `Error getting detailed message broker status: ${error.message}`
      );
    }

    res.status(httpStatus.OK).json({
      success: true,
      message: "Detailed message broker health check",
      data: {
        active_broker: activeBroker || "none",
        initialized: isInitialized,
        status: activeBroker ? "ok" : "degraded",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    logger.error(
      `Error in detailed message broker health check: ${error.message}`
    );
    res.status(httpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Error checking detailed message broker health",
      errors: { message: "Internal server error" },
    });
  }
};

module.exports = {
  basic,
  messageBroker,
  messageBrokerDetailed,
};
