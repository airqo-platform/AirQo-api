# Contributing to Blog Content Manager

#

We're thrilled that you're interested in contributing to the Blog Content Manager microservice! This document provides guidelines for contributing to the project. By participating in this project, you agree to abide by its terms.

## Table of Contents

#

1.  [Code of Conduct](#code-of-conduct)
2.  [Getting Started](#getting-started)
3.  [Project Structure](#project-structure)
4.  [How to Contribute](#how-to-contribute)
5.  [Style Guidelines](#style-guidelines)
6.  [Commit Messages](#commit-messages)
7.  [Pull Requests](#pull-requests)
8.  [Reporting Bugs](#reporting-bugs)
9.  [Suggesting Enhancements](#suggesting-enhancements)
10. [Documentation](#documentation)

## Code of Conduct

#

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to \[[support@airqo.net](mailto:support@airqo.net)\].

## Getting Started

#

1.  Fork the repository on GitHub.
2.  Clone your fork locally:

    Copy

    `git clone https://github.com/airqo-platform/AirQo-api.git cd AirQo-api/src/blog-content-manager`

3.  Set up your environment as described in the README.md.
4.  Create a branch for your work:

    Copy

    `git checkout -b your-feature-branch`

## Project Structure

#

The Blog Content Manager microservice follows the Model-View-Controller (MVC) design pattern. Understanding this structure is crucial for making contributions:

```bash
blog-content-manager/

├── bin/                # Starting scripts for the application

├── config/             # Environmental variables and configuration settings

├── controllers/        # Controller logic for various use cases

├── middleware/         # Custom middleware functions

├── models/             # MongoDB schema definitions (entities)

├── routes/             # API endpoint definitions

└── utils/              # Utility functions for each use case
```

- **bin/**: Contains the starting scripts for the application.
- **config/**: Holds environmental variables, constants, and various configuration settings used throughout the app.
- **controllers/**: Contains the controller logic for various use cases. Each file represents a use case and is named in verb tense.
- **middleware/**: Houses various middleware functions utilized in the application.
- **models/**: Contains the MongoDB schema definitions, representing the entities of the application. Each file inside represents an entity.
- **routes/**: Defines the various endpoint paths. Each file contains endpoints for a specific use case.
- **utils/**: Contains utility functions required for each use case. These functions often interact with the models and serve as an abstraction layer.

When contributing, ensure your code fits into this structure appropriately.

## How to Contribute

#

1.  Ensure your code adheres to the project's coding standards and fits within the MVC structure.
2.  Add or update tests as necessary.
3.  Update documentation as needed.
4.  Push your changes to your fork.
5.  Submit a pull request to the main repository.

## Style Guidelines

#

- Follow the [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript).
- Use meaningful variable and function names.
- Comment your code where necessary, especially for complex logic.
- Keep functions small and focused on a single task.
- Adhere to the MVC pattern when organizing your code.

## Commit Messages

#

- Use the present tense ("Add feature" not "Added feature").
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...").
- Limit the first line to 72 characters or less.
- Reference issues and pull requests liberally after the first line.

## Pull Requests

#

1.  Ensure your PR description clearly describes the problem and solution.
2.  Include the relevant issue number if applicable.
3.  Update the README.md with details of changes to the interface, if any.
4.  Ensure all tests pass and add new ones for added features.
5.  Make sure your code fits within the existing project structure.

## Reporting Bugs

#

- Use the issue tracker to report bugs.
- Describe the exact steps to reproduce the problem.
- Provide specific examples to demonstrate the steps.

## Suggesting Enhancements

#

- Use the issue tracker to suggest enhancements.
- Provide a clear and detailed explanation of the feature you want to see.
- Explain why this enhancement would be useful to most users.

## Documentation

#

- Help us improve project documentation.
- Suggest improvements to the README, this CONTRIBUTING guide, or inline documentation.
- Ensure any new features or changes are properly documented.

Thank you for contributing to Blog Content Manager!

```

```
