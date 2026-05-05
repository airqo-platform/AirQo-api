# Project Codebase Structure and Naming Conventions

This document outlines the project's codebase structure and naming conventions, designed to enhance readability, maintainability, and scalability. The project utilizes the Model-View-Controller (MVC) architectural pattern.

## Core Folder Structure

The project follows a standard MVC structure with additional folders for common utilities and shared functions to prevent circular dependencies.

```
.
├── bin                       # Scripts for running background jobs (e.g., Kafka consumer)
│   └── jobs                  # Individual job scripts
├── config                    # Configuration files
│   ├── environments          # (empty — shim files deleted; see Configuration Structure below)
│   └── definitions           # Static application definitions (AQI constants, mappings, projections …)
│       └── index.js          # Aggregates all definitions
├── controllers               # API controllers (e.g., device.controller.js, site.controller.js)
├── models                    # Mongoose models (e.g., Device.js, Site.js)
├── routes                    # API routes (e.g., v1, v2)
│   ├── v1                    # Version 1 routes
│   └── v2                    # Version 2 routes
├── utils                     # Utility functions
│   ├── common                # Utility functions common across multiple microservices
│   ├── scripts               # Scripts for data migration and other tasks
│   └── shared                # Utility functions shared across multiple utils files (to prevent circular dependencies)
└── validators                # Express.js validators (e.g., device.validators.js, site.validators.js)
    ├── common                # Validation functions common across multiple microservices
    └── shared                # Validation functions shared across multiple validators files (to prevent circular dependencies)

```

## File Naming Conventions

The project employs a consistent naming convention for all files:

- **Controllers:** `<entity>.controller.js` (e.g., `device.controller.js`, `health-tips.controller.js`)
- **Models:** `<Entity>.js` (e.g., `Device.js`, `HealthTip.js`) Note the capitalization of the entity name.
- **Utils:** `<entity>.util.js` (e.g., `device.util.js`, `health-tips.util.js`)
- **Routes:** `<version>/<entity>.routes.js` (e.g., `v2/device.routes.js`)
- **Validators:** `<entity>.validators.js` (e.g., `device.validators.js`, `health-tips.validators.js`)

Long file or folder names are separated using hyphens (e.g., `health-tips.controller.js`).

## Configuration Structure (`config` folder)

The `config` folder is structured to manage environment-specific and global configurations effectively:

- **`environments` subfolder:** Previously held per-environment prefix→canonical alias shims (`development.js`, `staging.js`, `production.js`). These have been deleted now that each environment loads its own `.env.{NODE_ENV}.json` file with canonical key names directly.
- **`definitions` subfolder:** Pure static application definitions — AQI constants, device mappings, network adapters, URL builders, DB projections, validation lists, regex patterns. No environment-specific logic. An `index.js` file aggregates everything.
- **`env-loader.js`:** Loaded at app startup. Reads `.env.{NODE_ENV}.json` and applies all non-empty values to `process.env`. Variables already set by Docker/K8s/shell are never overwritten. Logs a warning if the JSON file is absent and continues with whatever is already in `process.env`.
- **`constants.js`:** Imports `definitions` and reads directly from `process.env` (populated by `env-loader.js`). Applies computed transformations (boolean parsing, CSV→array, Redis URL construction). All environment variables are accessed as canonical names — no prefix mapping required.

Adding a new environment variable requires editing only the three `.env.{env}.json` files (one per environment) and the three `.env.{env}.template.json` files (tracked in git as the key reference). No JS file changes are needed.

## Constants Naming Conventions and Organization

To prevent namespace collisions and improve maintainability, the following conventions apply to all constant definitions:

### Constants File Structure

```
config/
├── constants.js              # Main config — merges process.env + definitions, applies transformations
├── env-loader.js             # Startup loader: reads .env.{NODE_ENV}.json → process.env
├── environments/             # (empty — shim files deleted; canonical names now in JSON files)
└── definitions/              # Static application definitions
    ├── index.js             # Aggregates all definitions
    ├── app-constants.js     # String/numeric/regex/list constants (merged from 4 former files)
    ├── aqi.js               # Air Quality Index constants (ranges, colours, breakpoints)
    ├── country-flags.js     # ISO country codes + flag URL helper
    ├── db-projections.js    # MongoDB projection objects
    ├── envs.js              # env-var-backed constants (CSV→array, defaults)
    ├── mappings.js          # Field/event/ThingSpeak/BAM mapping tables
    ├── networks.js          # Network adapter configs (AirGradient, IQAir, etc.)
    └── urls.js              # URL builder functions (ThingSpeak, Google, Nominatim)
```

### Constant Naming Conventions

**Use descriptive prefixes to indicate purpose and data type:**

- **Objects for display/labels:** `<DOMAIN>_CATEGORIES`, `<DOMAIN>_LABELS`
- **Arrays for iteration/validation:** `<DOMAIN>_CATEGORY_KEYS`, `<DOMAIN>_LIST`
- **Configuration objects:** `<DOMAIN>_CONFIG`, `<DOMAIN>_SETTINGS`
- **Lookup/mapping objects:** `<DOMAIN>_MAPPINGS`, `<DOMAIN>_INDEX`

**Examples:**

```javascript
// ✅ Good - Purpose is clear from name
AQI_CATEGORIES: { good: "Good", moderate: "Moderate" }        // Object for display
AQI_CATEGORY_KEYS: ["good", "moderate", "u4sg"]              // Array for iteration
DEVICE_STATUS_LIST: ["deployed", "ready", "recalled"]        // Array for validation
DEVICE_STATUS_LABELS: { deployed: "Deployed", ready: "Ready" } // Object for display

// ❌ Bad - Ambiguous purpose, collision-prone
AQI_CATEGORIES: ["good", "moderate"]  // Is this an array or object?
STATUSES: [...]                       // Too generic, which domain?
```

### Conflict Prevention Strategies

**1. Namespace-based Organization:**

```javascript
// Group related constants under domain namespaces
const AQI_CONSTANTS = {
  RANGES: { good: { min: 0, max: 9.1 } },
  COLORS: { good: "34C759" },
  CATEGORIES: { good: "Good" },
  CATEGORY_KEYS: ["good", "moderate"],
};

// Usage: AQI_CONSTANTS.CATEGORIES.good
```

**2. Mandatory Conflict Detection:**

- All constants files must be processed through conflict detection in `global/index.js` before merging
- CI/CD pipeline includes automated conflict checking
- Pre-commit hooks validate constant uniqueness

**3. Spread Order Awareness:**

```javascript
// ⚠️ Order matters - later spreads overwrite earlier ones
// This happens in config/global/index.js
const configurations = {
  ...mappings, // AQI_CATEGORIES: { good: "Good" }
  ...staticLists, // AQI_CATEGORIES: ["good"] ← OVERWRITES!
};

// ✅ Better - Use explicit namespacing
const configurations = {
  AQI: aqiConstants,
  DEVICES: deviceConstants,
  ...otherFlatConstants,
};
```

### Implementation Guidelines

**Required for all new constants:**

1. **Descriptive naming** that includes domain and data type
2. **Documentation** explaining the constant's purpose and expected data structure
3. **Type annotations** (if using TypeScript) or JSDoc comments
4. **Validation** in automated conflict detection scripts

**Example constant file structure:**

```javascript
// config/definitions/aqi.js
/**
 * Air Quality Index (AQI) related constants
 * Used for categorizing and displaying air pollution levels
 */
const AQI_CONSTANTS = {
  // Range definitions for PM2.5 values (objects for calculation logic)
  RANGES: {
    good: { min: 0, max: 9.1 },
    moderate: { min: 9.101, max: 35.49 },
  },

  // Display labels for categories (objects for UI display)
  CATEGORIES: {
    good: "Good",
    moderate: "Moderate",
  },

  // Ordered list of category keys (arrays for iteration/validation)
  CATEGORY_KEYS: [
    "good",
    "moderate",
    "u4sg",
    "unhealthy",
    "very_unhealthy",
    "hazardous",
  ],

  // Color codes for UI styling (objects for lookup)
  COLORS: {
    good: "34C759",
    moderate: "ECAA06",
  },
};

module.exports = AQI_CONSTANTS;
```

## Common and Shared Utility Functions

To avoid circular dependencies and promote code reuse:

- **`utils/common`:** Contains utility functions used across multiple microservices.
- **`utils/shared`:** Contains utility functions shared across multiple utility files within a single microservice. This prevents circular dependencies that can occur when utility functions depend on each other. A similar structure is used for validator functions in the `validators` folder.

This structured approach ensures a clean, organized, and easily maintainable codebase. The consistent naming conventions and clear folder structure improve collaboration and reduce the likelihood of errors.
