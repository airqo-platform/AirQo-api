# Project Codebase Structure and Naming Conventions

This document outlines the project's codebase structure and naming conventions, designed to enhance readability, maintainability, and scalability. The project utilizes the Model-View-Controller (MVC) architectural pattern.

## Core Folder Structure

The project follows a standard MVC structure with additional folders for common utilities and shared functions to prevent circular dependencies.

```
.
├── bin                       # Scripts for running background jobs (e.g., Kafka consumer)
│   └── jobs                  # Individual job scripts
├── config                    # Configuration files
│   ├── environments          # Environment-specific configurations (development, staging, production)
│   │   └── index.js          # Aggregates environment configurations
│   └── global                # Global configurations used across all environments
│       └── index.js          # Aggregates global configurations
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

- **`environments` subfolder:** Contains environment-specific configuration files (e.g., `development.js`, `staging.js`, `production.js`). Each file contains settings unique to that environment. An `index.js` file aggregates these configurations for easy import.

- **`global` subfolder:** Contains configuration settings that remain consistent across all environments (e.g., database connection strings, API keys, default values). An `index.js` file aggregates these configurations for easy import.

- **`constants.js` file:** This file imports configurations from both the `environments` and `global` subfolders, selecting the appropriate environment based on the `NODE_ENV` environment variable. This provides a single point of access for all configuration values throughout the application. Example:

  ```javascript
  const environments = require("./environments");
  const global = require("./global");

  function envConfig(env) {
    return { ...global, ...environments[env] };
  }

  const environment = process.env.NODE_ENV || "production";
  module.exports = envConfig(environment);
  ```

This approach promotes modularity, readability, and maintainability of the configuration settings.

## Common and Shared Utility Functions

To avoid circular dependencies and promote code reuse:

- **`utils/common`:** Contains utility functions used across multiple microservices.
- **`utils/shared`:** Contains utility functions shared across multiple utility files within a single microservice. This prevents circular dependencies that can occur when utility functions depend on each other. A similar structure is used for validator functions in the `validators` folder.

This structured approach ensures a clean, organized, and easily maintainable codebase. The consistent naming conventions and clear folder structure improve collaboration and reduce the likelihood of errors.
