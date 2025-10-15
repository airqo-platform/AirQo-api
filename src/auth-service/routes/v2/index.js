const express = require("express");
const router = express.Router();

// Enhanced logging utility for auth service
const logError = (error, context) => {
  console.error(`[AUTH_ROUTE_ERROR] ${context}:`, error.message);
  console.error("Stack trace:", error.stack);
};

const logInfo = (message) => {
  console.info(`[AUTH_ROUTE_LOADER] ${message}`);
};

const logWarning = (message) => {
  console.warn(`[AUTH_ROUTE_WARNING] ${message}`);
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
      res.status(503).json({
        error: "Auth service route temporarily unavailable",
        message: `The ${routeName} authentication route failed to load during startup`,
        service: "auth-service",
        path: req.path,
        method: req.method,
        ...(process.env.NODE_ENV === "development" && { routePath }),
        timestamp: new Date().toISOString(),
        suggestion: "Please contact system administrator if this persists",
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
    logInfo(`✓ Mounted auth route ${routeName} at ${mountPath}`);
    return true;
  } catch (error) {
    logError(error, `Failed to mount auth route ${routeName} at ${mountPath}`);
    return false;
  }
};

// Track route loading status
const routeStatus = {
  loaded: [],
  failed: [],
};

// Define all auth service routes - NOTE: paths are relative to /api/v2
const authRoutes = [
  {
    path: "/networks",
    route: "@routes/v2/networks.routes",
    name: "networks",
    description: "Network management operations",
  },
  {
    path: "/permissions",
    route: "@routes/v2/permissions.routes",
    name: "permissions",
    description: "User permission management",
  },
  {
    path: "/favorites",
    route: "@routes/v2/favorites.routes",
    name: "favorites",
    description: "User favorites management",
  },
  {
    path: "/roles",
    route: "@routes/v2/roles.routes",
    name: "roles",
    description: "Role-based access control",
  },
  {
    path: "/admin",
    route: "@routes/v2/admin.routes",
    name: "admin",
    description: "Admin setup utilities (development)",
  },
  {
    path: "/migrations",
    route: "@routes/v2/migration.routes",
    name: "migrations",
    description: "Migration utilities for deprecated fields",
  },
  {
    path: "/inquiries",
    route: "@routes/v2/inquiries.routes",
    name: "inquiries",
    description: "User inquiries and support",
  },
  {
    path: "/analytics",
    route: "@routes/v2/analytics.routes",
    name: "analytics",
    description: "Authentication analytics",
  },
  {
    path: "/candidates",
    route: "@routes/v2/candidates.routes",
    name: "candidates",
    description: "User candidate management",
  },
  {
    path: "/requests",
    route: "@routes/v2/requests.routes",
    name: "requests",
    description: "Authentication requests",
  },
  {
    path: "/defaults",
    route: "@routes/v2/defaults.routes",
    name: "defaults",
    description: "Default settings management",
  },
  {
    path: "/checklist",
    route: "@routes/v2/checklist.routes",
    name: "checklist",
    description: "Authentication checklist operations",
  },
  {
    path: "/preferences",
    route: "@routes/v2/preferences.routes",
    name: "preferences",
    description: "User preferences management",
  },
  {
    path: "/org-requests",
    route: "@routes/v2/organization-requests.routes",
    name: "org-requests",
    description: "Organization request management",
  },
  {
    path: "/notification-preferences",
    route: "@routes/v2/notification-preferences.routes",
    name: "notification-preferences",
    description: "Notification preferences management",
  },
  {
    path: "/maintenances",
    route: "@routes/v2/maintenance.routes",
    name: "maintenances",
    description: "System maintenance operations",
  },
  {
    path: "/surveys",
    route: "@routes/v2/surveys.routes",
    name: "surveys",
    description: "User surveys management",
  },
  {
    path: "/types",
    route: "@routes/v2/types.routes",
    name: "types",
    description: "Type definitions and management",
  },
  {
    path: "/tokens",
    route: "@routes/v2/tokens.routes",
    name: "tokens",
    description: "Token management and authentication",
  },
  {
    path: "/clients",
    route: "@routes/v2/clients.routes",
    name: "clients",
    description: "OAuth client management",
  },
  {
    path: "/scopes",
    route: "@routes/v2/scopes.routes",
    name: "scopes",
    description: "OAuth scope management",
  },
  {
    path: "/departments",
    route: "@routes/v2/departments.routes",
    name: "departments",
    description: "Department management",
  },
  {
    path: "/transactions",
    route: "@routes/v2/transactions.routes",
    name: "transactions",
    description: "Transaction tracking and management",
  },
  {
    path: "/campaigns",
    route: "@routes/v2/campaign.routes",
    name: "campaigns",
    description: "Campaign management operations",
  },
  {
    path: "/groups",
    route: "@routes/v2/groups.routes",
    name: "groups",
    description: "User group management",
  },
  {
    path: "/locationHistory",
    route: "@routes/v2/location-history.routes",
    name: "locationHistory",
    description: "User location history tracking",
  },
  {
    path: "/searchHistory",
    route: "@routes/v2/search-history.routes",
    name: "searchHistory",
    description: "User search history management",
  },
  {
    path: "/guests",
    route: "@routes/v2/guests.routes",
    name: "guests",
    description: "Guest user management",
  },
  {
    path: "/tenant-settings",
    route: "@routes/v2/tenant-settings.routes",
    name: "tenant-settings",
    description: "Multi-tenant settings management",
  },
  {
    path: "/users/privacy",
    route: "@routes/v2/privacy",
    name: "privacy",
    description: "User location privacy and analytics settings",
  },
  {
    path: "/behavioral",
    route: "@routes/v2/behavioral",
    name: "behavioral",
    description: "User behavioral intervention responses",
  },
  {
    path: "/research",
    route: "@routes/v2/research",
    name: "research",
    description: "Research consent and data management",
  },
  // MAIN USERS ROUTE - mounted at root "/" - should be last to avoid catching other routes
  {
    path: "/",
    route: "@routes/v2/users.routes",
    name: "users",
    description: "Core user management (catch-all)",
  },
];

logInfo(`Starting to load ${authRoutes.length} authentication routes...`);

// Sort routes to ensure the root "/" (users) route is loaded last
// This prevents it from catching requests meant for other routes
const sortedRoutes = authRoutes.sort((a, b) => {
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

// Auth service health check endpoint - mounted before catch-all
router.get("/health", (req, res) => {
  const totalRoutes = authRoutes.length;
  const loadedCount = routeStatus.loaded.length;
  const failedCount = routeStatus.failed.length;

  res.json({
    service: "auth-service",
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
      criticalAlert:
        failedCount > totalRoutes / 2
          ? "CRITICAL: More than 50% of auth routes failed"
          : null,
    }),
    environment: process.env.NODE_ENV || "development",
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    mountPoint: "/api/v2",
  });
});

// Detailed auth route status endpoint
router.get("/routes", (req, res) => {
  res.json({
    service: "auth-service",
    timestamp: new Date().toISOString(),
    mountPoint: "/api/v2",
    routes: authRoutes.map(({ path, route, name, description }) => {
      const isLoaded = routeStatus.loaded.some((r) => r.name === name);
      const isFailed = routeStatus.failed.some((r) => r.name === name);

      return {
        name,
        path,
        module: route,
        description,
        status: isLoaded ? "loaded" : isFailed ? "failed" : "unknown",
        fullEndpoint: `/api/v2${path === "/" ? "" : path}`,
        category: getCategoryForRoute(name),
      };
    }),
  });
});

// Helper function to categorize routes
function getCategoryForRoute(routeName) {
  const categories = {
    core: ["users", "roles", "permissions", "tokens"],
    oauth: ["clients", "scopes", "tokens"],
    management: ["networks", "departments", "groups", "tenant-settings"],
    user_data: ["preferences", "favorites", "locationHistory", "searchHistory"],
    system: ["analytics", "maintenances", "types", "defaults"],
    requests: [
      "requests",
      "inquiries",
      "candidates",
      "org-requests",
      "surveys",
    ],
    notifications: ["notification-preferences", "campaigns"],
    misc: ["checklist", "transactions", "guests"],
  };

  for (const [category, routes] of Object.entries(categories)) {
    if (routes.includes(routeName)) {
      return category;
    }
  }
  return "uncategorized";
}

// Summary logging
logInfo(
  `Auth route loading complete. Loaded: ${routeStatus.loaded.length}, Failed: ${routeStatus.failed.length}`
);

if (routeStatus.failed.length > 0) {
  logWarning(
    `The following auth routes failed to load: ${routeStatus.failed
      .map((r) => r.name)
      .join(", ")}`
  );

  // In production, log critical failures but don't exit
  if (
    process.env.NODE_ENV === "production" &&
    routeStatus.failed.length > authRoutes.length / 2
  ) {
    logError(
      new Error("More than 50% of authentication routes failed to load"),
      "CRITICAL AUTH SERVICE FAILURE"
    );
  }
} else {
  logInfo("🎉 All v2 authentication routes loaded successfully!");
}

// Log the actual endpoint mappings for clarity
logInfo("📍 Auth service endpoint mappings:");
routeStatus.loaded.forEach((route) => {
  const fullPath = `/api/v2${route.path === "/" ? "" : route.path}`;
  logInfo(`   ${route.name}: ${fullPath}`);
});

// Export route status for external monitoring
router.getRouteStatus = () => ({
  total: authRoutes.length,
  loaded: routeStatus.loaded.length,
  failed: routeStatus.failed.length,
  status: routeStatus.failed.length === 0 ? "healthy" : "degraded",
});

// Export the router
module.exports = router;
