# AirQo Icons

AirQo Icons is a shared icon system for React, Vue 3, and Flutter. The repository contains 1,384 source SVG assets across 22 categories and generates framework-native, typed components from the same source files.

## Packages

| Platform | Package | Installation |
| --- | --- | --- |
| React | `@airqo/icons-react` | `npm i @airqo/icons-react` |
| Vue 3 | `@airqo/icons-vue` | `npm i @airqo/icons-vue` |
| Flutter | `airqo_icons_flutter` | `flutter pub add airqo_icons_flutter` |

The fixed Flutter release is `1.0.5`. It must be published before consumers can install that version from pub.dev.

## Quick start

### React

```tsx
import { AqAirQlouds, AqSites } from '@airqo/icons-react';

export function MonitoringIcons() {
  return (
    <div>
      <AqAirQlouds size={24} color="#2563eb" aria-label="AirQlouds" />
      <AqSites size={24} color="#16a34a" aria-label="Sites" />
    </div>
  );
}
```

### Vue 3

```vue
<script setup lang="ts">
import { AqAirQlouds, AqSites } from '@airqo/icons-vue';
</script>

<template>
  <AqAirQlouds :size="24" color="#2563eb" aria-label="AirQlouds" />
  <AqSites :size="24" color="#16a34a" aria-label="Sites" />
</template>
```

### Flutter

```dart
import 'package:flutter/material.dart';
import 'package:airqo_icons_flutter/airqo_icons_flutter.dart';

Row(
  children: const [
    AqAirQlouds(size: 24, color: Colors.blue, semanticsLabel: 'AirQlouds'),
    AqSites(size: 24, color: Colors.green, semanticsLabel: 'Sites'),
  ],
)
```

## Design principles

- One SVG source of truth for every framework.
- Named imports for predictable tree-shaking in React and Vue.
- Consistent sizing and color APIs.
- Accessible labels through standard SVG and Flutter semantics properties.
- Generated artifacts are validated before release.

## Repository development

```bash
pnpm install

# Regenerate framework components from core SVGs
node tools/generators/react-generator-enhanced.js
node tools/generators/vue-generator.js
node tools/generators/flutter-generator.js

# Validate JavaScript packages
npm run build --prefix packages/react
npm test --prefix packages/react -- --runInBand
npm test --prefix packages/core -- --runInBand

# Validate Flutter package structure and, on a working Flutter SDK,
# run analyze, tests, and the pub.dev dry run.
node tools/release/verify-flutter-package.js
```

## Adding or changing an icon

1. Add or update the SVG under `packages/core/src/icons/<Category>/`.
2. Keep the SVG valid XML with a `viewBox` and a single root `<svg>` element.
3. Regenerate all framework outputs.
4. Run the package tests and inspect the publish archive contents.
5. Update the relevant changelog and package version.

See [the maintainer guide](docs/README.md) for release and troubleshooting details.

## License

MIT © AirQo Organization
