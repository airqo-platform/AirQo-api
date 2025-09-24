const express = require("express");
const router = express.Router();

// Logging utility
const logError = (error, context) => {
  console.error(`[ROUTE_LOADING_ERROR] ${context}:`, error.message);
  console.error("Stack trace:", error.stack);
};

const logInfo = (message) => {
  console.info(`[ROUTE_LOADER] ${message}`);
};

const logWarning = (message) => {
  console.warn(`[ROUTE_LOADER_WARNING] ${message}`);
};

// Cache for loaded modules to prevent duplicate loading
const moduleCache = new Map();

// Safe route loader function with caching
const safeRequireRoute = (routePath, routeName) => {
  try {
    logInfo(`Loading route: ${routeName} from ${routePath}`);

    // Check if we've already loaded this module
    if (moduleCache.has(routePath)) {
      logInfo(`✓ Using cached route module: ${routeName}`);
      return moduleCache.get(routePath);
    }

    // Attempt to require the route
    const routeModule = require(routePath);

    // Validate the route module
    if (!routeModule) {
      throw new Error(`Route module is null or undefined: ${routeName}`);
    }

    if (typeof routeModule !== "function" && typeof routeModule !== "object") {
      throw new Error(
        `Route module must export a router or function: ${routeName}`
      );
    }

    // Cache the successfully loaded module
    moduleCache.set(routePath, routeModule);

    logInfo(`✓ Successfully loaded route: ${routeName}`);
    return routeModule;
  } catch (error) {
    logError(error, `Failed to load route: ${routeName} from ${routePath}`);

    // Return a dummy router that provides helpful error info
    const errorRouter = express.Router();
    errorRouter.all("*", (req, res) => {
      logWarning(
        `Request to failed route: ${routeName} - ${req.method} ${req.path}`
      );
      res.status(500).json({
        error: "Route temporarily unavailable",
        message: `The ${routeName} route failed to load during application startup`,
        path: req.path,
        method: req.method,
        routePath: routePath,
        timestamp: new Date().toISOString(),
      });
    });

    return errorRouter;
  }
};

// Safe route mounting function
const safeMountRoute = (mountPath, routePath, routeName) => {
  try {
    const routeModule = safeRequireRoute(routePath, routeName);
    router.use(mountPath, routeModule);
    logInfo(`✓ Mounted route ${routeName} at ${mountPath}`);
    return true;
  } catch (error) {
    logError(error, `Failed to mount route ${routeName} at ${mountPath}`);
    return false;
  }
};

// Load all routes safely
const routeStatus = {
  loaded: [],
  failed: [],
};

// Define all routes - NOTE: paths are relative to /api/v2/devices
const routes = [
  {
    path: "/activities",
    route: "@routes/v2/activities.routes",
    name: "activities",
  },
  {
    path: "/airqlouds",
    route: "@routes/v2/airqlouds.routes",
    name: "airqlouds",
  },
  {
    path: "/lookups",
    route: "@routes/v2/lookup.routes",
    name: "lookups",
  },
  { path: "/sites", route: "@routes/v2/sites.routes", name: "sites" },
  // MAIN DEVICES ROUTE - mounted at root "/" since we're already at /api/v2/devices
  { path: "/", route: "@routes/v2/devices.routes", name: "devices" },
  { path: "/events", route: "@routes/v2/events.routes", name: "events" },
  { path: "/readings", route: "@routes/v2/readings.routes", name: "readings" },
  { path: "/uptime", route: "@routes/v2/uptime.routes", name: "uptime" },
  { path: "/feeds", route: "@routes/v2/feeds.routes", name: "feeds" },
  {
    path: "/collocations",
    route: "@routes/v2/collocations.routes",
    name: "collocations",
  },
  {
    path: "/measurements",
    route: "@routes/v2/measurements.routes",
    name: "measurements",
  },
  { path: "/signals", route: "@routes/v2/signals.routes", name: "signals" },
  {
    path: "/locations",
    route: "@routes/v2/locations.routes",
    name: "locations",
  },
  { path: "/photos", route: "@routes/v2/photos.routes", name: "photos" },
  {
    path: "/forecasts",
    route: "@routes/v2/forecasts.routes",
    name: "forecasts",
  },
  { path: "/tips", route: "@routes/v2/tips.routes", name: "tips" },
  { path: "/kya", route: "@routes/v2/kya.routes", name: "kya" },
  { path: "/cohorts", route: "@routes/v2/cohorts.routes", name: "cohorts" },
  {
    path: "/network-status",
    route: "@routes/v2/network-status.routes",
    name: "network-status",
  },
  { path: "/grids", route: "@routes/v2/grids.routes", name: "grids" },
  { path: "/metadata", route: "@routes/v2/metadata.routes", name: "metadata" },
  { path: "/transmit", route: "@routes/v2/transmit.routes", name: "transmit" },

  { path: "/health", route: "@routes/v2/health.routes", name: "health" },
];

logInfo(`Starting to load ${routes.length} routes...`);

// Sort routes to ensure the root "/" (devices) route is loaded last
// This prevents it from catching requests meant for other routes
const sortedRoutes = routes.sort((a, b) => {
  if (a.path === "/") return 1; // "/" goes last
  if (b.path === "/") return -1; // "/" goes last
  return 0; // maintain original order for others
});

// Load all routes in the correct order
sortedRoutes.forEach(({ path, route, name }) => {
  if (safeMountRoute(path, route, name)) {
    routeStatus.loaded.push({ name, path, route });
  } else {
    routeStatus.failed.push({ name, path, route });
  }
});

// Enhanced health check endpoint - mounted before the catch-all
router.get("/loader-health", (req, res) => {
  const totalRoutes = routes.length;
  const loadedCount = routeStatus.loaded.length;
  const failedCount = routeStatus.failed.length;

  res.json({
    status: failedCount === 0 ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    routes: {
      total: totalRoutes,
      loaded: loadedCount,
      failed: failedCount,
      successRate: `${Math.round((loadedCount / totalRoutes) * 100)}%`,
    },
    loadedRoutes: routeStatus.loaded.map((route) => ({
      name: route.name,
      path: route.path,
      status: "operational",
    })),
    ...(failedCount > 0 && {
      failedRoutes: routeStatus.failed.map((route) => ({
        name: route.name,
        path: route.path,
        status: "failed",
      })),
    }),
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mountPoint: "/api/v2/devices",
  });
});

// Detailed route status endpoint - also mounted before catch-all
router.get("/routes", (req, res) => {
  res.json({
    timestamp: new Date().toISOString(),
    mountPoint: "/api/v2/devices",
    routes: routes.map(({ path, route, name }) => {
      const isLoaded = routeStatus.loaded.some((r) => r.name === name);
      const isFailed = routeStatus.failed.some((r) => r.name === name);

      return {
        name,
        path,
        module: route,
        status: isLoaded ? "loaded" : isFailed ? "failed" : "unknown",
        fullEndpoint: `/api/v2/devices${path === "/" ? "" : path}`,
        description:
          name === "devices"
            ? "Main devices endpoint (catch-all)"
            : `${name} specific operations`,
      };
    }),
  });
});

// Summary logging
logInfo(
  `Route loading complete. Loaded: ${routeStatus.loaded.length}, Failed: ${routeStatus.failed.length}`
);

if (routeStatus.failed.length > 0) {
  logWarning(
    `The following routes failed to load: ${routeStatus.failed
      .map((r) => r.name)
      .join(", ")}`
  );

  // In production, log critical failures but don't exit
  if (
    process.env.NODE_ENV === "production" &&
    routeStatus.failed.length > routes.length / 2
  ) {
    logError(
      new Error("More than 50% of routes failed to load"),
      "Critical failure in production"
    );
  }
} else {
  logInfo("🎉 All routes loaded successfully!");
}

// Log the actual endpoint mappings for clarity
logInfo("📍 Final endpoint mappings:");
routeStatus.loaded.forEach((route) => {
  const fullPath = `/api/v2/devices${route.path === "/" ? "" : route.path}`;
  logInfo(`   ${route.name}: ${fullPath}`);
});

// Export the router
module.exports = router;
