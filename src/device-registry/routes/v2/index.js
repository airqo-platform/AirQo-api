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

// Safe route loader function
const safeRequireRoute = (routePath, routeName) => {
  try {
    logInfo(`Loading route: ${routeName}`);

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

    logInfo(`✓ Successfully loaded route: ${routeName}`);
    return routeModule;
  } catch (error) {
    logError(error, `Failed to load route: ${routeName}`);

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

// Load each route with error handling
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
  { path: "/sites", route: "@routes/v2/sites.routes", name: "sites" },
  { path: "/devices", route: "@routes/v2/devices.routes", name: "devices" },
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
];

// Load all routes
routes.forEach(({ path, route, name }) => {
  if (safeMountRoute(path, route, name)) {
    routeStatus.loaded.push({ name, path });
  } else {
    routeStatus.failed.push({ name, path });
  }
});

// Handle the catch-all route (last route)
if (safeMountRoute("/", "@routes/v2/devices.routes", "devices-catchall")) {
  routeStatus.loaded.push({ name: "devices-catchall", path: "/" });
} else {
  routeStatus.failed.push({ name: "devices-catchall", path: "/" });
}

// Health check endpoint
router.get("/health", (req, res) => {
  res.json({
    status: routeStatus.failed.length === 0 ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    routes: {
      total: routes.length + 1, // +1 for catch-all route
      loaded: routeStatus.loaded.length,
      failed: routeStatus.failed.length,
    },
    loadedRoutes: routeStatus.loaded,
    failedRoutes: routeStatus.failed,
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
}

module.exports = router;
