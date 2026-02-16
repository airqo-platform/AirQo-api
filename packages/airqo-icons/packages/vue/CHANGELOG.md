# @airqo/icons-vue

## 0.2.3

### Patch Changes

- 4d3ceea: feat: update SVG components and add new AirQo icon

  - Adjusted viewBox dimensions for AqAirQlouds and AqSites components.
  - Modified paths in AqAirQlouds and AqSites SVGs for improved design.
  - Added new AqAirQo component and corresponding SVG file.
  - Updated index.ts to include the new AqAirQo component and incremented totalIcons count.

## 0.2.2

### Patch Changes

- 158e49b: ### 🛠️ Build & Workflow Improvements

  **@airqo/icons-vue**

  - Fixed out-of-memory build errors by optimizing Vite config and using cross-env for Node.js memory settings
  - Excluded test files from type declarations for a cleaner, smaller package
  - Improved build reliability and performance for large icon sets
  - Updated documentation and changelog for clarity

  **@airqo/icons-react**

  - Enhanced build and metadata generation for React icons
  - Improved changeset and documentation for better maintainability

  **General**

  - Improved CI workflow for Flutter and JS packages (dependency caching, robust install order)
  - Removed unnecessary example analysis step to prevent false CI failures
  - Codebase cleanup and dependency updates for a more reliable release process

## 0.2.1

### Patch Changes

- 4e81bcc: ### 🛠️ Build Optimizations & Bug Fixes

  - **Fixed memory issues** during build process by implementing Node.js heap size optimization
  - **Added cross-env dependency** to ensure consistent build environment across platforms
  - **Excluded test files** from TypeScript declaration generation to reduce package size
  - **Improved build stability** for large icon libraries with 1,383+ components
  - **Enhanced CI/CD compatibility** for GitHub Actions workflows

  These optimizations resolve JavaScript heap out of memory errors and ensure reliable package publishing.

## 0.2.0

### Minor Changes

- 10da6ef: 🎉 **Initial Release**: Complete Vue 3 icon library

  **New Features:**

  - 1,383 Vue 3 components with full TypeScript support
  - Composition API with `<script setup>` syntax
  - 22 icon categories including 196 country flags
  - Tree-shakable imports for optimal bundle size
  - SSR compatibility with Nuxt.js and other frameworks
  - Comprehensive test suite (17/17 tests passing)
  - Professional documentation and examples

  **Bundle:**

  - ~6.4MB total, ~1.8MB gzipped
  - ESM and UMD formats
  - Zero dependencies (peer: Vue 3.3+)

  **Developer Experience:**

  - Full TypeScript IntelliSense
  - Consistent API: `size`, `color`, `class` props
  - Vite build system with hot reload
  - Vitest testing framework

  This is the first stable release of the Vue package, providing feature parity with React and Flutter packages.

## 0.1.0

### Major Changes

- 🎉 **Initial Release**: Complete Vue 3 icon library with 1,383 icons
- ⚡ **Vue 3 Optimized**: Built with Composition API and `<script setup>` syntax
- 🎯 **22 Icon Categories**: Comprehensive coverage from general UI to specialized icons
- 🌍 **196 Country Flags**: Complete global flag collection
- 💪 **TypeScript Support**: Full type safety with IntelliSense
- 📦 **Tree-shakable**: Import only what you need for optimal bundle size
- 🔧 **Framework Ready**: Works with Nuxt.js, Vite, and other Vue 3 frameworks

### Features

- **Consistent API**: All icons accept `size`, `color`, and `class` props
- **Performance Optimized**: ~6.4MB total, ~1.8MB gzipped
- **SSR Compatible**: Works with server-side rendering
- **Accessibility Ready**: Proper SVG attributes and semantic structure
- **Modern Build**: ESM and UMD formats supported

### Icon Categories

- AeroGlyphs (7 icons): Air quality indicator glyphs
- Airqo (5 icons): AirQO brand and product icons
- Alerts_Feedback (26 icons): Notifications and user feedback
- Arrows (92 icons): Directional and navigation indicators
- Charts (49 icons): Data visualization components
- Communication (58 icons): Messaging and social interaction
- Development (57 icons): Programming and developer tools
- Editor (104 icons): Text editing and formatting
- Education (31 icons): Learning and academic content
- Files (58 icons): Document and file management
- Finance_eCommerce (79 icons): Payment and shopping
- Flags (196 icons): Country and regional flags
- General (197 icons): Common UI elements
- Images (29 icons): Photography and media
- Layout (63 icons): Page structure and grids
- Maps_Travel (42 icons): Geographic and travel
- Media_devices (108 icons): Audio, video, and devices
- Security (36 icons): Privacy and authentication
- Shapes (25 icons): Geometric shapes and forms
- Time (28 icons): Clocks and temporal indicators
- Users (41 icons): Profile and user management
- Weather (52 icons): Climate and weather conditions

### Development

- **Testing**: Comprehensive test suite with Vitest
- **Build System**: Vite with TypeScript and Vue SFC support
- **Code Quality**: ESLint + TypeScript strict mode
- **Documentation**: Professional README with examples

### Breaking Changes

None (initial release)

### Migration

None (initial release)
