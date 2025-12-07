//src/device-registry/routes/v2/readings.routes.js
const express = require("express");
const router = express.Router();

// Safe require function
const safeRequire = (modulePath, fallback = null) => {
  try {
    return require(modulePath);
  } catch (error) {
    console.error(
      `[SAFE_REQUIRE_ERROR] Failed to load module: ${modulePath}`,
      error.message
    );
    return fallback;
  }
};

// Safely load dependencies
const eventController = safeRequire("@controllers/event.controller");
const readingsValidations = safeRequire("@validators/readings.validators");
const { headers, pagination } = safeRequire("@validators/common", {
  headers: null,
  pagination: () => (req, res, next) => next(),
});

// Middleware to check if controller exists
const checkController = (controllerMethod) => {
  return (req, res, next) => {
    if (
      !eventController ||
      typeof eventController[controllerMethod] !== "function"
    ) {
      return res.status(500).json({
        error: "Controller method not available",
        method: controllerMethod,
      });
    }
    next();
  };
};

// Updated validation middleware that properly handles validation arrays
const checkValidation = (validationMethod) => {
  return (req, res, next) => {
    if (!readingsValidations) {
      console.warn(`[VALIDATION_WARNING] Validation module not loaded`);
      return next(); // Continue without validation
    }

    const validation = readingsValidations[validationMethod];

    if (!validation) {
      console.warn(
        `[VALIDATION_WARNING] Validation method not found: ${validationMethod}`
      );
      return next(); // Continue without validation
    }

    // Check if it's a function (middleware)
    if (typeof validation === "function") {
      return validation(req, res, next);
    }

    // Check if it's an array of validation rules
    if (Array.isArray(validation)) {
      // Apply all validation rules in sequence
      let currentIndex = 0;

      const runNextValidation = () => {
        if (currentIndex >= validation.length) {
          return next(); // All validations passed
        }

        const currentValidation = validation[currentIndex++];

        if (typeof currentValidation === "function") {
          // Handle middleware functions
          currentValidation(req, res, runNextValidation);
        } else if (currentValidation && currentValidation.run) {
          // Handle express-validator validation chains
          currentValidation
            .run(req)
            .then(() => {
              runNextValidation();
            })
            .catch((error) => {
              console.error(`[VALIDATION_ERROR] ${error.message}`);
              next(error);
            });
        } else {
          // Skip invalid validation and continue
          runNextValidation();
        }
      };

      runNextValidation();
    } else {
      console.warn(
        `[VALIDATION_WARNING] Validation method ${validationMethod} is neither function nor array`
      );
      return next(); // Continue without validation
    }
  };
};

// Safe middleware application
if (headers && typeof headers === "function") {
  router.use(headers);
} else {
  console.warn("[MIDDLEWARE_WARNING] Headers middleware not available");
}

// Define routes with safety checks
const routes = [
  {
    method: "get",
    path: "/map",
    middlewares: [checkValidation("map")],
    controller: "readingsForMap",
  },
  {
    method: "get",
    path: "/best-air-quality",
    middlewares: [checkValidation("bestAirQuality"), pagination()],
    controller: "getBestAirQuality",
  },
  {
    method: "get",
    path: "/recent",
    middlewares: [checkValidation("recent")],
    controller: "recentReadings",
  },
  {
    method: "get",
    path: "/worst/devices",
    middlewares: [checkValidation("worstReadingForDevices")],
    controller: "getWorstReadingForDevices",
  },
  {
    method: "get",
    path: "/worst/sites",
    middlewares: [checkValidation("worstReadingForSites")],
    controller: "getWorstReadingForSites",
  },
  {
    method: "get",
    path: "/sites/:site_id/averages",
    middlewares: [checkValidation("listAverages"), pagination()],
    controller: "listReadingAverages",
  },
  {
    method: "get",
    path: "/fetchAndStoreData",
    middlewares: [pagination()],
    controller: "fetchAndStoreData",
  },
  {
    method: "get",
    path: "/nearest",
    middlewares: [checkValidation("nearestReadings"), pagination()],
    controller: "getNearestReadings",
  },
];

// Register routes safely
routes.forEach(({ method, path, middlewares, controller }) => {
  try {
    const routeHandler = [
      ...middlewares,
      checkController(controller),
      (req, res, next) => {
        // Wrap controller call in try-catch
        try {
          eventController[controller](req, res, next);
        } catch (error) {
          console.error(
            `[CONTROLLER_ERROR] Error in ${controller}:`,
            error.message
          );
          res.status(500).json({
            error: "Internal server error",
            message: "Controller execution failed",
          });
        }
      },
    ];

    router[method](path, ...routeHandler);
    console.log(`[ROUTE_REGISTERED] ${method.toUpperCase()} ${path}`);
  } catch (error) {
    console.error(
      `[ROUTE_REGISTRATION_ERROR] Failed to register route ${method.toUpperCase()} ${path}:`,
      error.message
    );
  }
});

module.exports = router;
