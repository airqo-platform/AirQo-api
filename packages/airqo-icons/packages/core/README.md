# @airqo/icons-core

The core package for AirQO's icon library, providing shared SVG assets and utilities across all icon implementations.

## Overview

This package serves as the centralized repository for all AirQO icon assets, containing **1,383 SVG icons** organized into 22 distinct categories. It provides the foundational SVG files that are consumed by framework-specific packages like React, Flutter, Vue, and Svelte implementations.

## Features

- 🎨 **1,383+ High-quality SVG icons** optimized for web and mobile
- 📁 **22 organized categories** for easy navigation and usage
- 🔧 **TypeScript support** with full type definitions
- ✅ **Comprehensive testing** with Jest
- 📦 **Framework agnostic** - serves as source for all implementations
- 🎯 **Air quality focused** with specialized AeroGlyphs for air quality indicators

## Icon Categories

The core package includes icons organized into the following categories:

### Core Categories

- **AeroGlyphs** (7 icons) - Air quality indicator glyphs (Good, Moderate, Unhealthy, etc.)
- **Airqo** (5 icons) - AirQO-specific branding and product icons
- **Alerts_Feedback** (26 icons) - Notifications, alerts, and user feedback
- **Arrows** (89 icons) - Directional indicators, navigation, and flow
- **Charts** (49 icons) - Data visualization and analytics
- **Communication** (58 icons) - Messaging, mail, and social interaction
- **Development** (55 icons) - Code, databases, and developer tools
- **Editor** (108 icons) - Text editing, formatting, and design tools
- **Education** (31 icons) - Learning, academic, and educational content
- **Files** (55 icons) - File management, documents, and storage
- **Finance_eCommerce** (75 icons) - Payment, shopping, and financial services
- **Flags** (23 categories) - Country and regional flags organized A-Z
- **General** (170 icons) - Common UI elements and utility icons
- **Images** (29 icons) - Photography, media, and visual content
- **Layout** (60 icons) - Page structure, grids, and positioning
- **Maps_Travel** - Geographic and travel-related icons
- **Media_devices** - Audio, video, and device controls
- **Security** - Privacy, authentication, and security features
- **Shapes** - Basic geometric shapes and forms
- **Time** - Clocks, calendars, and temporal indicators
- **Users** - Profile, authentication, and user management
- **Weather** - Climate and weather condition indicators

### Specialized Icon Sets

#### AeroGlyphs

Air quality indicator icons specifically designed for environmental monitoring:

- **Good** - Healthy air quality (Green)
- **Moderate** - Acceptable air quality (Yellow)
- **Unhealthy for Sensitive Groups** - Caution for sensitive individuals
- **Unhealthy** - General health warnings
- **Very Unhealthy** - Serious health concerns
- **Hazardous** - Emergency conditions
- **No Value** - Data unavailable indicator

#### AirQO Brand Icons

Official AirQO product and service icons:

- **AirQlouds** - AirQO's cloud platform
- **Calibration** - Device calibration processes
- **Collocation** - Sensor placement and positioning
- **Monitor** - Air quality monitoring devices
- **Sites** - Monitoring locations and sites

## Package Structure

````

## Installation

```bash
# Using npm
npm install @airqo/icons-core

# Using yarn
```bash

# Using pnpm
pnpm add @airqo/icons-core
````

## Usage

### Accessing SVG Icons

You can import the glob pattern to programmatically access all SVG icons:

```typescript
import { ICONS_GLOB } from '@airqo/icons-core';

// Use the glob pattern to find all icon files
console.log(ICONS_GLOB); // 'src/icons/**/*.svg'
```

### Direct SVG Access

You can reference SVG files directly for use in your build tools, generators, or static imports:

```typescript
// Example: Access a specific icon
const iconPath = 'node_modules/@airqo/icons-core/src/icons/AeroGlyphs/Good.svg';
```

### Consuming in Frameworks

This package is intended as a low-level asset library. For React, Flutter, Vue, or Svelte components, use the respective framework package:

- **React**: `@airqo/icons-react`
- **Flutter**: `@airqo/icons-flutter`
- **Vue**: `@airqo/icons-vue`
- **Svelte**: `@airqo/icons-svelte`

## API Reference

### Exports

- `ICONS_GLOB`
  - **Type**: `string`
  - **Value**: `'src/icons/**/*.svg'`
  - **Description**: Glob pattern for locating all SVG icon files in the package. Useful for build tools and generators.

#### Utilities

Currently, the core package only exports the `ICONS_GLOB` constant. All SVG assets are provided as raw files for maximum flexibility. No additional JavaScript/TypeScript utilities are included at this time.

## Contributing

When adding new icons to the core package:

1. **Choose the appropriate category** or create a new one if needed
2. **Follow naming conventions** (kebab-case or PascalCase)
3. **Ensure SVG optimization** and valid structure
4. **Update tests** if adding new categories
5. **Run the test suite** to validate changes

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and changes.

## License

This package is part of the AirQO Libraries project. See the root LICENSE file for licensing information.

## Installation

```bash
# Using npm
npm install @airqo/icons-core

# Using yarn
yarn add @airqo/icons-core

# Using pnpm
pnpm add @airqo/icons-core
```

## Usage

### Basic Usage

```typescript
import { ICONS_GLOB } from '@airqo/icons-core';

// Use the glob pattern to find all icon files
console.log(ICONS_GLOB); // 'src/icons/**/*.svg'
```

### Direct SVG Access

The package provides direct access to SVG files for build tools and generators:

```typescript
// Example: Access specific icon categories
const iconPath = 'node_modules/@airqo/icons-core/src/icons/AeroGlyphs/Good.svg';
```

### Framework Integration

This core package is designed to be consumed by framework-specific packages:

- **React**: `@airqo/icons-react`
- **Flutter**: `@airqo/icons-flutter`
- **Vue**: `@airqo/icons-vue`
- **Svelte**: `@airqo/icons-svelte`

## Development

### Building

```bash
# Clean previous builds
npm run clean

# Build TypeScript
npm run build

# Watch mode for development
npm run dev
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

The test suite validates:

- ✅ Icon directory structure exists
- ✅ All expected categories are present
- ✅ SVG files are valid XML with required attributes
- ✅ Consistent naming conventions
- ✅ Minimum icon count thresholds

### Icon Standards

All icons in this package follow these standards:

1. **Format**: SVG format optimized for web
2. **Viewbox**: Consistent viewBox attributes for scalability
3. **Naming**: Kebab-case or PascalCase with descriptive names
4. **Structure**: Valid XML structure with proper opening/closing tags
5. **Optimization**: Minimal file size while maintaining quality

## Integration with Other Packages

The core package serves as the single source of truth for all AirQO icons. Framework-specific packages use build tools to:

1. **Import SVG assets** from this core package
2. **Generate components** for each framework
3. **Apply framework-specific optimizations**
4. **Provide typed interfaces** for better developer experience

## API Reference

### Exports

#### `ICONS_GLOB`

- **Type**: `string`
- **Value**: `'src/icons/**/*.svg'`
- **Description**: Glob pattern for locating all SVG icon files

## Contributing

When adding new icons to the core package:

1. **Choose appropriate category** or create new one if needed
2. **Follow naming conventions** (kebab-case or PascalCase)
3. **Ensure SVG optimization** and valid structure
4. **Update tests** if adding new categories
5. **Run test suite** to validate changes

## Version History

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history and changes.

## License

This package is part of the AirQO Libraries project. See the root LICENSE file for licensing information.

## Related Packages

- [`@airqo/icons-react`](../react/README.md) - React components
- [`@airqo/icons-flutter`](../flutter/README.md) - Flutter widgets
- [`@airqo/icons-vue`](../vue/README.md) - Vue components
- [`@airqo/icons-svelte`](../svelte/README.md) - Svelte components

---

**Note**: This is the core package containing raw SVG assets. For framework-specific implementations with components and enhanced developer experience, use the appropriate framework package listed above.
