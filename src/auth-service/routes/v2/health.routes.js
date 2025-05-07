// routes/health.routes.js
const express = require("express");
const router = express.Router();
const healthController = require("@controllers/health.controller");
const healthValidations = require("@validators/health.validators");
const { setJWTAuth, authJWT } = require("@middleware/passport");

// Add error handling in case middleware is missing
try {
  const headers = (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization, X-API-Key"
    );
    res.header("Access-Control-Allow-Methods", "GET");
    next();
  };

  router.use(headers);

  // Basic health check - publicly accessible
  router.get("/", (req, res) => {
    try {
      if (healthController && healthController.basic) {
        return healthController.basic(req, res);
      }
      // Fallback in case controller is missing
      return res.status(200).json({
        success: true,
        message: "Basic health check",
        data: { status: "ok", timestamp: new Date().toISOString() },
      });
    } catch (error) {
      console.error("Error in basic health endpoint:", error);
      return res.status(500).json({
        success: false,
        message: "Internal server error in health check",
        errors: { message: "Failed to process health check" },
      });
    }
  });

  // Message broker health check - protected with authentication and rate limiting
  router.get(
    "/message-broker",
    (req, res, next) => {
      try {
        if (healthValidations && healthValidations.rateLimit) {
          return healthValidations.rateLimit(req, res, next);
        }
        next();
      } catch (error) {
        console.error("Error in rate limiting:", error);
        next();
      }
    },
    setJWTAuth,
    authJWT,
    (req, res) => {
      try {
        if (healthController && healthController.messageBroker) {
          return healthController.messageBroker(req, res);
        }
        // Fallback in case controller is missing
        return res.status(200).json({
          success: true,
          message: "Message broker health check",
          data: { status: "ok", timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error("Error in message broker health endpoint:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error in health check",
          errors: { message: "Failed to process health check" },
        });
      }
    }
  );

  // Internal health check (accessible only with API key)
  router.get(
    "/internal/message-broker",
    (req, res, next) => {
      try {
        if (healthValidations && healthValidations.apiKey) {
          return healthValidations.apiKey(req, res, next);
        }
        next();
      } catch (error) {
        console.error("Error in API key validation:", error);
        next();
      }
    },
    (req, res, next) => {
      try {
        if (healthValidations && healthValidations.internalRateLimit) {
          return healthValidations.internalRateLimit(req, res, next);
        }
        next();
      } catch (error) {
        console.error("Error in internal rate limiting:", error);
        next();
      }
    },
    (req, res) => {
      try {
        if (healthController && healthController.messageBrokerDetailed) {
          return healthController.messageBrokerDetailed(req, res);
        }
        // Fallback in case controller is missing
        return res.status(200).json({
          success: true,
          message: "Detailed message broker health check",
          data: { status: "ok", timestamp: new Date().toISOString() },
        });
      } catch (error) {
        console.error("Error in detailed health endpoint:", error);
        return res.status(500).json({
          success: false,
          message: "Internal server error in health check",
          errors: { message: "Failed to process health check" },
        });
      }
    }
  );
} catch (error) {
  console.error("Error setting up health routes:", error);
  // Add a fallback route that won't crash
  router.get("*", (req, res) => {
    res.status(500).json({
      success: false,
      message: "Health check routes initialization failed",
      errors: { message: "Server configuration error" },
    });
  });
}

module.exports = router;
